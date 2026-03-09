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
  value: string;
  file: string;
  line: number;
}

export class CssVariableStore {
  private _vars = new Map<string, CssVarEntry>();

  get size(): number {
    return this._vars.size;
  }

  async scanWorkspace(workspaceRoot: string): Promise<void> {
    this._vars.clear();
    await this._walkDir(workspaceRoot, 0);
  }

  private async _walkDir(dir: string, depth: number): Promise<void> {
    if (depth > 6) return;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist" || entry.name === "build") continue;
          await this._walkDir(full, depth + 1);
        } else if (entry.isFile() && /\.(css|scss|less|sass)$/.test(entry.name)) {
          await this._parseFile(full);
        }
      }
    } catch {
      // skip inaccessible
    }
  }

  private async _parseFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const varRegex = /--([a-zA-Z][\w-]*)\s*:\s*([^;}{]+)/g;
      let match: RegExpExecArray | null;
      const lines = content.split("\n");

      while ((match = varRegex.exec(content)) !== null) {
        const name = `--${match[1]}`;
        const rawValue = match[2].trim();
        const offset = match.index;
        let lineNum = 0;
        let pos = 0;
        for (let i = 0; i < lines.length; i++) {
          pos += lines[i].length + 1;
          if (pos > offset) { lineNum = i + 1; break; }
        }

        const resolved = this._resolveVarRefs(rawValue);

        this._vars.set(name, {
          name,
          value: resolved,
          file: filePath,
          line: lineNum,
        });
      }
    } catch {
      // skip
    }
  }

  private _resolveVarRefs(value: string): string {
    let current = value;
    let iterations = 0;
    let prev = "";
    while (current !== prev && iterations < 10) {
      prev = current;
      current = current.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (_, varName: string, fallback?: string) => {
        const entry = this._vars.get(varName);
        if (entry) return entry.value;
        if (fallback) return fallback.trim();
        return `var(${varName})`;
      });
      iterations++;
    }
    return current;
  }

  findVar(cssVarName: string): CssVarEntry | null {
    return this._vars.get(cssVarName) ?? null;
  }

  resolveToToken(cssVarName: string): ResolvedToken | null {
    const entry = this.findVar(cssVarName);
    if (!entry) return null;

    const value = entry.value;
    const type = inferType(value);

    const chain: ChainStep[] = [{ token: cssVarName, file: entry.file, type }];

    const result: ResolvedSimple = {
      kind: "simple",
      type,
      tokenKey: cssVarName,
      finalValue: value,
      chain,
      file: entry.file,
    };

    return result;
  }
}

function inferType(value: string): TokenType {
  if (!value) return "text";

  if (parseColor(value)) return "color";

  if (/^-?\d+(\.\d+)?(px|rem|em|%|vw|vh|pt|cm|mm|in|ch|ex)$/.test(value.trim())) return "dimension";

  if (/^-?\d+(\.\d+)?(ms|s)$/.test(value.trim())) return "duration";

  if (/^-?\d+(\.\d+)?$/.test(value.trim())) return "number";

  if (/^(linear|radial|conic)-gradient\(/.test(value.trim())) return "gradient";

  if (/^\d+(\.\d+)?(px|rem|em)?\s+\d+(\.\d+)?(px|rem|em)?/.test(value.trim())
    && /rgba?\(|#[0-9a-fA-F]/.test(value)) return "shadow";

  return "text";
}
