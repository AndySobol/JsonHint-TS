/**
 * Simple preview — modern badges for number, boolean, string, text,
 * and typography sub-properties (fontFamily, fontWeight, etc.).
 */

import { svgToMarkdownImage, escapeXml, THEME } from "./svgUtils";

export function renderSimpleBadge(value: string, type: string): string {
  const typoTypes = new Set([
    "fontFamily", "fontFamilies", "fontWeight", "fontWeights",
    "textCase", "textDecoration",
  ]);
  if (typoTypes.has(type)) return renderTypoPropertyPreview(value, type);

  const label = escapeXml(value.length > 36 ? value.slice(0, 33) + "..." : value);

  const accents: Record<string, { color: string; icon: string }> = {
    number:  { color: THEME.accentGreen,  icon: "#" },
    boolean: { color: THEME.accentOrange, icon: value === "true" ? "✓" : "✗" },
    string:  { color: THEME.accentCyan,   icon: "\"\"" },
    text:    { color: THEME.accentCyan,   icon: "T" },
  };

  const a = accents[type] ?? { color: THEME.textMuted, icon: "?" };
  const textW = label.length * 7.2 + 44;
  const w = Math.max(textW, 80);
  const h = 28;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <rect width="${w}" height="${h}" rx="8" fill="${THEME.surface}" stroke="${THEME.border}" stroke-width="1"/>
    <text x="12" y="18" font-size="11" font-weight="600" fill="${a.color}"
          font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${escapeXml(a.icon)}</text>
    <text x="32" y="18" font-size="11" fill="${THEME.text}"
          font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${label}</text>
  </svg>`;

  return svgToMarkdownImage(svg, type);
}

function renderTypoPropertyPreview(value: string, type: string): string {
  const W = THEME.previewW;
  const H = 48;

  const safeVal = escapeXml(value.split(",")[0].replace(/['"]/g, "").trim());

  let sampleText = "Aa Bb";
  let fontFamily = "ui-sans-serif, system-ui, sans-serif";
  let fontWeight = "400";
  let textDecoration = "none";
  let textTransform = "none";

  if (type === "fontFamily" || type === "fontFamilies") {
    fontFamily = `${safeVal}, ui-sans-serif, system-ui, sans-serif`;
  } else if (type === "fontWeight" || type === "fontWeights") {
    fontWeight = value;
  } else if (type === "textCase") {
    const lower = value.toLowerCase();
    if (lower === "uppercase") { textTransform = "uppercase"; sampleText = sampleText.toUpperCase(); }
    else if (lower === "lowercase") { textTransform = "lowercase"; sampleText = sampleText.toLowerCase(); }
    else if (lower === "capitalize") sampleText = "Aa Bb";
  } else if (type === "textDecoration") {
    textDecoration = value.toLowerCase();
  }

  const info = `${type}: ${safeVal}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" rx="8" fill="${THEME.surface}" stroke="${THEME.border}" stroke-width="1"/>
    <text x="16" y="28"
          font-family="${fontFamily}"
          font-weight="${fontWeight}"
          font-size="20"
          fill="${THEME.text}"
          text-decoration="${textDecoration}">${escapeXml(sampleText)}</text>
    <text x="16" y="42" font-size="10" fill="${THEME.textMuted}"
          font-family="ui-monospace, SFMono-Regular, Menlo, monospace">${escapeXml(info)}</text>
  </svg>`;

  return svgToMarkdownImage(svg, type);
}
