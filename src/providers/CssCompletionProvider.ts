/**
 * CssCompletionProvider completes CSS custom property names inside var(--...).
 */

import * as vscode from "vscode";
import type { ExtensionConfig } from "../core/types";
import type { CssVariableStore } from "../utils/cssVariableStore";

export class CssCompletionProvider implements vscode.CompletionItemProvider {
  constructor(
    private cssVarStore: CssVariableStore,
    private config: ExtensionConfig,
  ) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.CompletionItem[]> {
    if (!this.config.enableCssCompletion) return null;

    const range = getCssVarPrefixRange(document, position);
    if (!range) return null;

    const prefix = document.getText(range);
    const context = {
      documentPath: document.uri.fsPath,
      line: position.line + 1,
    };
    const names = this.cssVarStore.findVarNames(prefix, context, this.config.maxSuggestions);
    if (names.length === 0) return null;

    return names.map((name) => {
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Variable);
      item.range = range;
      item.insertText = name;

      const entry = this.cssVarStore.findVar(name, context);
      if (entry) {
        item.detail = entry.resolvedValue ?? entry.rawValue;
        item.documentation = new vscode.MarkdownString(
          [
            entry.sourceName ? `Source: \`${entry.sourceName}\`` : undefined,
            `Defined in: \`${entry.file.split("/").pop() ?? entry.file}\``,
          ].filter(Boolean).join("\n\n"),
        );
      }

      return item;
    });
  }
}

function getCssVarPrefixRange(document: vscode.TextDocument, position: vscode.Position): vscode.Range | null {
  const line = document.lineAt(position).text.slice(0, position.character);
  const varStart = line.lastIndexOf("var(");
  if (varStart === -1) return null;

  const fragment = line.slice(varStart);
  const match = /var\(\s*(--[\w-]*)?$/.exec(fragment);
  if (!match) return null;

  const prefix = match[1] ?? "";
  const start = position.character - prefix.length;
  return new vscode.Range(new vscode.Position(position.line, start), position);
}
