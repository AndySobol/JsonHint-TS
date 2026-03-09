/**
 * Typography preview — modern card with text sample and property summary.
 */

import type { ResolvedProperty } from "../core/types";
import { svgToMarkdownImage, escapeXml, THEME } from "./svgUtils";

const W = THEME.previewW;
const H = 72;

export function renderTypographyPreview(props: Record<string, ResolvedProperty>): string {
  const fontFamily = getProp(props, "fontFamily") || "Inter";
  const fontWeight = getProp(props, "fontWeight") || "400";
  const fontSize = getProp(props, "fontSize") || "16px";
  const lineHeight = getProp(props, "lineHeight") || "1.5";
  const textDecoration = getProp(props, "textDecoration") || "none";
  const textCase = getProp(props, "textCase") || "none";
  const letterSpacing = getProp(props, "letterSpacing");

  const fontSizeNum = parseFloat(fontSize) || 16;
  const displaySize = Math.min(Math.max(fontSizeNum, 14), 36);

  let sampleText = "Aa Bb 123";
  if (textCase.toLowerCase() === "uppercase") sampleText = sampleText.toUpperCase();
  else if (textCase.toLowerCase() === "lowercase") sampleText = sampleText.toLowerCase();

  const safeFamily = escapeXml(fontFamily.split(",")[0].replace(/['"]/g, "").trim());
  const sizeLabel = lineHeight && lineHeight !== "1.5" && lineHeight !== "normal"
    ? `${fontSize}/${lineHeight}`
    : fontSize;
  const infoText = `${safeFamily} · ${fontWeight} · ${sizeLabel}${letterSpacing ? ` · ls:${letterSpacing}` : ""}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" rx="8" fill="${THEME.surface}" stroke="${THEME.border}" stroke-width="1"/>
    <text x="16" y="38"
          font-family="${safeFamily}, ui-sans-serif, system-ui, sans-serif"
          font-weight="${fontWeight}"
          font-size="${displaySize}"
          fill="${THEME.text}"
          text-decoration="${textDecoration}"
          letter-spacing="${letterSpacing || "normal"}">${escapeXml(sampleText)}</text>
    <line x1="16" y1="50" x2="${W - 16}" y2="50" stroke="${THEME.border}" stroke-width="1"/>
    <text x="16" y="64" font-size="10" fill="${THEME.textMuted}"
          font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${escapeXml(infoText)}</text>
  </svg>`;

  return svgToMarkdownImage(svg, "typography");
}

function getProp(props: Record<string, ResolvedProperty>, key: string): string {
  return props[key]?.resolvedValue ?? "";
}
