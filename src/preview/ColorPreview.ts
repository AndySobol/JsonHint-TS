/**
 * Color preview — modern swatch with hex overlay, rgb/hsl info.
 */

import { parseColor, hexToRgb, hexToHsl } from "../utils/colorParser";
import { svgToMarkdownImage, checkerboardPattern, escapeXml, THEME } from "./svgUtils";

const W = THEME.previewW;
const SWATCH_H = 36;

export function renderColorPreview(value: string): string {
  const hex = parseColor(value);
  if (!hex) return "";

  const rgb = hexToRgb(hex);
  const hasAlpha = rgb ? rgb.a < 1 : hex.length > 7;

  const overlayColor = isLightColor(hex) ? "#0d1117" : "#ffffff";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${SWATCH_H}">
    <defs>
      ${hasAlpha ? checkerboardPattern() : ""}
      <clipPath id="cr"><rect width="${W}" height="${SWATCH_H}" rx="8"/></clipPath>
    </defs>
    <g clip-path="url(#cr)">
      ${hasAlpha ? `<rect width="${W}" height="${SWATCH_H}" fill="url(#ck)"/>` : ""}
      <rect width="${W}" height="${SWATCH_H}" fill="${hex}"/>
    </g>
    <rect width="${W}" height="${SWATCH_H}" rx="8" fill="none" stroke="${THEME.border}" stroke-width="1"/>
    <text x="${W / 2}" y="${SWATCH_H / 2 + 5}" text-anchor="middle"
          font-size="13" font-weight="600" fill="${overlayColor}" opacity="0.9"
          font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${escapeXml(hex.toUpperCase())}</text>
  </svg>`;

  return svgToMarkdownImage(svg, "color swatch");
}

export function renderColorCircle(value: string): string {
  const hex = parseColor(value);
  if (!hex) return "";

  const r = 12;
  const d = r * 2;
  const hasAlpha = hex.length > 7;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${d}" height="${d}">
    <defs>${hasAlpha ? checkerboardPattern() : ""}</defs>
    ${hasAlpha ? `<circle cx="${r}" cy="${r}" r="${r}" fill="url(#ck)"/>` : ""}
    <circle cx="${r}" cy="${r}" r="${r - 0.5}" fill="${hex}" stroke="${THEME.border}" stroke-width="1"/>
  </svg>`;

  return svgToMarkdownImage(svg, "color");
}

export function colorValueLine(value: string): string {
  const hex = parseColor(value);
  if (!hex) return `\`${value}\``;

  const hsl = hexToHsl(hex);
  const rgb = hexToRgb(hex);
  const rgbStr = rgb
    ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b}${rgb.a < 1 ? `, ${rgb.a.toFixed(2)}` : ""})`
    : "";

  return `\`${hex.toUpperCase()}\` · \`${rgbStr}\` · \`${hsl}\``;
}

function isLightColor(hex: string): boolean {
  const clean = hex.replace("#", "").slice(0, 6);
  if (clean.length < 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}
