/**
 * Reverse mapping: CSS variable names -> token paths.
 * Uses $extensions.figma.codeSyntax.Web when available,
 * falls back to kebab-case conversion (only for multi-segment token paths).
 */

import type { TokenEntry } from "../core/types";

export class CssMapping {
  private _cssToToken = new Map<string, string>();
  private _tokenToCss = new Map<string, string>();

  rebuild(mapping: Map<string, TokenEntry>, prefix: string): void {
    this._cssToToken.clear();
    this._tokenToCss.clear();

    for (const [tokenKey, entry] of mapping) {
      const webSyntax = entry.extensions?.figma?.codeSyntax?.Web;

      let cssVar: string | null = null;

      if (typeof webSyntax === "string" && webSyntax.length > 0) {
        cssVar = extractVarName(webSyntax);
      } else if (tokenKey.includes(".")) {
        cssVar = prefix + tokenPathToKebab(tokenKey);
      }

      if (cssVar) {
        this._cssToToken.set(cssVar, tokenKey);
        this._tokenToCss.set(tokenKey, cssVar);
      }
    }
  }

  findToken(cssVarName: string): string | null {
    return this._cssToToken.get(cssVarName)
      ?? this._cssToToken.get(cssVarName.replace(/^--/, ""))
      ?? null;
  }

  getCssVar(tokenKey: string): string | null {
    return this._tokenToCss.get(tokenKey) ?? null;
  }
}

function tokenPathToKebab(tokenPath: string): string {
  return tokenPath.replace(/\./g, "-").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

function extractVarName(syntax: string): string {
  const match = syntax.match(/var\(\s*(--[\w-]+)\s*\)/);
  if (match) return match[1];
  if (syntax.startsWith("--")) return syntax;
  return `--${tokenPathToKebab(syntax)}`;
}
