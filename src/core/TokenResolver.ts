/**
 * TokenResolver — resolves token references, builds resolution chains,
 * computes final values with math evaluation.
 */

import type {
  TokenEntry,
  ChainStep,
  ResolvedToken,
  ResolvedSimple,
  ResolvedComposite,
  ResolvedProperty,
} from "./types";
import { NUMERIC_TYPES, COMPOSITE_TYPES } from "./constants";
import { evaluateMath } from "../utils/mathEvaluator";
import type { TokenStore } from "./TokenStore";

export class TokenResolver {
  private store: TokenStore;
  private resolveCache = new Map<string, ResolvedToken>();
  private chainCache = new Map<string, ChainStep[]>();

  constructor(store: TokenStore) {
    this.store = store;
  }

  clearCache(): void {
    this.resolveCache.clear();
    this.chainCache.clear();
  }

  /** Resolve a token reference like "{color.primary}" or just "color.primary". */
  resolve(tokenRef: string, contextPath?: string): ResolvedToken | null {
    const key = tokenRef.replace(/[{}]/g, "").trim();
    if (!key) return null;
    const scopeKey = this.store.getScopeKey(contextPath);
    const cacheKey = `${scopeKey}::${key}`;

    const cached = this.resolveCache.get(cacheKey);
    if (cached) return cached;

    const result = this._resolve(key, contextPath, scopeKey);
    if (result) this.resolveCache.set(cacheKey, result);
    return result;
  }

  private _resolve(originalKey: string, contextPath: string | undefined, scopeKey: string): ResolvedToken | null {
    const originalEntry = this.store.getEntry(originalKey, contextPath);
    if (!originalEntry) return null;

    const terminalKey = this._followAlias(originalKey, contextPath);
    const terminalEntry = this.store.getEntry(terminalKey, contextPath) ?? originalEntry;
    const chain = this._buildChain(originalKey, contextPath, scopeKey);

    if (this._isCompositeValue(terminalEntry)) {
      return this._resolveComposite(originalKey, terminalEntry, chain, contextPath, scopeKey);
    }

    return this._resolveSimple(originalKey, terminalKey, terminalEntry, originalEntry, chain, contextPath);
  }

  private _resolveSimple(
    originalKey: string,
    terminalKey: string,
    terminalEntry: TokenEntry,
    originalEntry: TokenEntry,
    chain: ChainStep[],
    contextPath: string | undefined,
  ): ResolvedSimple {
    const finalValue = this._computeValue(terminalKey, terminalEntry, contextPath);
    const rawValue = this._stringifyValue(originalEntry.value);

    return {
      kind: "simple",
      type: terminalEntry.type,
      tokenKey: originalKey,
      rawValue,
      finalValue,
      chain,
      file: originalEntry.file ?? terminalEntry.file,
      extensions: originalEntry.extensions ?? terminalEntry.extensions,
    };
  }

  private _resolveComposite(
    originalKey: string,
    entry: TokenEntry,
    _chain: ChainStep[],
    contextPath: string | undefined,
    scopeKey: string,
  ): ResolvedComposite {
    const value = entry.value;
    const props: Record<string, ResolvedProperty> = {};

    if (Array.isArray(value)) {
      // boxShadow / effects array
      value.forEach((item: Record<string, unknown>, idx: number) => {
        if (typeof item === "object" && item !== null) {
          for (const [prop, propVal] of Object.entries(item)) {
            const propKey = `${idx + 1}.${prop}`;
            props[propKey] = this._resolveProperty(propVal, contextPath, scopeKey);
          }
        }
      });
    } else if (typeof value === "object" && value !== null) {
      for (const [prop, propVal] of Object.entries(value as Record<string, unknown>)) {
        props[prop] = this._resolveProperty(propVal, contextPath, scopeKey);
      }
    }

    const originalEntry = this.store.getEntry(originalKey, contextPath);
    return {
      kind: "composite",
      type: entry.type,
      tokenKey: originalKey,
      props,
      file: originalEntry?.file ?? entry.file,
      extensions: originalEntry?.extensions ?? entry.extensions,
    };
  }

