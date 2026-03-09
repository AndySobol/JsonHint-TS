/**
 * Animation preview — modern cubic-bezier curves, duration/transition badges.
 */

import type { TokenType } from "../core/types";
import { svgToMarkdownImage, escapeXml, THEME } from "./svgUtils";
import { extractNumber } from "../utils/mathEvaluator";

const W = THEME.previewW;
const H = 72;

export function renderAnimationPreview(value: string, type: TokenType): string {
  if (type === "cubicBezier") return renderCubicBezier(value);
  if (type === "duration") return renderDurationBadge(value);
  if (type === "transition") return renderTransitionBadge();
  return "";
}

function renderCubicBezier(value: string): string {
  const nums = parseBezierValues(value);
  if (!nums) return "";

  const [x1, y1, x2, y2] = nums;
  const pad = 16;
  const gw = W - pad * 2;
  const gh = H - pad * 2;

  const sx = pad;
  const sy = pad + gh;
  const ex = pad + gw;
  const ey = pad;

  const cp1x = sx + x1 * gw;
  const cp1y = sy - y1 * gh;
  const cp2x = sx + x2 * gw;
  const cp2y = sy - y2 * gh;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" rx="8" fill="${THEME.surface}" stroke="${THEME.border}" stroke-width="1"/>
    <defs>
      <linearGradient id="cgrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${THEME.accentOrange}"/>
        <stop offset="100%" stop-color="${THEME.accentPink}"/>
      </linearGradient>
    </defs>
    <!-- grid lines -->
    <line x1="${sx}" y1="${sy}" x2="${ex}" y2="${sy}" stroke="${THEME.border}" stroke-width="1"/>
    <line x1="${sx}" y1="${sy}" x2="${sx}" y2="${ey}" stroke="${THEME.border}" stroke-width="1"/>
    <line x1="${sx}" y1="${ey}" x2="${ex}" y2="${ey}" stroke="${THEME.border}" stroke-width="0.5" stroke-dasharray="4 3"/>
    <line x1="${ex}" y1="${sy}" x2="${ex}" y2="${ey}" stroke="${THEME.border}" stroke-width="0.5" stroke-dasharray="4 3"/>
    <!-- control point handles -->
    <line x1="${sx}" y1="${sy}" x2="${cp1x}" y2="${cp1y}" stroke="${THEME.accentOrange}" stroke-width="1" opacity="0.5"/>
    <line x1="${ex}" y1="${ey}" x2="${cp2x}" y2="${cp2y}" stroke="${THEME.accentGreen}" stroke-width="1" opacity="0.5"/>
    <!-- curve -->
    <path d="M${sx},${sy} C${cp1x},${cp1y} ${cp2x},${cp2y} ${ex},${ey}"
          fill="none" stroke="url(#cgrad)" stroke-width="2.5" stroke-linecap="round"/>
    <!-- control points -->
    <circle cx="${cp1x}" cy="${cp1y}" r="4" fill="${THEME.accentOrange}" stroke="${THEME.surface}" stroke-width="2"/>
    <circle cx="${cp2x}" cy="${cp2y}" r="4" fill="${THEME.accentGreen}" stroke="${THEME.surface}" stroke-width="2"/>
  </svg>`;

  return svgToMarkdownImage(svg, "cubic-bezier");
}

function renderDurationBadge(value: string): string {
  const num = extractNumber(value);
  const display = num !== null ? `${num}ms` : escapeXml(value);
  const maxBarW = W - 80;
  const barW = num !== null ? Math.min(Math.max(num / 10, 12), maxBarW) : 80;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="32">
    <rect width="${W}" height="32" rx="8" fill="${THEME.surface}" stroke="${THEME.border}" stroke-width="1"/>
    <defs>
      <linearGradient id="dur" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${THEME.accentOrange}"/>
        <stop offset="100%" stop-color="${THEME.accentOrange}" stop-opacity="0.3"/>
      </linearGradient>
    </defs>
    <rect x="12" y="10" width="${barW}" height="12" rx="6" fill="url(#dur)"/>
    <text x="${barW + 20}" y="20" font-size="11" font-weight="500" fill="${THEME.textMuted}"
          font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${display}</text>
  </svg>`;

  return svgToMarkdownImage(svg, "duration");
}

function renderTransitionBadge(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="28">
    <rect width="140" height="28" rx="8" fill="${THEME.surface}" stroke="${THEME.border}" stroke-width="1"/>
    <text x="12" y="18" font-size="11" font-weight="500" fill="${THEME.accentOrange}"
          font-family="ui-monospace, SFMono-Regular, Menlo, monospace">transition</text>
  </svg>`;
  return svgToMarkdownImage(svg, "transition");
}

function parseBezierValues(value: string): [number, number, number, number] | null {
  const str = typeof value === "string" ? value : JSON.stringify(value);
  const match = str.match(/[\[(]?\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*[\])]?/);
  if (!match) return null;

  const nums = [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]), parseFloat(match[4])];
  if (nums.some(isNaN)) return null;
  return nums as [number, number, number, number];
}
