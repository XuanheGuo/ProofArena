import type { SolutionKind } from "@/lib/types";

// className values read [data-theme] CSS variables directly (app/globals.css)
// rather than hardcoded Tailwind color literals, so they can't silently fall
// out of the light/dark override whitelist — see docs/UI_UX_AUDIT.md A2.
export const solutionKindMeta: Record<SolutionKind, {
  label: string;
  shortLabel: string;
  description: string;
  className: string;
}> = {
  standard: {
    label: "标准解",
    shortLabel: "标准",
    description: "考场主线，稳定拿分",
    className:
      "border-[var(--accent-border)] bg-[var(--accent-soft)] text-[var(--accent)]",
  },
  insight: {
    label: "启发解",
    shortLabel: "启发",
    description: "结构观察，打开思路",
    className:
      "border-[var(--contest-border)] bg-[var(--contest-soft)] text-[var(--contest)]",
  },
  robust: {
    label: "稳健解",
    shortLabel: "稳健",
    description: "计算较多，但容错高",
    className:
      "border-[var(--verified-border)] bg-[var(--verified-soft)] text-[var(--verified)]",
  },
  teaching: {
    label: "教学解",
    shortLabel: "教学",
    description: "层次清楚，适合讲解",
    className:
      "border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)]",
  },
};

export function getSolutionKindMeta(kind: SolutionKind) {
  return solutionKindMeta[kind];
}