  private _resolveProperty(raw: unknown, contextPath: string | undefined, scopeKey: string): ResolvedProperty {
    if (typeof raw === "string" && raw.startsWith("{") && raw.endsWith("}")) {
      const refKey = raw.slice(1, -1);
      const refEntry = this.store.getEntry(refKey, contextPath);
      return {
        rawValue: raw,
        resolvedValue: this._computeValue(refKey, refEntry ?? null, contextPath),
        chain: this._buildChain(refKey, contextPath, scopeKey),
        type: refEntry?.type,
      };
    }

    if (typeof raw === "string" && /{[^}]+}/.test(raw)) {
      const resolved = this._resolveAllRefs(raw, contextPath);
      return { rawValue: raw, resolvedValue: resolved, chain: [], type: undefined };
    }

    const strVal = raw === null || raw === undefined ? "" : String(raw);
    return { rawValue: strVal, resolvedValue: strVal, chain: [], type: undefined };
  }

  /** Follow alias chain to the terminal (non-alias) token. */
  private _followAlias(key: string, contextPath: string | undefined, visited = new Set<string>()): string {
    if (visited.has(key)) return key;
    visited.add(key);

    const entry = this.store.getEntry(key, contextPath);
    if (!entry) return key;

    const val = entry.value;
    if (typeof val === "string" && val.startsWith("{") && val.endsWith("}")) {
      const next = val.slice(1, -1);
      if (this.store.getEntry(next, contextPath)) {
        return this._followAlias(next, contextPath, visited);
      }
    }
    return key;
  }

  /** Compute final value for a token. */
  private _computeValue(key: string, entry: TokenEntry | null, contextPath: string | undefined): string {
    if (!entry) return `{${key}}`;

    const val = entry.value;
    if (typeof val !== "string") return JSON.stringify(val);

    const resolved = this._resolveAllRefs(val, contextPath);

    if (NUMERIC_TYPES.has(entry.type)) {
      const unit = entry.type === "number" || entry.type === "opacity" ? "" : "px";
      return evaluateMath(resolved, unit);
    }

    return resolved;
  }

  private _stringifyValue(value: unknown): string {
    if (typeof value === "string") return value;
    if (value === null || value === undefined) return "";
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  /** Replace all {ref} substrings with their resolved values. */
  private _resolveAllRefs(str: string, contextPath: string | undefined): string {
    let prev = "";
    let iterations = 0;
    let current = str;
    while (current !== prev && iterations < 20) {
      prev = current;
      current = current.replace(/{([^}]+)}/g, (_, refKey: string) => {
        const entry = this.store.getEntry(refKey, contextPath);
        if (!entry) return `{${refKey}}`;
        const val = entry.value;
        return typeof val === "string" ? val : String(val);
      });
      iterations++;
    }
    return current;
  }

  /** Build resolution chain (array of steps from root to terminal). */
  private _buildChain(
    key: string,
    contextPath: string | undefined,
    scopeKey: string,
    visited = new Set<string>(),
  ): ChainStep[] {
    const cacheKey = `${scopeKey}::${key}`;
    const cached = this.chainCache.get(cacheKey);
    if (cached) return cached;

    if (visited.has(key)) return [];
    visited.add(key);

    const entry = this.store.getEntry(key, contextPath);
    if (!entry) return [];

    const step: ChainStep = { token: key, file: entry.file, type: entry.type };

    const val = entry.value;
    if (typeof val === "string" && val.startsWith("{") && val.endsWith("}")) {
      const next = val.slice(1, -1);
      const rest = this._buildChain(next, contextPath, scopeKey, visited);
      const chain = [step, ...rest];
      this.chainCache.set(cacheKey, chain);
      return chain;
    }

    if (typeof val === "string" && /{[^}]+}/.test(val)) {
      const refs = Array.from(val.matchAll(/{([^}]+)}/g));
      const nested = refs.flatMap((m) => this._buildChain(m[1], contextPath, scopeKey, visited));
      const chain = [step, ...nested];
      this.chainCache.set(cacheKey, chain);
      return chain;
    }

    const chain = [step];
    this.chainCache.set(cacheKey, chain);
    return chain;
  }

  private _isCompositeValue(entry: TokenEntry): boolean {
    if (COMPOSITE_TYPES.has(entry.type)) {
      const val = entry.value;
      return typeof val === "object" && val !== null;
    }
    return false;
  }
}
