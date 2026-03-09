/**
 * Token type icons, valid types, and classification helpers.
 */

import type { TokenType } from "./types";

export const TOKEN_ICONS: Record<string, string> = {
  color: "🎨",
  gradient: "🌈",
  fill: "🖌️",
  typography: "🔤",
  fontFamily: "🔤",
  fontWeight: "🔤",
  fontFamilies: "🔤",
  fontWeights: "🔤",
  fontSize: "🔤",
  fontSizes: "🔤",
  lineHeight: "🔤",
  lineHeights: "🔤",
  letterSpacing: "🔤",
  paragraphSpacing: "🔤",
  paragraphIndent: "🔤",
  textCase: "🔤",
  textDecoration: "🔤",
  shadow: "☁️",
  boxShadow: "☁️",
  blur: "💨",
  "backdrop-blur": "💨",
  glass: "🪟",
  effects: "✨",
  dimension: "📐",
  sizing: "📏",
  spacing: "↔️",
  borderRadius: "◼️",
  borderWidth: "➖",
  border: "🔲",
  strokeStyle: "〰️",
  opacity: "🌫️",
  number: "🔢",
  boolean: "✔️",
  string: "📝",
  text: "📝",
  grid: "⊞",
  transition: "⏱️",
  duration: "⏱️",
  cubicBezier: "📈",
  template: "📋",
  composition: "🧩",
  unknown: "❓",
};

export const VALID_TYPES = new Set<string>([
  "color",
  "gradient",
  "fill",
  "typography",
  "fontFamily",
  "fontWeight",
  "fontSize",
  "lineHeight",
  "letterSpacing",
  "paragraphSpacing",
  "paragraphIndent",
  "textCase",
  "textDecoration",
  "fontFamilies",
  "fontWeights",
  "fontSizes",
  "lineHeights",
  "shadow",
  "boxShadow",
  "blur",
  "backdrop-blur",
  "glass",
  "effects",
  "dimension",
  "sizing",
  "spacing",
  "borderRadius",
  "borderWidth",
  "border",
  "strokeStyle",
  "opacity",
  "number",
  "boolean",
  "string",
  "text",
  "grid",
  "transition",
  "duration",
  "cubicBezier",
  "template",
  "composition",
]);

/** Types that hold composite object values (not simple strings/numbers). */
export const COMPOSITE_TYPES = new Set<string>([
  "typography",
  "shadow",
  "boxShadow",
  "border",
  "composition",
  "template",
  "transition",
  "grid",
  "effects",
  "glass",
  "fill",
  "gradient",
]);

/** Numeric types where math evaluation applies. */
export const NUMERIC_TYPES = new Set<string>([
  "sizing",
  "spacing",
  "borderRadius",
  "borderWidth",
  "dimension",
  "number",
  "fontSize",
  "fontSizes",
  "lineHeight",
  "lineHeights",
  "letterSpacing",
  "paragraphSpacing",
  "paragraphIndent",
  "opacity",
  "duration",
]);

export function normalizeType(raw: string): TokenType {
  if (VALID_TYPES.has(raw)) return raw as TokenType;
  const lower = raw.toLowerCase();
  for (const t of VALID_TYPES) {
    if (t.toLowerCase() === lower) return t as TokenType;
  }
  return "unknown";
}
