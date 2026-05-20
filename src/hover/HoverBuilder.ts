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
    content += renderSimpleValueSection(resolved);
  } else if (resolved.kind === "composite") {
    content += renderCompositeValueSection(resolved);
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

  const previewEntries = entries.slice(0, 14);
  let content = "";
  for (const [prop, data] of previewEntries) {
    const raw = data.rawValue;
    const val = data.resolvedValue;
    if (raw !== val && raw.includes("{")) {
      content += `\`${prop}\` &nbsp; ${raw} → **\`${val}\`**\n\n`;
    } else {
      content += `\`${prop}\` &nbsp; **\`${val}\`**\n\n`;
    }
  }
  if (entries.length > previewEntries.length) {
    content += `… +${entries.length - previewEntries.length} more properties\n\n`;
  }

  return content;
}

function renderSimpleValueSection(resolved: Extract<ResolvedToken, { kind: "simple" }>): string {
  const valueLine = getValueLine(resolved);
  const hasRawAlias = resolved.rawValue !== resolved.finalValue;
  if (!hasRawAlias) return `${valueLine}\n\n`;

  return `Raw: \`${resolved.rawValue}\`\n\nResolved: ${valueLine}\n\n`;
}

function renderCompositeValueSection(resolved: Extract<ResolvedToken, { kind: "composite" }>): string {
  const summary = renderCompositeSummaryLine(resolved);
  let content = "";
  if (summary) {
    content += `${summary}\n\n`;
  }
  content += renderCompositeProps(resolved);
  return content;
}

function renderCompositeSummaryLine(resolved: Extract<ResolvedToken, { kind: "composite" }>): string {
  if (resolved.type === "typography") {
    const fontFamily = resolved.props.fontFamily?.resolvedValue ?? "system-ui";
    const fontWeight = resolved.props.fontWeight?.resolvedValue ?? "400";
    const fontSize = resolved.props.fontSize?.resolvedValue ?? "16px";
    const lineHeight = resolved.props.lineHeight?.resolvedValue ?? "normal";
    const letterSpacing = resolved.props.letterSpacing?.resolvedValue;
    const textDecoration = resolved.props.textDecoration?.resolvedValue;

    const parts = [`font: ${fontWeight} ${fontSize}/${lineHeight} ${fontFamily};`];
    if (letterSpacing) parts.push(`letter-spacing: ${letterSpacing};`);
    if (textDecoration) parts.push(`text-decoration: ${textDecoration};`);
    return "```css\n" + parts.join("\n") + "\n```";
  }

  if (resolved.type === "border") {
    const width = resolved.props.width?.resolvedValue ?? resolved.props.borderWidth?.resolvedValue ?? "1px";
    const style = resolved.props.style?.resolvedValue ?? "solid";
    const color = resolved.props.color?.resolvedValue ?? "currentColor";
    return "```css\n" + `border: ${width} ${style} ${color};` + "\n```";
  }

  if (resolved.type === "transition") {
    const duration = resolved.props.duration?.resolvedValue ?? "200ms";
    const timing = resolved.props.timingFunction?.resolvedValue ?? resolved.props.cubicBezier?.resolvedValue ?? "ease";
    const property = resolved.props.property?.resolvedValue ?? "all";
    return "```css\n" + `transition: ${property} ${duration} ${timing};` + "\n```";
  }

  return "";
}
