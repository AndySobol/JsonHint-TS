/**
 * JsonHoverProvider — hover tooltips for {token.ref} in JSON/JSONC files.
 */

import * as vscode from "vscode";
import type { ExtensionConfig } from "../core/types";
import type { TokenResolver } from "../core/TokenResolver";
import type { TokenStore } from "../core/TokenStore";
import { buildHover } from "../hover/HoverBuilder";

export class JsonHoverProvider implements vscode.HoverProvider {
  constructor(
    private resolver: TokenResolver,
    private store: TokenStore,
    private config: ExtensionConfig,
  ) {}

  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.Hover> {
    const range = document.getWordRangeAtPosition(position, /\{[^}]+\}/);
    if (!range) return null;

    const tokenRef = document.getText(range);
    const resolved = this.resolver.resolve(tokenRef);
    if (!resolved) return null;

    const md = buildHover(resolved, this.config, this.store.tokenDirs);
    return new vscode.Hover(md, range);
  }
}
