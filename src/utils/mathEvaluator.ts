/**
 * Math expression evaluator for token values.
 * Handles expressions like: "{spacing.sm} * 2", "16px", "4 * 4px"
 */

import { create, all } from "mathjs";

const math = create(all, {});
math.import(
  { px: 1, em: 1, rem: 1, "%": 1, deg: 1, s: 1, ms: 1, pt: 1, vw: 1, vh: 1 },
  { override: true },
);

/** Try to evaluate a math expression. Returns the result string or the original on failure. */
export function evaluateMath(expr: string, unit?: string): string {
  const trimmed = expr.trim();

  if (/^-?\d+(\.\d+)?(px|em|rem|%|deg|s|ms|pt|vw|vh)?$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const result = math.evaluate(trimmed);
    if (typeof result === "number") {
      const suffix = unit ?? "";
      return `${result}${suffix}`;
    }
    return String(result);
  } catch {
    return trimmed;
  }
}

/** Extract numeric value from a string like "16px" -> 16 */
export function extractNumber(value: string): number | null {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

/** Extract unit from a string like "16px" -> "px" */
export function extractUnit(value: string): string {
  const match = value.trim().match(/(-?\d+(?:\.\d+)?)(px|em|rem|%|deg|s|ms|pt|vw|vh)?$/);
  return match?.[2] ?? "";
}
