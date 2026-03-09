/**
 * ChainRenderer — renders the resolution chain with clickable links and arrow connectors.
 */

import type { ChainStep } from "../core/types";

export function renderChain(
  chain: ChainStep[],
  maxLength: number,
  _tokenDirs: string[],
): string {
  if (!chain.length) return "";

  const steps = chain.length > maxLength ? chain.slice(0, maxLength) : chain;
  const lines: string[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const args = encodeURIComponent(
      JSON.stringify([{ file: step.file, token: step.token }]),
    );
    const link = `[${step.token}](command:sxlResolver.revealToken?${args})`;
    const fileName = step.file.split("/").pop() ?? step.file;
    const arrow = i < steps.length - 1 ? " &nbsp;→" : " &nbsp;●";
    lines.push(`${arrow} ${link} &nbsp; \`${fileName}\``);
  }

  if (chain.length > maxLength) {
    lines.push(`&nbsp;&nbsp;&nbsp; ... +${chain.length - maxLength} more`);
  }

  return lines.join("\n\n");
}

export function renderCompactChain(chain: ChainStep[]): string {
  if (!chain.length) return "";
  return chain.map((s) => `\`${s.token}\``).join(" → ");
}
