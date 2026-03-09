/**
 * CssHoverProvider — hover tooltips for var(--token-name) in CSS/SCSS/TSX/etc.
 * 1. Tries to reverse-map the CSS variable to a JSON design token
 * 2. Falls back to resolving native CSS custom properties from :root definitions
 */

import * as vscode from "vscode";
import type { ExtensionConfig } from "../core/types";
import type { TokenResolver } from "../core/TokenResolver";
import type { TokenStore } from "../core/TokenStore";
import type { CssMapping } from "../utils/cssMapping";
import type { CssVariableStore } from "../utils/cssVariableStore";
import { buildHover } from "../hover/HoverBuilder";

export const CSS_LANGUAGES: vscode.DocumentSelector = [
  { language: "css", scheme: "file" },
  { language: "scss", scheme: "file" },
  { language: "less", scheme: "file" },
  { language: "sass", scheme: "file" },
  { language: "typescript", scheme: "file" },
  { language: "typescriptreact", scheme: "file" },
  { language: "javascript", scheme: "file" },
  { language: "javascriptreact", scheme: "file" },
  { language: "vue", scheme: "file" },
  { language: "svelte", scheme: "file" },
  { language: "html", scheme: "file" },
];

const VAR_PATTERN = /var\(\s*(--[\w-]+)\s*(?:,\s*[^)]*)?\)/;

export class CssHoverProvider implements vscode.HoverProvider {
  constructor(
    private resolver: TokenResolver,
    private store: TokenStore,
    private cssMapping: CssMapping,
    private cssVarStore: CssVariableStore,
    private config: ExtensionConfig,
  ) {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Hover> {
    if (!this.config.enableCssHover) return null;

    const range = document.getWordRangeAtPosition(position, /var\(\s*--[\w-]+\s*(?:,\s*[^)]*)?\)/);
    if (!range) return null;

    const text = document.getText(range);
    const match = VAR_PATTERN.exec(text);
    if (!match) return null;

    const cssVarName = match[1];

    // Strategy 1: JSON design token mapping
    const tokenKey = this.cssMapping.findToken(cssVarName);
    if (tokenKey) {
      const resolved = this.resolver.resolve(tokenKey);
      if (resolved) {
        const md = buildHover(resolved, this.config, this.store.tokenDirs);
        return new vscode.Hover(md, range);
      }
    }

    // Strategy 2: Native CSS custom property from :root
    const cssResolved = this.cssVarStore.resolveToToken(cssVarName);
    if (cssResolved) {
      const md = buildHover(cssResolved, this.config, this.store.tokenDirs);
      return new vscode.Hover(md, range);
    }

    return null;
  }
}
