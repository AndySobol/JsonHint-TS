/**
 * Gradient preview — renders linear, radial, conic gradients in a modern card.
 */

import { svgToMarkdownImage, checkerboardPattern, THEME } from "./svgUtils";
import { parseColor } from "../utils/colorParser";

const W = THEME.previewW;
const H = 36;

export function renderGradientPreview(value: string): string {
  if (typeof value !== "string") return "";

  const lower = value.trim().toLowerCase();

  if (lower.startsWith("linear-gradient(")) return renderLinearGradient(value);
  if (lower.startsWith("radial-gradient(")) return renderRadialGradient(value);
  if (lower.startsWith("conic-gradient(")) return renderConicGradient(value);

  const asColor = parseColor(value);
  if (asColor) return renderSolidFill(asColor);

  return "";
}

function renderLinearGradient(raw: string): string {
  const inner = raw.slice(raw.indexOf("(") + 1, raw.lastIndexOf(")")).trim();
  const parts = splitGradientParts(inner);

  let angle = "90";
  let stopParts = parts;

  const first = parts[0]?.trim();
  if (first && /^-?\d+(\.\d+)?deg$/.test(first)) {
    angle = first.replace("deg", "");
    stopParts = parts.slice(1);
  } else if (first && first.startsWith("to ")) {
    angle = directionToAngle(first);
    stopParts = parts.slice(1);
  }

  const stops = parseStops(stopParts);
  if (!stops.length) return "";

  const stopsSvg = stops.map((s) =>
    `<stop offset="${s.offset}" stop-color="${s.color}" ${s.opacity < 1 ? `stop-opacity="${s.opacity}"` : ""}/>`
  ).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      ${checkerboardPattern()}
      <linearGradient id="lg" gradientTransform="rotate(${angle}, 0.5, 0.5)" gradientUnits="objectBoundingBox">
        ${stopsSvg}
      </linearGradient>
      <clipPath id="cr"><rect width="${W}" height="${H}" rx="8"/></clipPath>
    </defs>
    <g clip-path="url(#cr)">
      <rect width="${W}" height="${H}" fill="url(#ck)"/>
      <rect width="${W}" height="${H}" fill="url(#lg)"/>
    </g>
    <rect width="${W}" height="${H}" rx="8" fill="none" stroke="${THEME.border}" stroke-width="1"/>
  </svg>`;

  return svgToMarkdownImage(svg, "gradient");
}

function renderRadialGradient(raw: string): string {
  const inner = raw.slice(raw.indexOf("(") + 1, raw.lastIndexOf(")")).trim();
  const parts = splitGradientParts(inner);

  let stopParts = parts;
  const first = parts[0]?.trim().toLowerCase();
  if (first && (first.startsWith("circle") || first.startsWith("ellipse") || first.includes(" at "))) {
    stopParts = parts.slice(1);
  }

  const stops = parseStops(stopParts);
  if (!stops.length) return "";

  const stopsSvg = stops.map((s) =>
    `<stop offset="${s.offset}" stop-color="${s.color}" ${s.opacity < 1 ? `stop-opacity="${s.opacity}"` : ""}/>`
  ).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      ${checkerboardPattern()}
      <radialGradient id="rg" cx="50%" cy="50%" r="50%">
        ${stopsSvg}
      </radialGradient>
      <clipPath id="cr"><rect width="${W}" height="${H}" rx="8"/></clipPath>
    </defs>
    <g clip-path="url(#cr)">
      <rect width="${W}" height="${H}" fill="url(#ck)"/>
      <rect width="${W}" height="${H}" fill="url(#rg)"/>
    </g>
    <rect width="${W}" height="${H}" rx="8" fill="none" stroke="${THEME.border}" stroke-width="1"/>
  </svg>`;

  return svgToMarkdownImage(svg, "radial gradient");
}

function renderConicGradient(raw: string): string {
  const inner = raw.slice(raw.indexOf("(") + 1, raw.lastIndexOf(")")).trim();
  const parts = splitGradientParts(inner);
  const stops = parseStops(parts.length > 1 && parts[0].includes("from") ? parts.slice(1) : parts);
  if (!stops.length) return "";

  const colors = stops.map((s) => s.color);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="cg">
        ${colors.map((c, i) => `<stop offset="${(i / (colors.length - 1) * 100).toFixed(0)}%" stop-color="${c}"/>`).join("")}
      </linearGradient>
      <clipPath id="cr"><rect width="${W}" height="${H}" rx="8"/></clipPath>
    </defs>
    <g clip-path="url(#cr)">
      <rect width="${W}" height="${H}" fill="url(#cg)"/>
    </g>
    <rect width="${W}" height="${H}" rx="8" fill="none" stroke="${THEME.border}" stroke-width="1"/>
  </svg>`;

  return svgToMarkdownImage(svg, "conic gradient");
}

function renderSolidFill(hex: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" rx="8" fill="${hex}" stroke="${THEME.border}" stroke-width="1"/>
  </svg>`;
  return svgToMarkdownImage(svg, "fill");
}

interface GradientStop { color: string; offset: string; opacity: number; }

function parseStops(parts: string[]): GradientStop[] {
  const stops: GradientStop[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const match = trimmed.match(/^(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8}|\w+)\s*(\d+%?)?$/);
    if (match) {
      const colorStr = match[1];
      const offset = match[2] ?? `${stops.length === 0 ? 0 : 100}%`;
      const hex = parseColor(colorStr);
      const opacity = extractAlpha(colorStr);
      stops.push({ color: hex ?? colorStr, offset: offset.includes("%") ? offset : `${offset}%`, opacity });
    }
  }
  return stops;
}

function extractAlpha(color: string): number {
  const match = color.match(/rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/);
  return match ? parseFloat(match[1]) : 1;
}

function splitGradientParts(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of inner) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function directionToAngle(dir: string): string {
  const map: Record<string, string> = {
    "to top": "0", "to right": "90", "to bottom": "180", "to left": "270",
    "to top right": "45", "to top left": "315", "to bottom right": "135", "to bottom left": "225",
  };
  return map[dir.trim().toLowerCase()] ?? "90";
}
