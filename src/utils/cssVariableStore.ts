/**
 * CssVariableStore parses CSS/SCSS files and configured package sources to
 * extract native CSS custom property definitions.
 */

import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import { createRequire } from "module";
import type {
  ResolvedToken,
  ResolvedSimple,
  ChainStep,
  TokenType,
  CssVariableSourceConfig,
} from "../core/types";
import { parseColor } from "./colorParser";

type CssVarOrigin = "workspace" | "source" | "manifest";

export interface CssVarEntry {
  name: string;
  rawValue: string;
  file: string;
  line: number;
  resolvedValue?: string;
  declaredType?: TokenType;
  origin?: CssVarOrigin;
  sourceName?: string;
  sourceIndex?: number;
  appliesTo?: string[];
  packageName?: string;
  packageRoot?: string;
}

interface CssResolveContext {
  documentPath?: string;
  line?: number;
}

interface CssFileRef {
  file: string;
  source?: CssSourceRuntime;
}

interface CssSourceRuntime {
  name: string;
  index: number;
  appliesTo: string[];
  origin: Exclude<CssVarOrigin, "workspace">;
  packageName?: string;
  packageRoot?: string;
}

interface ManifestTokenEntry {
  cssVar?: unknown;
  name?: unknown;
  value?: unknown;
  resolvedValue?: unknown;
  originalValue?: unknown;
  type?: unknown;
}

export class CssVariableStore {
  private _vars = new Map<string, CssVarEntry[]>();
  private _fileOrder = new Map<string, number>();
  private _workspaceRoots: string[] = [];
  private _watchRoots = new Set<string>();
  private _contextPackageRootCache = new Map<string, string | null>();
  private _manifestMetadata = new Map<string, CssVarEntry[]>();

  get size(): number {
    return this._vars.size;
  }

  get watchRoots(): string[] {
    return [...this._watchRoots].sort();
  }

  async scanWorkspace(workspaceRoot: string, sources: CssVariableSourceConfig[] = []): Promise<void> {
    await this.scanWorkspaces([workspaceRoot], sources);
  }

  async scanWorkspaces(workspaceRoots: string[], sources: CssVariableSourceConfig[] = []): Promise<void> {
    this._vars.clear();
    this._fileOrder.clear();
    this._watchRoots.clear();
    this._contextPackageRootCache.clear();
    this._manifestMetadata.clear();
    this._workspaceRoots = workspaceRoots.map((root) => path.resolve(root));

    const cssFiles: CssFileRef[] = [];
    for (const root of this._workspaceRoots) {
      await this._collectCssFiles(root, 0, cssFiles);
    }

    await this._collectConfiguredSources(sources, cssFiles);

    for (let fileIndex = 0; fileIndex < cssFiles.length; fileIndex++) {
      const { file, source } = cssFiles[fileIndex];
      if (!this._fileOrder.has(file)) this._fileOrder.set(file, fileIndex);
      const entries = await this._parseFile(file, source);
      this._addEntries(entries);
    }

    for (const entries of this._vars.values()) {
      entries.sort((a, b) => this._entrySort(a, b));
    }
  }

  findVar(cssVarName: string, context?: CssResolveContext): CssVarEntry | null {
    const entries = this._vars.get(cssVarName);
    if (!entries?.length) return null;
    return this._findBestEntry(entries, context);
  }

  findVarNames(prefix = "", context?: CssResolveContext, limit = Number.MAX_SAFE_INTEGER): string[] {
    const result: string[] = [];
    const normalizedPrefix = prefix.trim();
    const names = [...this._vars.keys()].sort();
    for (const name of names) {
      if (normalizedPrefix && !name.startsWith(normalizedPrefix)) continue;
      if (!this.findVar(name, context)) continue;
      result.push(name);
      if (result.length >= limit) break;
    }
    return result;
  }

  resolveToToken(cssVarName: string, context?: CssResolveContext): ResolvedToken | null {
    const entry = this.findVar(cssVarName, context);
    if (!entry) return null;

    const resolveContext = context?.documentPath
      ? context
      : { documentPath: entry.file, line: entry.line };
    const value = entry.resolvedValue ?? this._resolveVarRefs(
      entry.rawValue,
      resolveContext,
      new Set([`${cssVarName}@${entry.file}:${entry.line}`]),
    );
    const type = entry.declaredType ?? inferType(value);
    const chain = entry.origin === "manifest"
      ? [{ token: cssVarName, file: entry.file, type }]
      : this._buildVarChain(
        cssVarName,
        resolveContext,
        new Set<string>(),
      );

    const result: ResolvedSimple = {
      kind: "simple",
      type,
      tokenKey: cssVarName,
      rawValue: entry.rawValue,
      finalValue: value,
      chain,
      file: entry.file,
    };

    return result;
  }

