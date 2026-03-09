/**
 * Shadow preview — visualizes drop/inner shadow tokens on a modern card.
 */

import type { ResolvedProperty } from "../core/types";
import { svgToMarkdownImage, THEME } from "./svgUtils";
import { parseColor } from "../utils/colorParser";
import { extractNumber } from "../utils/mathEvaluator";

const W = THEME.previewW;
const H = 80;
const BOX = 44;

export function renderShadowPreview(props: Record<string, ResolvedProperty>): string {
  const shadows = groupShadowLayers(props);
  if (!shadows.length) return "";

  const filters = shadows.map((s, i) => {
    return `<feDropShadow dx="${s.x}" dy="${s.y}" stdDeviation="${s.blur / 2}"
              flood-color="${s.color}" flood-opacity="${s.opacity}" result="s${i}"/>`;
  }).join("\n");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" rx="8" fill="${THEME.bg}"/>
    <defs>
      <filter id="sf" x="-50%" y="-50%" width="200%" height="200%">
        ${filters}
      </filter>
    </defs>
    <rect x="${(W - BOX) / 2}" y="${(H - BOX) / 2}" width="${BOX}" height="${BOX}" rx="8"
          fill="${THEME.text}" filter="url(#sf)"/>
  </svg>`;

  return svgToMarkdownImage(svg, "shadow");
}

interface ShadowLayer {
  x: number; y: number; blur: number; spread: number; color: string; opacity: number; type: string;
}

function groupShadowLayers(props: Record<string, ResolvedProperty>): ShadowLayer[] {
  const groups = new Map<string, Record<string, string>>();

  for (const [key, data] of Object.entries(props)) {
    const dotIdx = key.indexOf(".");
    if (dotIdx < 0) continue;
    const groupId = key.slice(0, dotIdx);
    const prop = key.slice(dotIdx + 1);
    if (!groups.has(groupId)) groups.set(groupId, {});
    groups.get(groupId)![prop] = data.resolvedValue;
  }

  if (groups.size === 0 && Object.keys(props).length > 0) {
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(props)) flat[k] = v.resolvedValue;
    groups.set("1", flat);
  }

  return Array.from(groups.values()).map((g) => ({
    x: extractNumber(g.x ?? g.offsetX ?? "0") ?? 0,
    y: extractNumber(g.y ?? g.offsetY ?? "0") ?? 0,
    blur: extractNumber(g.blur ?? "0") ?? 0,
    spread: extractNumber(g.spread ?? "0") ?? 0,
    color: parseColor(g.color ?? "#000000") ?? "#000000",
    opacity: g.color?.includes("rgba") ? 0.5 : 0.6,
    type: g.type ?? "dropShadow",
  }));
}
