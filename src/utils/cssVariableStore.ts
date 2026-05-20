/**
 * CssVariableStore — parses CSS/SCSS files in the workspace to extract
 * native CSS custom property definitions (:root { --name: value }).
 * Provides resolution and type inference for hover previews.
 */

import * as fs from "fs/promises";
import * as path from "path";
import type { ResolvedToken, ResolvedSimple, ChainStep, TokenType } from "../core/types";
import { parseColor } from "./colorParser";

export interface CssVarEntry {
  name: string;
  rawValue: string;
  file: string;
  line: number;
}

interface CssResolveContext {
  documentPath?: string;
  line?: number;
}

export class CssVariableStore {
  private _vars = new Map<string, CssVarEntry[]>();
  private _fileOrder = new Map<string, number>();

  get size(): number {
    return this._vars.size;
  }

  async scanWorkspace(workspaceRoot: string): Promise<void> {
    await this.scanWorkspaces([workspaceRoot]);
  }

  async scanWorkspaces(workspaceRoots: string[]): Promise<void> {
    this._vars.clear();
    this._fileOrder.clear();
    const cssFiles: string[] = [];
    for (const root of workspaceRoots) {
      await this._collectCssFiles(root, 0, cssFiles);
    }

    // First pass: collect raw declarations from all files.
    for (let fileIndex = 0; fileIndex < cssFiles.length; fileIndex++) {
      const file = cssFiles[fileIndex];
      this._fileOrder.set(file, fileIndex);
      const entries = await this._parseFile(file);
      for (const entry of entries) {
        const bucket = this._vars.get(entry.name) ?? [];
        bucket.push(entry);
        this._vars.set(entry.name, bucket);
      }
    }
    for (const entries of this._vars.values()) {
      entries.sort((a, b) => this._entrySort(a, b));
    }
  }

  private async _collectCssFiles(dir: string, depth: number, out: string[]): Promise<void> {
    if (depth > 6) return;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist" || entry.name === "build") continue;
          await this._collectCssFiles(full, depth + 1, out);
        } else if (entry.isFile() && /\.(css|scss|less|sass)$/.test(entry.name)) {
          out.push(full);
        }
      }
    } catch {
      // skip inaccessible
    }
  }

  private async _parseFile(filePath: string): Promise<CssVarEntry[]> {
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

        result.push({
          name,
          rawValue,
          file: filePath,
          line: lineNum,
        });
      }
      return result;
    } catch {
      return [];
    }
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
        const resolved = this._resolveVarRefs(
          nextEntry.rawValue,
          { documentPath: nextEntry.file, line: nextEntry.line },
          visited,
        );
        visited.delete(nextVisitKey);
        return resolved;
      });
      iterations++;
    }
    return current;
  }

  findVar(cssVarName: string, context?: CssResolveContext): CssVarEntry | null {
    const entries = this._vars.get(cssVarName);
    if (!entries?.length) return null;
    if (!context?.documentPath) return entries[0];

    const contextPath = path.resolve(context.documentPath);
    const contextLine = context.line;

    let best: CssVarEntry | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const entry of entries) {
      const score = this._entryScore(entry, contextPath, contextLine);
      if (score > bestScore) {
        best = entry;
        bestScore = score;
      }
    }
    return best;
  }

  resolveToToken(cssVarName: string, context?: CssResolveContext): ResolvedToken | null {
    const entry = this.findVar(cssVarName, context);
    if (!entry) return null;

    const value = this._resolveVarRefs(
      entry.rawValue,
      { documentPath: entry.file, line: entry.line },
      new Set([`${cssVarName}@${entry.file}:${entry.line}`]),
    );
    const type = inferType(value);
    const chain = this._buildVarChain(
      cssVarName,
      { documentPath: entry.file, line: entry.line },
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

  private _buildVarChain(varName: string, context: CssResolveContext, visited: Set<string>): ChainStep[] {
    const entry = this.findVar(varName, context);
    if (!entry) return [];
    const visitKey = `${varName}@${entry.file}:${entry.line}`;
    if (visited.has(visitKey)) return [];
    visited.add(visitKey);

    const resolved = this._resolveVarRefs(
      entry.rawValue,
      { documentPath: entry.file, line: entry.line },
      new Set([visitKey]),
    );
    const type = inferType(resolved);
    const steps: ChainStep[] = [{ token: varName, file: entry.file, type }];
    const refs = Array.from(entry.rawValue.matchAll(/var\(\s*(--[\w-]+)\s*(?:,\s*[^)]*)?\)/g));
    for (const ref of refs) {
      const refName = ref[1];
      steps.push(...this._buildVarChain(
        refName,
        { documentPath: entry.file, line: entry.line },
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
    const orderPenalty = (this._fileOrder.get(entry.file) ?? 0) / 10_000;
    return common * 1_000 - distance - orderPenalty;
  }
}

function inferType(value: string): TokenType {
  if (!value) return "text";

  const trimmed = value.trim();

  if (parseColor(trimmed)) return "color";

  if (looksLikeTypography(trimmed)) return "typography";

  if (/^-?\d+(\.\d+)?(px|rem|em|%|vw|vh|pt|cm|mm|in|ch|ex)$/.test(trimmed)) return "dimension";

  if (/^-?\d+(\.\d+)?(ms|s)$/.test(trimmed)) return "duration";

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return "number";

  if (/^(linear|radial|conic)-gradient\(/.test(trimmed)) return "gradient";

  if (/^\d+(\.\d+)?(px|rem|em)?\s+\d+(\.\d+)?(px|rem|em)?/.test(trimmed)
    && /rgba?\(|#[0-9a-fA-F]/.test(trimmed)) return "shadow";

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
