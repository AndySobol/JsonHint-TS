/**
 * TokenStore — loads, flattens and caches design tokens from JSON files.
 * Supports multiple token folders and file watching.
 */

import * as path from "path";
import * as fs from "fs/promises";
import type { TokenEntry, TokenType, ExtensionConfig } from "./types";
import { normalizeType } from "./constants";

export class TokenStore {
  private _mapping: Map<string, TokenEntry> = new Map();
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

  configure(workspaceRoot: string, config: ExtensionConfig): void {
    this._allowNoDollar = config.allowNoDollar;
    this._tokenDirs = config.tokenPaths.map((p) =>
      path.isAbsolute(p) ? p : path.join(workspaceRoot, p),
    );
  }

  async load(): Promise<void> {
    this._mapping.clear();
    for (const dir of this._tokenDirs) {
      await this._walkDir(dir);
    }
    console.log(`[SXL Resolver] Loaded ${this._mapping.size} tokens from ${this._tokenDirs.length} folder(s)`);
  }

  private async _walkDir(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await this._walkDir(full);
        } else if (entry.isFile() && full.endsWith(".json")) {
          await this._parseFile(full, dir);
        }
      }
    } catch {
      // Directory may not exist yet — that's fine
    }
  }

  private async _parseFile(filePath: string, _baseDir: string): Promise<void> {
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const json = JSON.parse(raw) as Record<string, unknown>;
      this._flatten(json, "", filePath, null);
    } catch (e) {
      console.error(`[SXL Resolver] Error parsing ${filePath}:`, e);
    }
  }

  private _flatten(
    obj: Record<string, unknown>,
    prefix: string,
    file: string,
    inheritedType: string | null,
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

        this._mapping.set(newKey, {
          value: rawValue,
          type,
          file,
          extensions: rawExt as TokenEntry["extensions"],
        });
      }

      this._flatten(record, newKey, file, nextType);
    }
  }

  /** Find all token keys matching a prefix. */
  findByPrefix(prefix: string): string[] {
    const results: string[] = [];
    for (const key of this._mapping.keys()) {
      if (key.startsWith(prefix)) results.push(key);
    }
    return results;
  }

  /** Get the absolute path for a token file reference. */
  getAbsolutePath(file: string): string | null {
    if (path.isAbsolute(file)) return file;
    for (const dir of this._tokenDirs) {
      return path.join(dir, file);
    }
    return null;
  }
}
