/**
 * TokenResolver — resolves token references, builds resolution chains,
 * computes final values with math evaluation.
 */

import type {
  TokenEntry,
  TokenType,
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
  resolve(tokenRef: string): ResolvedToken | null {
    const key = tokenRef.replace(/[{}]/g, "").trim();
    if (!key) return null;

    const cached = this.resolveCache.get(key);
    if (cached) return cached;

    const result = this._resolve(key);
    if (result) this.resolveCache.set(key, result);
    return result;
  }

  private _resolve(originalKey: string): ResolvedToken | null {
    const entry = this.store.mapping.get(originalKey);
    if (!entry) return null;

    const terminalKey = this._followAlias(originalKey);
    const terminalEntry = this.store.mapping.get(terminalKey) ?? entry;
    const chain = this._buildChain(originalKey);

    if (this._isCompositeValue(terminalEntry)) {
      return this._resolveComposite(originalKey, terminalEntry, chain);
    }

    return this._resolveSimple(originalKey, terminalKey, terminalEntry, chain);
  }

  private _resolveSimple(
    originalKey: string,
    terminalKey: string,
    entry: TokenEntry,
    chain: ChainStep[],
  ): ResolvedSimple {
    let finalValue = this._computeValue(terminalKey, entry);

    return {
      kind: "simple",
      type: entry.type,
      tokenKey: originalKey,
      finalValue,
      chain,
      file: this.store.mapping.get(originalKey)?.file ?? entry.file,
      extensions: this.store.mapping.get(originalKey)?.extensions ?? entry.extensions,
    };
  }

  private _resolveComposite(
    originalKey: string,
    entry: TokenEntry,
    chain: ChainStep[],
  ): ResolvedComposite {
    const value = entry.value;
    const props: Record<string, ResolvedProperty> = {};

    if (Array.isArray(value)) {
      // boxShadow / effects array
      value.forEach((item: Record<string, unknown>, idx: number) => {
        if (typeof item === "object" && item !== null) {
          for (const [prop, propVal] of Object.entries(item)) {
            const propKey = `${idx + 1}.${prop}`;
            props[propKey] = this._resolveProperty(propVal);
          }
        }
      });
    } else if (typeof value === "object" && value !== null) {
      for (const [prop, propVal] of Object.entries(value as Record<string, unknown>)) {
        props[prop] = this._resolveProperty(propVal);
      }
    }

    return {
      kind: "composite",
      type: entry.type,
      tokenKey: originalKey,
      props,
      file: this.store.mapping.get(originalKey)?.file ?? entry.file,
      extensions: this.store.mapping.get(originalKey)?.extensions ?? entry.extensions,
    };
  }

  private _resolveProperty(raw: unknown): ResolvedProperty {
    if (typeof raw === "string" && raw.startsWith("{") && raw.endsWith("}")) {
      const refKey = raw.slice(1, -1);
      const refEntry = this.store.mapping.get(refKey);
      return {
        rawValue: raw,
        resolvedValue: this._computeValue(refKey, refEntry ?? null),
        chain: this._buildChain(refKey),
        type: refEntry?.type,
      };
    }

    if (typeof raw === "string" && /{[^}]+}/.test(raw)) {
      const resolved = this._resolveAllRefs(raw);
      return { rawValue: raw, resolvedValue: resolved, chain: [], type: undefined };
    }

    const strVal = raw === null || raw === undefined ? "" : String(raw);
    return { rawValue: strVal, resolvedValue: strVal, chain: [], type: undefined };
  }

  /** Follow alias chain to the terminal (non-alias) token. */
  private _followAlias(key: string, visited = new Set<string>()): string {
    if (visited.has(key)) return key;
    visited.add(key);

    const entry = this.store.mapping.get(key);
    if (!entry) return key;

    const val = entry.value;
    if (typeof val === "string" && val.startsWith("{") && val.endsWith("}")) {
      const next = val.slice(1, -1);
      if (this.store.mapping.has(next)) {
        return this._followAlias(next, visited);
      }
    }
    return key;
  }

  /** Compute final value for a token. */
  private _computeValue(key: string, entry: TokenEntry | null): string {
    if (!entry) return `{${key}}`;

    const val = entry.value;
    if (typeof val !== "string") return JSON.stringify(val);

    const resolved = this._resolveAllRefs(val);

    if (NUMERIC_TYPES.has(entry.type)) {
      const unit = entry.type === "number" || entry.type === "opacity" ? "" : "px";
      return evaluateMath(resolved, unit);
    }

    return resolved;
  }

  /** Replace all {ref} substrings with their resolved values. */
  private _resolveAllRefs(str: string): string {
    let prev = "";
    let iterations = 0;
    let current = str;
    while (current !== prev && iterations < 20) {
      prev = current;
      current = current.replace(/{([^}]+)}/g, (_, refKey: string) => {
        const entry = this.store.mapping.get(refKey);
        if (!entry) return `{${refKey}}`;
        const val = entry.value;
        return typeof val === "string" ? val : String(val);
      });
      iterations++;
    }
    return current;
  }

  /** Build resolution chain (array of steps from root to terminal). */
  private _buildChain(key: string, visited = new Set<string>()): ChainStep[] {
    const cached = this.chainCache.get(key);
    if (cached) return cached;

    if (visited.has(key)) return [];
    visited.add(key);

    const entry = this.store.mapping.get(key);
    if (!entry) return [];

    const step: ChainStep = { token: key, file: entry.file, type: entry.type };

    const val = entry.value;
    if (typeof val === "string" && val.startsWith("{") && val.endsWith("}")) {
      const next = val.slice(1, -1);
      const rest = this._buildChain(next, visited);
      const chain = [step, ...rest];
      this.chainCache.set(key, chain);
      return chain;
    }

    if (typeof val === "string" && /{[^}]+}/.test(val)) {
      const refs = Array.from(val.matchAll(/{([^}]+)}/g));
      const nested = refs.flatMap((m) => this._buildChain(m[1], visited));
      const chain = [step, ...nested];
      this.chainCache.set(key, chain);
      return chain;
    }

    const chain = [step];
    this.chainCache.set(key, chain);
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