  private _addEntries(entries: CssVarEntry[]): void {
    for (const entry of entries) {
      const bucket = this._vars.get(entry.name) ?? [];
      bucket.push(entry);
      this._vars.set(entry.name, bucket);
    }
  }

  private async _collectConfiguredSources(
    sources: CssVariableSourceConfig[],
    out: CssFileRef[],
  ): Promise<void> {
    if (sources.length === 0) return;

    const packageJsonFiles = sources.some((source) => source.packageName)
      ? await this._findWorkspacePackageJsonFiles()
      : [];
    for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
      const source = sources[sourceIndex];
      const runtimeBase: CssSourceRuntime = {
        name: source.name,
        index: sourceIndex + 1,
        appliesTo: source.appliesTo,
        origin: "source",
      };

      if (source.packageName) {
        await this._collectPackageSource(source, runtimeBase, packageJsonFiles, out);
      } else {
        await this._collectPathSource(source.cssPaths, runtimeBase, out);
        await this._collectManifestPaths(source.manifests, { ...runtimeBase, origin: "manifest" });
      }
    }
  }

  private async _collectPackageSource(
    source: CssVariableSourceConfig,
    runtimeBase: CssSourceRuntime,
    packageJsonFiles: string[],
    out: CssFileRef[],
  ): Promise<void> {
    const packageRoots = new Set<string>();
    const cssPathsByRoot = new Map<string, Set<string>>();
    const manifestPathsByRoot = new Map<string, Set<string>>();

    for (const packageJsonFile of packageJsonFiles) {
      const resolvedCssPaths = this._resolvePackageRelativePaths(
        packageJsonFile,
        source.packageName,
        source.cssPaths,
        packageRoots,
      );
      for (const resolved of resolvedCssPaths) {
        const root = this._inferPackageRoot(resolved.path, resolved.relativePath);
        if (!root) continue;
        addToSetMap(cssPathsByRoot, root, resolved.path);
      }

      const resolvedManifestPaths = this._resolvePackageRelativePaths(
        packageJsonFile,
        source.packageName,
        source.manifests,
        packageRoots,
      );
      for (const resolved of resolvedManifestPaths) {
        const root = this._inferPackageRoot(resolved.path, resolved.relativePath);
        if (!root) continue;
        addToSetMap(manifestPathsByRoot, root, resolved.path);
      }

      const packageRoot = this._resolvePackageRoot(packageJsonFile, source.packageName, source.cssPaths, source.manifests);
      if (packageRoot) packageRoots.add(packageRoot);
    }

    for (const root of packageRoots) {
      for (const cssPath of source.cssPaths) {
        const direct = path.resolve(root, cssPath);
        addToSetMap(cssPathsByRoot, root, direct);
      }
      for (const manifestPath of source.manifests) {
        const direct = path.resolve(root, manifestPath);
        addToSetMap(manifestPathsByRoot, root, direct);
      }
    }

    for (const [root, cssPaths] of cssPathsByRoot) {
      this._watchRoots.add(root);
      for (const cssPath of cssPaths) {
        await this._collectCssEntrypoint(
          cssPath,
          { ...runtimeBase, packageName: source.packageName, packageRoot: root },
          out,
          new Set<string>(),
        );
      }
    }

    for (const [root, manifestPaths] of manifestPathsByRoot) {
      this._watchRoots.add(root);
      for (const manifestPath of manifestPaths) {
        await this._collectManifestFile(
          manifestPath,
          { ...runtimeBase, origin: "manifest", packageName: source.packageName, packageRoot: root },
        );
      }
    }
  }

  private async _collectPathSource(paths: string[], runtime: CssSourceRuntime, out: CssFileRef[]): Promise<void> {
    for (const sourcePath of paths) {
      for (const root of this._workspaceRoots) {
        const resolved = path.isAbsolute(sourcePath)
          ? path.resolve(sourcePath)
          : path.resolve(root, sourcePath);
        await this._collectCssEntrypoint(resolved, runtime, out, new Set<string>());
        this._watchRoots.add(await nearestExistingDirectory(resolved));
      }
    }
  }

  private async _collectManifestPaths(paths: string[], runtime: CssSourceRuntime): Promise<void> {
    for (const sourcePath of paths) {
      for (const root of this._workspaceRoots) {
        const resolved = path.isAbsolute(sourcePath)
          ? path.resolve(sourcePath)
          : path.resolve(root, sourcePath);
        await this._collectManifestFile(resolved, runtime);
        this._watchRoots.add(await nearestExistingDirectory(resolved));
      }
    }
  }

  private async _findWorkspacePackageJsonFiles(): Promise<string[]> {
    const result: string[] = [];
    for (const root of this._workspaceRoots) {
      await this._collectPackageJsonFiles(root, 0, result);
    }
    return [...new Set(result)];
  }

  private async _collectPackageJsonFiles(dir: string, depth: number, out: string[]): Promise<void> {
    if (depth > 7) return;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (shouldSkipDirectory(entry.name)) continue;
          await this._collectPackageJsonFiles(full, depth + 1, out);
        } else if (entry.isFile() && entry.name === "package.json") {
          out.push(full);
        }
      }
    } catch {
      // skip inaccessible directories
    }
  }

  private _resolvePackageRelativePaths(
    packageJsonFile: string,
    packageName: string | undefined,
    relativePaths: string[],
    packageRoots: Set<string>,
  ): Array<{ path: string; relativePath: string }> {
    if (!packageName) return [];

    const requireFromPackage = createRequire(packageJsonFile);
    const result: Array<{ path: string; relativePath: string }> = [];
    for (const relativePath of relativePaths) {
      try {
        const resolved = requireFromPackage.resolve(`${packageName}/${relativePath}`);
        result.push({ path: path.resolve(resolved), relativePath });
      } catch {
        // Directory entrypoints and packages with strict exports are handled via package root fallback.
      }
    }

    const packageRoot = this._resolvePackageRoot(packageJsonFile, packageName, relativePaths, []);
    if (packageRoot) packageRoots.add(packageRoot);
    return result;
  }

  private _resolvePackageRoot(
    packageJsonFile: string,
    packageName: string | undefined,
    cssPaths: string[],
    manifests: string[],
  ): string | null {
    if (!packageName) return null;

    const requireFromPackage = createRequire(packageJsonFile);
    try {
      return path.dirname(requireFromPackage.resolve(`${packageName}/package.json`));
    } catch {
      // Fall through to infer root from an exported file.
    }

    for (const relativePath of [...cssPaths, ...manifests]) {
      try {
        const resolved = requireFromPackage.resolve(`${packageName}/${relativePath}`);
        return this._inferPackageRoot(path.resolve(resolved), relativePath);
      } catch {
        // Try the next configured path.
      }
    }
    return null;
  }

  private _inferPackageRoot(resolvedPath: string, relativePath: string): string | null {
    const normalized = normalizeSlashes(relativePath).split("/").filter(Boolean);
    if (normalized.length === 0) return null;
    let current = path.resolve(resolvedPath);
    for (let i = 0; i < normalized.length; i++) {
      current = path.dirname(current);
    }
    return current;
  }

  private async _collectCssEntrypoint(
    entrypoint: string,
    source: CssSourceRuntime,
    out: CssFileRef[],
    visited: Set<string>,
  ): Promise<void> {
    const resolved = path.resolve(entrypoint);
    let stat;
    try {
      stat = await fs.stat(resolved);
    } catch {
      return;
    }

    if (stat.isDirectory()) {
      await this._collectCssFiles(resolved, 0, out, source);
      return;
    }

    if (!stat.isFile() || !isCssFile(resolved)) return;
    if (visited.has(resolved)) return;
    visited.add(resolved);

    let content: string;
    try {
      content = await fs.readFile(resolved, "utf-8");
    } catch {
      return;
    }

    for (const importPath of extractCssImports(content)) {
      const imported = this._resolveCssImport(importPath, resolved);
      if (imported) {
        await this._collectCssEntrypoint(imported, source, out, visited);
      }
    }
    out.push({ file: resolved, source });
  }

  private _resolveCssImport(importPath: string, fromFile: string): string | null {
    if (/^(https?:)?\/\//.test(importPath)) return null;
    const withoutQuery = importPath.split(/[?#]/, 1)[0];
    if (!withoutQuery) return null;

    if (withoutQuery.startsWith(".")) {
      return path.resolve(path.dirname(fromFile), withoutQuery);
    }

    if (path.isAbsolute(withoutQuery)) {
      return path.resolve(withoutQuery);
    }

    try {
      return createRequire(fromFile).resolve(withoutQuery);
    } catch {
      return null;
    }
  }

  private async _collectManifestFile(filePath: string, source: CssSourceRuntime): Promise<void> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(content) as unknown;
      const tokens = readManifestTokens(parsed);
      const entries: CssVarEntry[] = [];
      for (const token of tokens) {
        const cssVar = readManifestCssVar(token);
        if (!cssVar) continue;
        const finalValue = stringifyManifestValue(token.resolvedValue ?? token.value);
        const rawValue = stringifyManifestValue(token.originalValue ?? token.value ?? token.resolvedValue);
        entries.push({
          name: cssVar,
          rawValue,
          resolvedValue: finalValue || rawValue,
          file: filePath,
          line: 1,
          declaredType: normalizeManifestType(token.type),
          origin: "manifest",
          sourceName: source.name,
          sourceIndex: source.index,
          appliesTo: source.appliesTo,
          packageName: source.packageName,
          packageRoot: source.packageRoot,
        });
      }
      this._addManifestMetadata(entries);
      this._addEntries(entries);
    } catch {
      // skip invalid or inaccessible manifests
    }
  }

  private async _collectCssFiles(
    dir: string,
    depth: number,
    out: CssFileRef[],
    source?: CssSourceRuntime,
  ): Promise<void> {
    if (depth > 6) return;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (shouldSkipDirectory(entry.name)) continue;
          await this._collectCssFiles(full, depth + 1, out, source);
        } else if (entry.isFile() && isCssFile(entry.name)) {
          out.push({ file: full, source });
        }
      }
    } catch {
      // skip inaccessible directories
    }
  }

  private async _parseFile(filePath: string, source?: CssSourceRuntime): Promise<CssVarEntry[]> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const varRegex = /--([a-zA-Z][\w-]*)\s*:\s*([^;}{]+)/g;
      let match: RegExpExecArray | null;
      const lineOffsets = getLineOffsets(content);
      const result: CssVarEntry[] = [];

      while ((match = varRegex.exec(content)) !== null) {
        const name = `--${match[1]}`;
        const rawValue = match[2].trim();
        const offset = match.index;
        const lineNum = lineFromOffset(offset, lineOffsets);

        const entry: CssVarEntry = {
          name,
          rawValue,
          file: filePath,
          line: lineNum,
          origin: source?.origin ?? "workspace",
          sourceName: source?.name,
          sourceIndex: source?.index,
          appliesTo: source?.appliesTo,
          packageName: source?.packageName,
          packageRoot: source?.packageRoot,
        };
        result.push(this._enrichWithManifestMetadata(entry));
      }
      return result;
    } catch {
      return [];
    }
  }

  private _addManifestMetadata(entries: CssVarEntry[]): void {
    for (const entry of entries) {
      const bucket = this._manifestMetadata.get(entry.name) ?? [];
      bucket.push(entry);
      this._manifestMetadata.set(entry.name, bucket);
    }
  }

  private _enrichWithManifestMetadata(entry: CssVarEntry): CssVarEntry {
    const metadata = this._findManifestMetadata(entry);
    if (!metadata) return entry;

    return {
      ...entry,
      resolvedValue: metadata.resolvedValue ?? entry.resolvedValue,
      declaredType: metadata.declaredType ?? entry.declaredType,
    };
  }

  private _findManifestMetadata(entry: CssVarEntry): CssVarEntry | null {
    const candidates = this._manifestMetadata.get(entry.name);
    if (!candidates?.length) return null;

    return candidates.find((candidate) => sameSource(candidate, entry)) ?? null;
  }

  private _findBestEntry(entries: CssVarEntry[], context?: CssResolveContext): CssVarEntry | null {
    const applicable = entries.filter((entry) => this._entryAppliesTo(entry, context?.documentPath));
    if (applicable.length === 0) return null;
    if (!context?.documentPath) return applicable[0];

    const contextPath = path.resolve(context.documentPath);
    const contextLine = context.line;

    let best: CssVarEntry | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const entry of applicable) {
      const score = this._entryScore(entry, contextPath, contextLine);
      if (score > bestScore) {
        best = entry;
        bestScore = score;
      }
    }
    return best;
  }

  private _entryAppliesTo(entry: CssVarEntry, contextPath?: string): boolean {
    if (!contextPath) return true;
    if (entry.appliesTo?.length && !matchesAnyPattern(contextPath, this._workspaceRoots, entry.appliesTo)) return false;
    if (!entry.packageName || !entry.packageRoot) return true;
    const contextPackageRoot = this._resolveContextPackageRoot(contextPath, entry.packageName);
    if (!contextPackageRoot) return !!entry.appliesTo?.length;
    return contextPackageRoot === path.resolve(entry.packageRoot);
  }

  private _resolveContextPackageRoot(contextPath: string, packageName: string): string | null {
    const cacheKey = `${path.resolve(contextPath)}::${packageName}`;
    if (this._contextPackageRootCache.has(cacheKey)) {
      return this._contextPackageRootCache.get(cacheKey) ?? null;
    }

    const packageJson = this._findNearestPackageJson(contextPath);
    if (!packageJson) {
      this._contextPackageRootCache.set(cacheKey, null);
      return null;
    }

    try {
      const requireFromContext = createRequire(packageJson);
      const packageJsonPath = requireFromContext.resolve(`${packageName}/package.json`);
      const packageRoot = path.dirname(path.resolve(packageJsonPath));
      this._contextPackageRootCache.set(cacheKey, packageRoot);
      return packageRoot;
    } catch {
      this._contextPackageRootCache.set(cacheKey, null);
      return null;
    }
  }

  private _findNearestPackageJson(contextPath: string): string | null {
    let current = path.dirname(path.resolve(contextPath));
    const boundary = this._workspaceRoots
      .filter((root) => isPathInsideOrEqual(current, root))
      .sort((a, b) => b.length - a.length)[0];

    while (current && current !== path.dirname(current)) {
      const candidate = path.join(current, "package.json");
      if (fsSync.existsSync(candidate)) return candidate;
      if (boundary && current === boundary) break;
      current = path.dirname(current);
    }
    return null;
  }

  private _resolveVarRefs(value: string, context: CssResolveContext, visited: Set<string>): string {
    let current = value;
    let iterations = 0;
    let prev = "";

    while (current !== prev && iterations < 10) {
      prev = current;
      current = current.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (_match, varName: string, fallback?: string) => {
        const nextEntry = this.findVar(varName, context);
        if (!nextEntry) {
          return fallback?.trim() ?? `var(${varName})`;
        }
        const nextVisitKey = `${varName}@${nextEntry.file}:${nextEntry.line}`;
        if (visited.has(nextVisitKey)) {
          return fallback?.trim() ?? `var(${varName})`;
        }
        visited.add(nextVisitKey);
        const resolved = nextEntry.resolvedValue ?? this._resolveVarRefs(nextEntry.rawValue, context, visited);
        visited.delete(nextVisitKey);
        return resolved;
      });
      iterations++;
    }
    return current;
  }

  private _buildVarChain(varName: string, context: CssResolveContext, visited: Set<string>): ChainStep[] {
    const entry = this.findVar(varName, context);
    if (!entry) return [];
    const visitKey = `${varName}@${entry.file}:${entry.line}`;
    if (visited.has(visitKey)) return [];
    visited.add(visitKey);

    const resolved = entry.resolvedValue ?? this._resolveVarRefs(
      entry.rawValue,
      { documentPath: entry.file, line: entry.line },
      new Set([visitKey]),
    );
    const type = entry.declaredType ?? inferType(resolved);
    const steps: ChainStep[] = [{ token: varName, file: entry.file, type }];
    const refs = Array.from(entry.rawValue.matchAll(/var\(\s*(--[\w-]+)\s*(?:,\s*[^)]*)?\)/g));
    for (const ref of refs) {
      const refName = ref[1];
      steps.push(...this._buildVarChain(
        refName,
        context,
        visited,
      ));
    }
    visited.delete(visitKey);
    return steps;
  }

  private _entrySort(a: CssVarEntry, b: CssVarEntry): number {
    const fileOrderA = this._fileOrder.get(a.file) ?? Number.MAX_SAFE_INTEGER;
    const fileOrderB = this._fileOrder.get(b.file) ?? Number.MAX_SAFE_INTEGER;
    if (fileOrderA !== fileOrderB) return fileOrderA - fileOrderB;
    if (a.file === b.file && a.line === b.line && a.origin !== b.origin) {
      return originRank(b.origin) - originRank(a.origin);
    }
    const originA = originRank(a.origin);
    const originB = originRank(b.origin);
    if (originA !== originB) return originA - originB;
    return a.line - b.line;
  }

  private _entryScore(entry: CssVarEntry, contextPath: string, contextLine?: number): number {
    const entryPath = path.resolve(entry.file);
    if (entryPath === contextPath) {
      if (typeof contextLine === "number") {
        const directDistance = Math.abs(entry.line - contextLine);
        const beforePenalty = entry.line > contextLine ? 0.25 : 0;
        return 1_000_000 - directDistance - beforePenalty;
      }
      return 1_000_000;
    }

    const contextDirParts = path.dirname(contextPath).split(path.sep).filter(Boolean);
    const entryDirParts = path.dirname(entryPath).split(path.sep).filter(Boolean);
    let common = 0;
    const maxCommon = Math.min(contextDirParts.length, entryDirParts.length);
    while (common < maxCommon && contextDirParts[common] === entryDirParts[common]) {
      common++;
    }
    const distance = (contextDirParts.length - common) + (entryDirParts.length - common);
    const configuredSourceBonus = entry.origin === "source" || entry.origin === "manifest" ? 100_000 : 0;
    const orderPenalty = (this._fileOrder.get(entry.file) ?? 0) / 10_000;
    const sourcePenalty = (entry.sourceIndex ?? 0) / 1_000;
    const manifestPenalty = entry.origin === "manifest" ? 0.1 : 0;
    return configuredSourceBonus + common * 1_000 - distance - orderPenalty - sourcePenalty - manifestPenalty;
  }
}

