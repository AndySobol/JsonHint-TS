/**
 * Grid preview — modern grid layout visualization.
 */

import type { ResolvedProperty } from "../core/types";
import { svgToMarkdownImage, THEME } from "./svgUtils";

const W = THEME.previewW;
const H = 48;

export function renderGridPreview(props: Record<string, ResolvedProperty>): string {
  const columns = parseInt(props.columnCount?.resolvedValue ?? props.columns?.resolvedValue ?? "4", 10) || 4;
  const rows = parseInt(props.rowCount?.resolvedValue ?? props.rows?.resolvedValue ?? "1", 10) || 1;
  const gap = parseInt(props.gutterSize?.resolvedValue ?? props.gap?.resolvedValue ?? "4", 10) || 4;

  const effectiveCols = Math.min(columns, 12);
  const effectiveRows = Math.min(rows, 3);

  const innerW = W - 24;
  const innerH = H - 20;
  const cellW = (innerW - gap * (effectiveCols - 1)) / effectiveCols;
  const cellH = (innerH - gap * (effectiveRows - 1)) / effectiveRows;

  let cells = "";
  for (let r = 0; r < effectiveRows; r++) {
    for (let c = 0; c < effectiveCols; c++) {
      const x = 12 + c * (cellW + gap);
      const y = 10 + r * (cellH + gap);
      cells += `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="3"
                      fill="${THEME.accentPurple}" opacity="0.3"/>`;
      cells += `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="3"
                      fill="none" stroke="${THEME.accentPurple}" stroke-width="0.5" opacity="0.6"/>`;
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" rx="8" fill="${THEME.surface}" stroke="${THEME.border}" stroke-width="1"/>
    ${cells}
  </svg>`;

  return svgToMarkdownImage(svg, "grid");
}
