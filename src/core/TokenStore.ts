/**
 * TokenStore — loads, flattens and caches design tokens from JSON files.
 * Supports multiple token folders and file watching.
 */

import * as path from "path";
import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as jsonc from "jsonc-parser";
import type { TokenEntry, TokenType, ExtensionConfig } from "./types";
import { normalizeType } from "./constants";

export class TokenStore {
  private _mapping: Map<string, TokenEntry> = new Map();
  private _mappingByDir: Map<string, Map<string, TokenEntry>> = new Map();
  private _tokenDirs: string[] = [];
  private _allowNoDollar = true;

  get mapping(): Map<string, TokenEntry> {
    return this._mapping;
  }

  get tokenDirs(): string[] {
    return this._tokenDirs;
  }

  get size(): number {
    return this._mapping.size;
  }

  configure(workspaceRoots: string[] | string, config: ExtensionConfig): void {
    const roots = Array.isArray(workspaceRoots) ? workspaceRoots : [workspaceRoots];
    this._allowNoDollar = config.allowNoDollar;
    const dirs = new Set<string>();
    for (const root of roots) {
      for (const tokenPath of config.tokenPaths) {
        const dir = path.isAbsolute(tokenPath) ? tokenPath : path.join(root, tokenPath);
        dirs.add(path.resolve(dir));
      }
    }
    this._tokenDirs = Array.from(dirs);
  }

  async load(): Promise<void> {
    this._mapping.clear();
    this._mappingByDir.clear();
    for (const dir of this._tokenDirs) {
      this._mappingByDir.set(dir, new Map());
      await this._walkDir(dir, dir);
    }
  }

  private async _walkDir(dir: string, tokenDir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await this._walkDir(full, tokenDir);
        } else if (entry.isFile() && (full.endsWith(".json") || full.endsWith(".jsonc"))) {
          await this._parseFile(full, tokenDir);
        }
      }
    } catch {
      // Directory may not exist yet — that's fine
    }
  }

  private async _parseFile(filePath: string, tokenDir: string): Promise<void> {
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const errors: jsonc.ParseError[] = [];
      const json = jsonc.parse(raw, errors, { allowTrailingComma: true }) as Record<string, unknown>;
      if (errors.length > 0 || !json || typeof json !== "object" || Array.isArray(json)) {
        return;
      }
      const dirMap = this._mappingByDir.get(tokenDir);
      if (!dirMap) return;
      this._flatten(json, "", filePath, null, dirMap);
    } catch (e) {
      console.error(`[SXL Resolver] Error parsing ${filePath}:`, e);
    }
  }

  private _flatten(
    obj: Record<string, unknown>,
    prefix: string,
    file: string,
    inheritedType: string | null,
    targetMap: Map<string, TokenEntry>,
  ): void {
    for (const key of Object.keys(obj)) {
      if (key === "$type" || key === "$value" || key === "$extensions" || key === "$description") continue;
      if (this._allowNoDollar && (key === "type" || key === "value" || key === "extensions")) continue;

      const val = obj[key];
      if (typeof val !== "object" || val === null) continue;

      const record = val as Record<string, unknown>;
      const newKey = prefix ? `${prefix}.${key}` : key;

      const nextType = (record.$type as string | undefined)
        ?? (this._allowNoDollar ? (record.type as string | undefined) : undefined)
        ?? inheritedType;

      const hasValue = "$value" in record || (this._allowNoDollar && "value" in record);
      if (hasValue) {
        const rawValue = record.$value ?? (this._allowNoDollar ? record.value : undefined);
        const rawExt = record.$extensions ?? (this._allowNoDollar ? record.extensions : undefined);
        const type = nextType ? normalizeType(nextType) : ("text" as TokenType);
        const tokenEntry: TokenEntry = {
          value: rawValue,
          type,
          file,
          extensions: rawExt as TokenEntry["extensions"],
        };
        targetMap.set(newKey, tokenEntry);
        if (!this._mapping.has(newKey)) {
          this._mapping.set(newKey, tokenEntry);
        }
      }

      this._flatten(record, newKey, file, nextType, targetMap);
    }
  }

  /** Find all token keys matching a prefix. */
  findByPrefix(prefix: string, contextPath?: string): string[] {
    const scoped = this.getScopedMapping(contextPath);
    const scopedMatches: string[] = [];
    for (const key of scoped.keys()) {
      if (key.startsWith(prefix)) scopedMatches.push(key);
    }
    if (scopedMatches.length > 0) return scopedMatches;

    const results: string[] = [];
    for (const key of this._mapping.keys()) {
      if (key.startsWith(prefix)) results.push(key);
    }
    return results;
  }

  getEntry(tokenKey: string, contextPath?: string): TokenEntry | null {
    const scoped = this.getScopedMapping(contextPath);
    return scoped.get(tokenKey) ?? this._mapping.get(tokenKey) ?? null;
  }

  getScopeKey(contextPath?: string): string {
    const scope = this.resolveScope(contextPath);
    return scope ?? "__global__";
  }

  getScopedMapping(contextPath?: string): Map<string, TokenEntry> {
    const scope = this.resolveScope(contextPath);
    if (scope) {
      return this._mappingByDir.get(scope) ?? this._mapping;
    }
    return this._mapping;
  }

  /** Get the absolute path for a token file reference. */
  getAbsolutePath(file: string): string | null {
    if (path.isAbsolute(file)) return file;
    for (const dir of this._tokenDirs) {
      const candidate = path.join(dir, file);
      if (fsSync.existsSync(candidate)) return candidate;
    }
    return null;
  }

  private resolveScope(contextPath?: string): string | null {
    if (!contextPath || this._tokenDirs.length === 0) return this._tokenDirs[0] ?? null;
    const absContext = path.resolve(contextPath);
    const directMatches = this._tokenDirs
      .filter((dir) => isPathInside(absContext, dir))
      .sort((a, b) => b.length - a.length);
    if (directMatches.length > 0) return directMatches[0];

    let bestScope: string | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const scope of this._tokenDirs) {
      const score = scorePathProximity(absContext, scope);
      if (score > bestScore) {
        bestScore = score;
        bestScope = scope;
      }
    }
    return bestScope;
  }
}

function isPathInside(filePath: string, dirPath: string): boolean {
  const rel = path.relative(path.resolve(dirPath), path.resolve(filePath));
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function scorePathProximity(filePath: string, dirPath: string): number {
  const fileParts = path.dirname(path.resolve(filePath)).split(path.sep).filter(Boolean);
  const dirParts = path.resolve(dirPath).split(path.sep).filter(Boolean);
  let common = 0;
  const maxCommon = Math.min(fileParts.length, dirParts.length);
  while (common < maxCommon && fileParts[common] === dirParts[common]) {
    common++;
  }
  const distance = (fileParts.length - common) + (dirParts.length - common);
  return common * 1000 - distance;
}
