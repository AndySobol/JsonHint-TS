/**
 * Shared SVG generation helpers and design-system constants.
 * All previews use inline SVG -> base64 data URIs for MarkdownString.
 */

// ─── Design Tokens ───

export const THEME = {
  bg: "#0d1117",
  surface: "#161b22",
  surfaceLight: "#1c2333",
  border: "#30363d",
  borderLight: "#444c56",
  text: "#e6edf3",
  textMuted: "#8b949e",
  textDim: "#484f58",
  accent: "#58a6ff",
  accentGreen: "#3fb950",
  accentOrange: "#d29922",
  accentPurple: "#bc8cff",
  accentPink: "#f778ba",
  accentRed: "#f85149",
  accentCyan: "#79c0ff",
  previewW: 240,
} as const;

export const TYPE_COLORS: Record<string, string> = {
  color: "#f778ba",
  gradient: "#bc8cff",
  fill: "#f778ba",
  typography: "#79c0ff",
  fontFamily: "#79c0ff",
  fontWeight: "#79c0ff",
  fontSize: "#79c0ff",
  lineHeight: "#79c0ff",
  letterSpacing: "#79c0ff",
  paragraphSpacing: "#79c0ff",
  paragraphIndent: "#79c0ff",
  textCase: "#79c0ff",
  textDecoration: "#79c0ff",
  shadow: "#d2a8ff",
  boxShadow: "#d2a8ff",
  blur: "#a5d6ff",
  "backdrop-blur": "#a5d6ff",
  glass: "#a5d6ff",
  effects: "#d2a8ff",
  dimension: "#7ee787",
  sizing: "#7ee787",
  spacing: "#7ee787",
  borderRadius: "#ffa657",
  borderWidth: "#ffa657",
  border: "#ffa657",
  strokeStyle: "#ffa657",
  opacity: "#a5d6ff",
  number: "#79c0ff",
  boolean: "#ffa657",
  string: "#a5d6ff",
  text: "#a5d6ff",
  grid: "#bc8cff",
  transition: "#d29922",
  duration: "#d29922",
  cubicBezier: "#d29922",
  template: "#bc8cff",
  composition: "#bc8cff",
  unknown: "#8b949e",
};

// ─── SVG Helpers ───

export function svgToMarkdownImage(svg: string, alt = ""): string {
  const base64 = Buffer.from(svg).toString("base64");
  return `![${alt}](data:image/svg+xml;base64,${base64})`;
}

export function checkerboardPattern(id = "ck"): string {
  return `<pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="4" height="4" fill="#21262d"/>
      <rect x="4" y="4" width="4" height="4" fill="#21262d"/>
      <rect x="4" width="4" height="4" fill="#30363d"/>
      <rect y="4" width="4" height="4" fill="#30363d"/>
    </pattern>`;
}

export function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function cardFrame(w: number, h: number, content: string, opts?: { noBg?: boolean }): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    ${opts?.noBg ? "" : `<rect width="${w}" height="${h}" rx="8" fill="${THEME.surface}" stroke="${THEME.border}" stroke-width="1"/>`}
    ${content}
  </svg>`;
}
