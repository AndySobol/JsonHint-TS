/**
 * DefinitionProvider — Ctrl+Click go-to-definition for {token.ref} in JSON
 * and var(--token-name) in CSS/SCSS/TSX.
 */

import * as vscode from "vscode";
import * as jsonc from "jsonc-parser";
import type { TokenStore } from "../core/TokenStore";
import type { CssMapping } from "../utils/cssMapping";
import type { CssVariableStore } from "../utils/cssVariableStore";

export class DefinitionProvider implements vscode.DefinitionProvider {
  constructor(
    private store: TokenStore,
    private cssMapping: CssMapping,
    private cssVarStore: CssVariableStore,
  ) {}

  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Location | null> {
    const cssVarName = this.extractCssVarName(document, position);
    if (cssVarName) {
      const cssVarEntry = this.cssVarStore.findVar(cssVarName, {
        documentPath: document.uri.fsPath,
        line: position.line + 1,
      });
      if (cssVarEntry) {
        const targetUri = vscode.Uri.file(cssVarEntry.file);
        const targetPos = new vscode.Position(Math.max(0, cssVarEntry.line - 1), 0);
        return new vscode.Location(targetUri, targetPos);
      }
    }

    const tokenKey = this.extractTokenKey(document, position);
    if (!tokenKey) return null;

    const entry = this.store.getEntry(tokenKey, document.uri.fsPath);
    if (!entry) return null;

    const absPath = this.store.getAbsolutePath(entry.file);
    if (!absPath) return null;

    try {
      const doc = await vscode.workspace.openTextDocument(absPath);
      const root = jsonc.parseTree(doc.getText());
      if (!root) return new vscode.Location(doc.uri, new vscode.Position(0, 0));

      const tokenParts = tokenKey.split(".");
      const node = findTokenNode(root, tokenParts);
      if (node?.children?.[0]) {
        const keyNode = node.children[0];
        const pos = doc.positionAt(keyNode.offset);
        return new vscode.Location(doc.uri, pos);
      }

      return new vscode.Location(doc.uri, new vscode.Position(0, 0));
    } catch {
      return null;
    }
  }

  private extractTokenKey(document: vscode.TextDocument, position: vscode.Position): string | null {
    // JSON: {token.ref}
    const jsonRange = document.getWordRangeAtPosition(position, /\{[^}]+\}/);
    if (jsonRange) {
      return document.getText(jsonRange).replace(/[{}]/g, "").trim();
    }

    // CSS: var(--token-name)
    const cssRange = document.getWordRangeAtPosition(position, /var\(\s*--[\w-]+\s*(?:,\s*[^)]*)?\)/);
    if (cssRange) {
      const text = document.getText(cssRange);
      const match = text.match(/var\(\s*(--[\w-]+)\s*(?:,\s*[^)]*)?\)/);
      if (match) {
        return this.cssMapping.findToken(match[1]);
      }
    }

    return null;
  }

  private extractCssVarName(document: vscode.TextDocument, position: vscode.Position): string | null {
    const cssRange = document.getWordRangeAtPosition(position, /var\(\s*--[\w-]+\s*(?:,\s*[^)]*)?\)/);
    if (!cssRange) return null;
    const text = document.getText(cssRange);
    const match = text.match(/var\(\s*(--[\w-]+)\s*(?:,\s*[^)]*)?\)/);
    return match?.[1] ?? null;
  }
}

function findTokenNode(node: jsonc.Node, parts: string[]): jsonc.Node | null {
  if (!node || parts.length === 0) return null;
  if (node.type === "object" && node.children) {
    for (const prop of node.children) {
      if (prop.type === "property" && prop.children?.[0]?.value === parts[0]) {
        if (parts.length === 1) return prop;
        return findTokenNode(prop.children[1], parts.slice(1));
      }
    }
  }
  return null;
}