function readManifestTokens(parsed: unknown): ManifestTokenEntry[] {
  if (!parsed || typeof parsed !== "object") return [];
  const record = parsed as Record<string, unknown>;
  if (Array.isArray(record.tokens)) {
    return record.tokens.filter(isManifestTokenEntry);
  }

  const result: ManifestTokenEntry[] = [];
  for (const key of ["collections", "modes", "files"]) {
    const groups = record[key];
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      if (!group || typeof group !== "object") continue;
      const tokens = (group as Record<string, unknown>).tokens;
      if (Array.isArray(tokens)) {
        result.push(...tokens.filter(isManifestTokenEntry));
      }
    }
  }
  return result;
}

function isManifestTokenEntry(value: unknown): value is ManifestTokenEntry {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function readManifestCssVar(token: ManifestTokenEntry): string | null {
  if (typeof token.cssVar === "string" && token.cssVar.startsWith("--")) return token.cssVar;
  if (typeof token.name === "string" && token.name.trim()) {
    const name = token.name.trim();
    return name.startsWith("--") ? name : `--${name}`;
  }
  return null;
}

function stringifyManifestValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeManifestType(value: unknown): TokenType | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.trim() as TokenType;
}

function extractCssImports(content: string): string[] {
  const imports: string[] = [];
  const importRegex = /@import\s+(?:url\(\s*(?:(["'])(.*?)\1|([^)]*?))\s*\)|(["'])(.*?)\4)[^;]*;/g;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[2] ?? match[3] ?? match[5];
    if (importPath?.trim()) imports.push(importPath.trim());
  }
  return imports;
}

function inferType(value: string): TokenType {
  if (!value) return "text";

  const trimmed = value.trim();

  if (parseColor(trimmed)) return "color";

  if (/^(linear|radial|conic)-gradient\(/.test(trimmed)) return "gradient";

  if (/^\d+(\.\d+)?(px|rem|em)?\s+\d+(\.\d+)?(px|rem|em)?/.test(trimmed)
    && /rgba?\(|#[0-9a-fA-F]/.test(trimmed)) return "shadow";

  if (looksLikeTypography(trimmed)) return "typography";

  if (/^-?\d+(\.\d+)?(px|rem|em|%|vw|vh|pt|cm|mm|in|ch|ex)$/.test(trimmed)) return "dimension";

  if (/^-?\d+(\.\d+)?(ms|s)$/.test(trimmed)) return "duration";

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return "number";

  return "text";
}

function getLineOffsets(text: string): number[] {
  const offsets: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 10) offsets.push(i + 1);
  }
  return offsets;
}

function lineFromOffset(offset: number, offsets: number[]): number {
  let low = 0;
  let high = offsets.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (offsets[mid] <= offset) low = mid + 1;
    else high = mid - 1;
  }
  return Math.max(1, high + 1);
}

function looksLikeTypography(value: string): boolean {
  if (/font-family\s*:/.test(value)) return true;
  if (/font-weight\s*:/.test(value) && /font-size\s*:/.test(value)) return true;
  if (/\b(normal|italic|oblique)\b/.test(value) && /\d+(px|rem|em)(\/\d+(px|rem|em|%))?/.test(value)) return true;
  if (/\b\d{3}\b/.test(value) && /\d+(px|rem|em)(\/\d+(px|rem|em|%))?/.test(value)) return true;
  if (/\b[\w-]+,\s*[\w-]+/.test(value) && /\d+(px|rem|em)/.test(value)) return true;
  return false;
}

function shouldSkipDirectory(name: string): boolean {
  return name === "node_modules" || name === ".git" || name === "dist" || name === "build";
}

function isCssFile(fileName: string): boolean {
  return /\.(css|scss|less|sass)$/.test(fileName);
}

function addToSetMap(map: Map<string, Set<string>>, key: string, value: string): void {
  const bucket = map.get(key) ?? new Set<string>();
  bucket.add(path.resolve(value));
  map.set(key, bucket);
}

function sameSource(a: CssVarEntry, b: CssVarEntry): boolean {
  if (a.sourceName && b.sourceName && a.sourceName !== b.sourceName) return false;
  if (a.packageName && b.packageName && a.packageName !== b.packageName) return false;
  if (a.packageRoot && b.packageRoot && path.resolve(a.packageRoot) !== path.resolve(b.packageRoot)) return false;
  if ((a.sourceName || b.sourceName) && a.sourceName !== b.sourceName) return false;
  if ((a.packageName || b.packageName) && a.packageName !== b.packageName) return false;
  if ((a.packageRoot || b.packageRoot) && path.resolve(a.packageRoot ?? "") !== path.resolve(b.packageRoot ?? "")) return false;
  return true;
}

async function nearestExistingDirectory(targetPath: string): Promise<string> {
  let current = path.resolve(targetPath);
  try {
    const stat = await fs.stat(current);
    if (stat.isDirectory()) return current;
    current = path.dirname(current);
  } catch {
    current = path.dirname(current);
  }

  while (current && current !== path.dirname(current)) {
    try {
      const stat = await fs.stat(current);
      if (stat.isDirectory()) return current;
    } catch {
      current = path.dirname(current);
      continue;
    }
    current = path.dirname(current);
  }
  return current;
}

function originRank(origin: CssVarOrigin | undefined): number {
  if (origin === "workspace") return 0;
  if (origin === "source") return 1;
  return 2;
}

function matchesAnyPattern(filePath: string, workspaceRoots: string[], patterns: string[]): boolean {
  const normalizedAbs = normalizeSlashes(path.resolve(filePath));
  const candidates = new Set<string>([normalizedAbs]);
  for (const root of workspaceRoots) {
    const relative = path.relative(root, filePath);
    if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
      candidates.add(normalizeSlashes(relative));
    }
  }

  return patterns.some((pattern) => {
    const normalizedPattern = normalizeSlashes(pattern);
    const regex = globToRegExp(normalizedPattern);
    for (const candidate of candidates) {
      if (regex.test(candidate)) return true;
    }
    return false;
  });
}

function isPathInsideOrEqual(filePath: string, dirPath: string): boolean {
  const relative = path.relative(path.resolve(dirPath), path.resolve(filePath));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function globToRegExp(pattern: string): RegExp {
  let source = "^";
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    const next = pattern[i + 1];
    if (char === "*" && next === "*") {
      const after = pattern[i + 2];
      if (after === "/") {
        source += "(?:.*/)?";
        i += 2;
      } else {
        source += ".*";
        i++;
      }
      continue;
    }
    if (char === "*") {
      source += "[^/]*";
      continue;
    }
    if (char === "?") {
      source += "[^/]";
      continue;
    }
    source += escapeRegExp(char);
  }
  source += "$";
  return new RegExp(source);
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}

function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, "/");
}
