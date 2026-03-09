/**
 * CompletionProvider — autocomplete for token references inside "$value": "{..."
 * Type-aware: filters candidates by the nearest $type.
 */

import * as vscode from "vscode";
import * as jsonc from "jsonc-parser";
import type { ExtensionConfig } from "../core/types";
import type { TokenResolver } from "../core/TokenResolver";
import type { TokenStore } from "../core/TokenStore";
import { TOKEN_ICONS, VALID_TYPES } from "../core/constants";
import { renderColorCircle, colorValueLine } from "../preview/ColorPreview";

export class CompletionProvider implements vscode.CompletionItemProvider {
  constructor(
    private resolver: TokenResolver,
    private store: TokenStore,
    private config: ExtensionConfig,
  ) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.ProviderResult<vscode.CompletionItem[]> {
    const line = document.lineAt(position).text;
    if (!line.includes('"$value"') && !line.includes('"value"')) return;

    const braceIdx = line.lastIndexOf("{", position.character);
    if (braceIdx === -1) return;

    const prefix = line.substring(braceIdx + 1, position.character);
    const root = jsonc.parseTree(document.getText());
    if (!root) return;

    const node = jsonc.findNodeAtOffset(root, document.offsetAt(position));
    const nearestType = node ? findNearestType(node) : null;

    const items: vscode.CompletionItem[] = [];
    const tokenStart = new vscode.Position(position.line, braceIdx + 1);
    const tokenRange = new vscode.Range(tokenStart, position);

    for (const [key, entry] of this.store.mapping) {
      if (items.length >= this.config.maxSuggestions) break;
      if (!key.startsWith(prefix)) continue;
      if (nearestType && entry.type !== nearestType) continue;

      const resolved = this.resolver.resolve(key);
      const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Value);
      item.insertText = new vscode.SnippetString(`${key}}`);
      item.range = tokenRange;

      const md = new vscode.MarkdownString("", true);
      md.isTrusted = true;

      let content = "";
      const icon = this.config.showIcons ? (TOKEN_ICONS[entry.type] ?? "") : "";
      content += `### ${icon} ${entry.type}\n\n`;

      if (resolved?.kind === "simple") {
        if (resolved.type === "color") {
          content += renderColorCircle(resolved.finalValue) + " ";
          content += colorValueLine(resolved.finalValue) + "\n\n";
        } else {
          content += `\`${resolved.finalValue}\`\n\n`;
        }
      } else if (resolved?.kind === "composite") {
        const propEntries = Object.entries(resolved.props).slice(0, 5);
        for (const [prop, data] of propEntries) {
          content += `- **${prop}**: \`${data.resolvedValue}\`\n`;
        }
        content += "\n";
      }

      item.detail = resolved?.kind === "simple" ? resolved.finalValue : entry.type;
      md.appendMarkdown(content);
      item.documentation = md;
      items.push(item);
    }

    return items;
  }
}

function findNearestType(node: jsonc.Node): string | null {
  let current: jsonc.Node | undefined = node;
  while (current) {
    if (current.type === "object" && current.children) {
      for (const prop of current.children) {
        if (
          prop.type === "property" &&
          prop.children?.[0]?.value === "$type" &&
          typeof prop.children[1]?.value === "string" &&
          VALID_TYPES.has(prop.children[1].value)
        ) {
          return prop.children[1].value;
        }
      }
    }
    current = current.parent;
  }
  return null;
}
