import type { SolutionKind } from "@/lib/types";

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
    className: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  },
  insight: {
    label: "启发解",
    shortLabel: "启发",
    description: "结构观察，打开思路",
    className: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  },
  robust: {
    label: "稳健解",
    shortLabel: "稳健",
    description: "计算较多，但容错高",
    className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  },
  teaching: {
    label: "教学解",
    shortLabel: "教学",
    description: "层次清楚，适合讲解",
    className: "border-red-400/30 bg-red-400/10 text-red-200",
  },
};

export function getSolutionKindMeta(kind: SolutionKind) {
  return solutionKindMeta[kind];
}
