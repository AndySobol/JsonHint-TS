/**
 * Border preview — modern card showing border style, width, and color.
 */

import type { ResolvedProperty } from "../core/types";
import { svgToMarkdownImage, escapeXml, THEME } from "./svgUtils";
import { parseColor } from "../utils/colorParser";
import { extractNumber } from "../utils/mathEvaluator";

const W = THEME.previewW;
const H = 52;

export function renderBorderPreview(props: Record<string, ResolvedProperty>): string {
  const width = extractNumber(props.width?.resolvedValue ?? props.borderWidth?.resolvedValue ?? "1") ?? 1;
  const style = props.style?.resolvedValue ?? props.borderStyle?.resolvedValue ?? "solid";
  const colorRaw = props.color?.resolvedValue ?? props.borderColor?.resolvedValue ?? "#888888";
  const color = parseColor(colorRaw) ?? "#888888";

  const strokeW = Math.min(Math.max(width, 1), 8);
  const dashArray = style === "dashed" ? "10 5" : style === "dotted" ? "3 4" : "none";

  const boxW = W - 24;
  const boxH = H - 24;
  const info = `${width}px · ${style} · ${colorRaw.startsWith("#") ? colorRaw.toUpperCase() : colorRaw}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + 20}">
    <rect width="${W}" height="${H + 20}" rx="8" fill="${THEME.surface}" stroke="${THEME.border}" stroke-width="1"/>
    <rect x="12" y="10" width="${boxW}" height="${boxH}" rx="8"
          fill="${THEME.surfaceLight}" stroke="${color}" stroke-width="${strokeW}"
          ${dashArray !== "none" ? `stroke-dasharray="${dashArray}"` : ""}/>
    <text x="${W / 2}" y="${H + 10}" text-anchor="middle"
          font-size="10" fill="${THEME.textMuted}"
          font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${escapeXml(info)}</text>
  </svg>`;

  return svgToMarkdownImage(svg, "border");
}
