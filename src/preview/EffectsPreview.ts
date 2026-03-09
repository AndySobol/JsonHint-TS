/**
 * Effects preview — modern blur, backdrop-blur, glass, and combined effects.
 */

import type { ResolvedProperty, TokenType } from "../core/types";
import { svgToMarkdownImage, escapeXml, THEME } from "./svgUtils";
import { extractNumber } from "../utils/mathEvaluator";

const W = THEME.previewW;
const H = 48;

export function renderEffectsPreview(
  props: Record<string, ResolvedProperty>,
  type: TokenType,
): string {
  if (type === "blur" || type === "backdrop-blur") {
    return renderBlurPreview(props, type);
  }
  if (type === "glass") {
    return renderGlassPreview(props);
  }
  return renderGenericEffects(props);
}

function renderBlurPreview(props: Record<string, ResolvedProperty>, type: TokenType): string {
  const blurVal = props.blur?.resolvedValue ?? props.radius?.resolvedValue ?? "8";
  const radius = Math.min(extractNumber(blurVal) ?? 8, 30);
  const label = type === "backdrop-blur" ? "Backdrop Blur" : "Layer Blur";
  const stdDev = Math.min(radius / 2, 12);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" rx="8" fill="${THEME.surface}" stroke="${THEME.border}" stroke-width="1"/>
    <defs>
      <filter id="bf"><feGaussianBlur stdDeviation="${stdDev}"/></filter>
    </defs>
    <text x="16" y="28" font-size="18" font-weight="600" fill="${THEME.accent}"
          font-family="ui-sans-serif, system-ui, sans-serif" filter="url(#bf)">
      Blur Preview
    </text>
    <text x="16" y="42" font-size="10" fill="${THEME.textMuted}"
          font-family="ui-monospace, SFMono-Regular, Menlo, monospace">
      ${escapeXml(label)}: ${radius}px
    </text>
  </svg>`;

  return svgToMarkdownImage(svg, type);
}

function renderGlassPreview(props: Record<string, ResolvedProperty>): string {
  const blur = extractNumber(props.blur?.resolvedValue ?? props.backgroundBlur?.resolvedValue ?? "12") ?? 12;
  const opacity = extractNumber(props.opacity?.resolvedValue ?? "0.3") ?? 0.3;
  const stdDev = Math.min(blur / 3, 10);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="gbg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${THEME.accentPurple}"/>
        <stop offset="100%" stop-color="${THEME.accentPink}"/>
      </linearGradient>
      <filter id="gf"><feGaussianBlur stdDeviation="${stdDev}"/></filter>
    </defs>
    <rect width="${W}" height="${H}" rx="8" fill="url(#gbg)"/>
    <rect x="20" y="8" width="${W - 40}" height="${H - 16}" rx="6"
          fill="rgba(255,255,255,${opacity})" filter="url(#gf)"
          stroke="rgba(255,255,255,0.2)" stroke-width="1"/>
    <text x="${W / 2}" y="${H / 2 + 4}" text-anchor="middle"
          font-size="12" font-weight="600" fill="#fff"
          font-family="ui-sans-serif, system-ui, sans-serif">Glass Effect</text>
  </svg>`;

  return svgToMarkdownImage(svg, "glass");
}

function renderGenericEffects(props: Record<string, ResolvedProperty>): string {
  const entries = Object.entries(props).slice(0, 3);
  const lines = entries.map(([k, v]) => `${k}: ${v.resolvedValue}`).join("  ·  ");
  const display = lines.length > 55 ? lines.slice(0, 52) + "..." : lines;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="28">
    <rect width="${W}" height="28" rx="8" fill="${THEME.surface}" stroke="${THEME.border}" stroke-width="1"/>
    <text x="12" y="18" font-size="10" fill="${THEME.textMuted}"
          font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${escapeXml(display)}</text>
  </svg>`;

  return svgToMarkdownImage(svg, "effects");
}
