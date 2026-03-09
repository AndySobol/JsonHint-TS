/**
 * HoverBuilder — assembles a polished MarkdownString hover tooltip
 * matching the Figma plugin's tooltip style:
 *   [icon] type · tokenKey
 *   [visual preview]
 *   value / property rows
 *   [go to definition]
 *   [resolution chain]
 */

import * as vscode from "vscode";
import type { ResolvedToken, ExtensionConfig } from "../core/types";
import { TYPE_COLORS } from "../preview/svgUtils";
import { renderPreview, getValueLine } from "../preview/PreviewRenderer";
import { renderChain } from "./ChainRenderer";
import { TOKEN_TYPE_ICON_MAP, iconImg } from "../preview/icons";

export function buildHover(
  resolved: ResolvedToken,
  config: ExtensionConfig,
  tokenDirs: string[],
): vscode.MarkdownString {
  const md = new vscode.MarkdownString("", true);
  md.isTrusted = true;
  md.supportHtml = true;

  let content = "";

  // ─── Header: icon + type + token key ───
  const iconName = TOKEN_TYPE_ICON_MAP[resolved.type] ?? "variables";
  const iconHtml = config.showIcons ? iconImg(iconName) : "";
  const typeColor = TYPE_COLORS[resolved.type] ?? "#8b949e";

  content += `<span>${iconHtml}<strong style="color:${typeColor}">${resolved.type}</strong></span>\n\n`;
  content += `\`${resolved.tokenKey}\`\n\n`;

  // ─── Visual preview ───
  const preview = renderPreview(resolved);
  if (preview) {
    content += `${preview}\n\n`;
  }

  // ─── Value section ───
  if (resolved.kind === "simple") {
    const valueLine = getValueLine(resolved);
    content += `${valueLine}\n\n`;
  } else if (resolved.kind === "composite") {
    content += renderCompositeProps(resolved);
  }

  // ─── Go to definition ───
  if (resolved.file) {
    const args = encodeURIComponent(
      JSON.stringify([{ file: resolved.file, token: resolved.tokenKey }]),
    );
    const fileName = resolved.file.split("/").pop() ?? resolved.file;
    content += `[Open \`${fileName}\`](command:sxlResolver.revealToken?${args})\n\n`;
  }

  // ─── Chain / inheritance ───
  const chain = resolved.kind === "simple" ? resolved.chain : [];
  if (chain.length > 1) {
    content += `---\n\n`;
    content += renderChain(chain, config.maxChainLength, tokenDirs);
    content += "\n";
  }

  md.appendMarkdown(content);
  return md;
}

function renderCompositeProps(
  resolved: Extract<ResolvedToken, { kind: "composite" }>,
): string {
  const entries = Object.entries(resolved.props);
  if (!entries.length) return "";

  let content = "";
  for (const [prop, data] of entries) {
    const raw = data.rawValue;
    const val = data.resolvedValue;
    if (raw !== val && raw.includes("{")) {
      content += `\`${prop}\` &nbsp; ${raw} → **\`${val}\`**\n\n`;
    } else {
      content += `\`${prop}\` &nbsp; **\`${val}\`**\n\n`;
    }
  }

  return content;
}
