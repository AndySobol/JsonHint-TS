/**
 * SVG icon system — clean line icons matching the Figma plugin style.
 * Each icon is a 16x16 SVG, rendered as base64 for inline use in MarkdownString.
 */

const C = "#8b949e"; // default icon color

function icon(paths: string, color = C): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  return Buffer.from(svg).toString("base64");
}

function filledIcon(content: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">${content}</svg>`;
  return Buffer.from(svg).toString("base64");
}

export const ICON_B64: Record<string, string> = {
  "color-palette": filledIcon(
    `<circle cx="8" cy="8" r="6.5" fill="none" stroke="${C}" stroke-width="1.3"/>` +
    `<circle cx="6" cy="6" r="1.3" fill="#f778ba"/>` +
    `<circle cx="10" cy="6" r="1.3" fill="#79c0ff"/>` +
    `<circle cx="8" cy="10" r="1.3" fill="#7ee787"/>`
  ),

  "text-1": icon(
    `<path d="M4 4h8M8 4v8M6 12h4"/>`
  ),

  "shadows": icon(
    `<rect x="2" y="2" width="8" height="8" rx="2"/>` +
    `<rect x="6" y="6" width="8" height="8" rx="2" opacity="0.5"/>`
  ),

  "line-thickness": icon(
    `<line x1="3" y1="4" x2="13" y2="4" stroke-width="1"/>` +
    `<line x1="3" y1="8" x2="13" y2="8" stroke-width="2"/>` +
    `<line x1="3" y1="12" x2="13" y2="12" stroke-width="2.5"/>`
  ),

  "corner-radius": icon(
    `<path d="M3 12V7a4 4 0 0 1 4-4h5"/>`
  ),

  "line-height": icon(
    `<line x1="8" y1="2" x2="8" y2="14"/>` +
    `<polyline points="5,4 8,2 11,4"/>` +
    `<polyline points="5,12 8,14 11,12"/>`
  ),

  "downsize-2": icon(
    `<rect x="2" y="2" width="12" height="12" rx="2"/>` +
    `<line x1="5" y1="8" x2="11" y2="8"/>` +
    `<polyline points="7,6 5,8 7,10"/>` +
    `<polyline points="9,6 11,8 9,10"/>`
  ),

  "layout-grid-1": icon(
    `<rect x="2" y="2" width="5" height="5" rx="1"/>` +
    `<rect x="9" y="2" width="5" height="5" rx="1"/>` +
    `<rect x="2" y="9" width="5" height="5" rx="1"/>` +
    `<rect x="9" y="9" width="5" height="5" rx="1"/>`
  ),

  "speed-dots": filledIcon(
    `<circle cx="4" cy="8" r="1.5" fill="${C}" opacity="0.4"/>` +
    `<circle cx="8" cy="8" r="1.5" fill="${C}" opacity="0.7"/>` +
    `<circle cx="12" cy="8" r="1.5" fill="${C}"/>`
  ),

  "numbers-123": icon(
    `<text x="2" y="12" font-size="10" font-weight="600" font-family="system-ui" fill="${C}" stroke="none">123</text>`
  ),

  "input-form": icon(
    `<rect x="2" y="4" width="12" height="8" rx="2"/>` +
    `<line x1="5" y1="7" x2="5" y2="9"/>`
  ),

  "forms-circle-square": icon(
    `<rect x="2" y="2" width="5" height="5" rx="1"/>` +
    `<circle cx="11.5" cy="11.5" r="3"/>`
  ),

  "components": icon(
    `<path d="M8 2L14 8L8 14L2 8Z"/>` +
    `<line x1="8" y1="2" x2="8" y2="14" opacity="0.3"/>` +
    `<line x1="2" y1="8" x2="14" y2="8" opacity="0.3"/>`
  ),

  "variables": icon(
    `<circle cx="8" cy="8" r="5"/>` +
    `<line x1="8" y1="5" x2="8" y2="11"/>` +
    `<line x1="5" y1="8" x2="11" y2="8"/>`
  ),

  "opacity": icon(
    `<circle cx="8" cy="8" r="6"/>` +
    `<path d="M8 2a6 6 0 0 1 0 12" fill="${C}" opacity="0.3" stroke="none"/>`
  ),

  "boolean": icon(
    `<polyline points="4,8 7,11 12,5"/>`
  ),

  "bezier": icon(
    `<path d="M3 13C3 13 6 3 13 3" fill="none"/>` +
    `<circle cx="3" cy="13" r="1.5" fill="${C}" stroke="none"/>` +
    `<circle cx="13" cy="3" r="1.5" fill="${C}" stroke="none"/>`
  ),
};

export function iconImg(name: string, size = 16): string {
  const b64 = ICON_B64[name];
  if (!b64) return "";
  return `<img src="data:image/svg+xml;base64,${b64}" width="${size}" height="${size}" style="vertical-align:middle;margin-right:4px;">`;
}

export function iconMarkdown(name: string, alt = "icon"): string {
  const b64 = ICON_B64[name];
  if (!b64) return "";
  return `![${alt}](data:image/svg+xml;base64,${b64})`;
}

export const TOKEN_TYPE_ICON_MAP: Record<string, string> = {
  color: "color-palette",
  gradient: "color-palette",
  fill: "color-palette",
  typography: "text-1",
  fontFamily: "text-1",
  fontFamilies: "text-1",
  fontWeight: "text-1",
  fontWeights: "text-1",
  fontSize: "text-1",
  fontSizes: "text-1",
  lineHeight: "line-height",
  lineHeights: "line-height",
  letterSpacing: "line-height",
  paragraphSpacing: "line-height",
  paragraphIndent: "line-height",
  textCase: "text-1",
  textDecoration: "text-1",
  shadow: "shadows",
  boxShadow: "shadows",
  blur: "shadows",
  "backdrop-blur": "shadows",
  glass: "shadows",
  effects: "shadows",
  dimension: "numbers-123",
  sizing: "downsize-2",
  spacing: "line-height",
  borderRadius: "corner-radius",
  borderWidth: "line-thickness",
  border: "line-thickness",
  strokeStyle: "line-thickness",
  opacity: "opacity",
  number: "numbers-123",
  boolean: "boolean",
  string: "input-form",
  text: "input-form",
  grid: "layout-grid-1",
  transition: "speed-dots",
  duration: "speed-dots",
  cubicBezier: "bezier",
  template: "forms-circle-square",
  composition: "components",
  unknown: "variables",
};
