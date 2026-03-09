/**
 * Dimension preview — modern horizontal bars for sizing, spacing, borderRadius, opacity.
 */

import { svgToMarkdownImage, escapeXml, cardFrame, THEME } from "./svgUtils";
import { extractNumber } from "../utils/mathEvaluator";

const W = THEME.previewW;
const BAR_H = 10;

export function renderDimensionPreview(value: string): string {
  const num = extractNumber(value);
  if (num === null || num < 0) return "";

  const barW = Math.min(Math.max(num, 4), W - 70);
  const h = 32;

  const content = `
    <defs>
      <linearGradient id="dg" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${THEME.accentGreen}"/>
        <stop offset="100%" stop-color="${THEME.accentCyan}"/>
      </linearGradient>
    </defs>
    <rect x="12" y="${(h - BAR_H) / 2}" width="${barW}" height="${BAR_H}" rx="5" fill="url(#dg)" opacity="0.85"/>
    <text x="${barW + 20}" y="${h / 2 + 4}" font-size="11" font-weight="500" fill="${THEME.textMuted}"
          font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${escapeXml(value)}</text>`;

  return svgToMarkdownImage(cardFrame(W, h, content), "dimension");
}

export function renderBorderRadiusPreview(value: string): string {
  const num = extractNumber(value);
  if (num === null || num < 0) return "";

  const r = Math.min(num, 24);
  const boxSize = 44;
  const h = 56;

  const content = `
    <rect x="12" y="${(h - boxSize) / 2}" width="${boxSize}" height="${boxSize}" rx="${r}"
          fill="none" stroke="${THEME.accentOrange}" stroke-width="2.5" opacity="0.85"/>
    <rect x="${12 + r}" y="${(h - boxSize) / 2 + r}" width="${boxSize - r * 2}" height="${boxSize - r * 2}"
          fill="${THEME.accentOrange}" opacity="0.1" rx="1"/>
    <text x="${boxSize + 24}" y="${h / 2 + 4}" font-size="11" font-weight="500" fill="${THEME.textMuted}"
          font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${escapeXml(value)}</text>`;

  return svgToMarkdownImage(cardFrame(W, h, content), "borderRadius");
}

export function renderOpacityPreview(value: string): string {
  const num = extractNumber(value);
  if (num === null) return "";

  const opacity = num > 1 ? num / 100 : num;
  const h = 32;
  const barW = W - 24;
  const filledW = barW * Math.min(Math.max(opacity, 0), 1);

  const content = `
    <defs>
      <pattern id="ck" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="4" height="4" fill="#21262d"/><rect x="4" y="4" width="4" height="4" fill="#21262d"/>
        <rect x="4" width="4" height="4" fill="#30363d"/><rect y="4" width="4" height="4" fill="#30363d"/>
      </pattern>
    </defs>
    <rect x="12" y="${(h - BAR_H) / 2}" width="${barW}" height="${BAR_H}" rx="5" fill="url(#ck)"/>
    <rect x="12" y="${(h - BAR_H) / 2}" width="${barW}" height="${BAR_H}" rx="5"
          fill="${THEME.accent}" opacity="${opacity}"/>
    <rect x="12" y="${(h - BAR_H) / 2}" width="${barW}" height="${BAR_H}" rx="5"
          fill="none" stroke="${THEME.border}" stroke-width="1"/>
    <circle cx="${12 + filledW}" cy="${h / 2}" r="5" fill="${THEME.accent}" stroke="${THEME.surface}" stroke-width="2"/>`;

  return svgToMarkdownImage(cardFrame(W, h, content), "opacity");
}
