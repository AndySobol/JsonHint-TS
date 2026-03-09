/**
 * CSS color parsing: hex, rgb, rgba, hsl, hsla, named colors.
 * Returns normalized hex (#RRGGBB or #RRGGBBAA).
 */

const NAMED_COLORS: Record<string, string> = {
  black: "#000000", white: "#ffffff", red: "#ff0000", green: "#008000",
  blue: "#0000ff", yellow: "#ffff00", cyan: "#00ffff", magenta: "#ff00ff",
  orange: "#ffa500", purple: "#800080", pink: "#ffc0cb", gray: "#808080",
  grey: "#808080", silver: "#c0c0c0", maroon: "#800000", olive: "#808000",
  lime: "#00ff00", aqua: "#00ffff", teal: "#008080", navy: "#000080",
  fuchsia: "#ff00ff", transparent: "#00000000",
  coral: "#ff7f50", tomato: "#ff6347", gold: "#ffd700", indigo: "#4b0082",
  violet: "#ee82ee", khaki: "#f0e68c", salmon: "#fa8072", crimson: "#dc143c",
  chocolate: "#d2691e", tan: "#d2b48c", skyblue: "#87ceeb", plum: "#dda0dd",
  orchid: "#da70d6", turquoise: "#40e0d0", sienna: "#a0522d", peru: "#cd853f",
  wheat: "#f5deb3", linen: "#faf0e6", beige: "#f5f5dc", ivory: "#fffff0",
  snow: "#fffafa", seashell: "#fff5ee", lavender: "#e6e6fa", honeydew: "#f0fff0",
  mintcream: "#f5fffa", azure: "#f0ffff", aliceblue: "#f0f8ff", ghostwhite: "#f8f8ff",
  whitesmoke: "#f5f5f5", mistyrose: "#ffe4e1", antiquewhite: "#faebd7",
  papayawhip: "#ffefd5", blanchedalmond: "#ffebcd", bisque: "#ffe4c4",
  moccasin: "#ffe4b5", navajowhite: "#ffdead", peachpuff: "#ffdab9",
  cornsilk: "#fff8dc", lemonchiffon: "#fffacd", lightyellow: "#ffffe0",
  lightgoldenrodyellow: "#fafad2", oldlace: "#fdf5e6", floralwhite: "#fffaf0",
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function toHex2(n: number): string {
  return clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
}

export function isHexColor(s: string): boolean {
  return /^#([0-9a-fA-F]{3,8})$/.test(s);
}

export function parseColor(raw: string): string | null {
  const s = raw.trim().toLowerCase();

  if (isHexColor(s)) return normalizeHex(s);
  if (NAMED_COLORS[s]) return NAMED_COLORS[s];

  const rgbMatch = s.match(
    /^rgba?\(\s*(\d+(?:\.\d+)?%?)\s*[,\s]\s*(\d+(?:\.\d+)?%?)\s*[,\s]\s*(\d+(?:\.\d+)?%?)\s*(?:[,/]\s*(\d+(?:\.\d+)?%?))?\s*\)$/
  );
  if (rgbMatch) {
    const r = parseChannel(rgbMatch[1], 255);
    const g = parseChannel(rgbMatch[2], 255);
    const b = parseChannel(rgbMatch[3], 255);
    const a = rgbMatch[4] ? parseChannel(rgbMatch[4], 1) : 1;
    return rgbaToHex(r, g, b, a);
  }

  const hslMatch = s.match(
    /^hsla?\(\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)%\s*[,\s]\s*(\d+(?:\.\d+)?)%\s*(?:[,/]\s*(\d+(?:\.\d+)?%?))?\s*\)$/
  );
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]);
    const sat = parseFloat(hslMatch[2]) / 100;
    const lit = parseFloat(hslMatch[3]) / 100;
    const a = hslMatch[4] ? parseChannel(hslMatch[4], 1) : 1;
    const [r, g, b] = hslToRgb(h, sat, lit);
    return rgbaToHex(r, g, b, a);
  }

  return null;
}

function parseChannel(raw: string, scale: number): number {
  if (raw.endsWith("%")) {
    return (parseFloat(raw) / 100) * scale;
  }
  const n = parseFloat(raw);
  return scale === 1 ? n : n;
}

function normalizeHex(hex: string): string {
  const h = hex.slice(1);
  if (h.length === 3) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  if (h.length === 4) return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  if (h.length === 6 || h.length === 8) return `#${h}`;
  return hex;
}

function rgbaToHex(r: number, g: number, b: number, a: number): string {
  const hex = `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
  if (a < 1) return hex + toHex2(a * 255);
  return hex;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r: number, g: number, b: number;
  if (h < 60)        { r = c; g = x; b = 0; }
  else if (h < 120)  { r = x; g = c; b = 0; }
  else if (h < 180)  { r = 0; g = c; b = x; }
  else if (h < 240)  { r = 0; g = x; b = c; }
  else if (h < 300)  { r = x; g = 0; b = c; }
  else               { r = c; g = 0; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export function hexToRgb(hex: string): { r: number; g: number; b: number; a: number } | null {
  const norm = normalizeHex(hex);
  const h = norm.slice(1);
  if (h.length < 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

export function hexToHsl(hex: string): string {
  const c = hexToRgb(hex);
  if (!c) return hex;
  const r = c.r / 255, g = c.g / 255, b = c.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return `hsl(0, 0%, ${(l * 100).toFixed(1)}%)`;
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) h = ((b - r) / d + 2) * 60;
  else h = ((r - g) / d + 4) * 60;
  return `hsl(${Math.round(h)}, ${(s * 100).toFixed(1)}%, ${(l * 100).toFixed(1)}%)`;
}
