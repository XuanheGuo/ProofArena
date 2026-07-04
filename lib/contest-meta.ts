import type { ContestAwardType, ContestSolutionType, ContestStatus } from "@/lib/types";

export const contestStatusMeta: Record<ContestStatus, { label: string; className: string }> = {
  draft: {
    label: "未开始",
    className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
  },
  active: {
    label: "进行中",
    className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  },
  judging: {
    label: "评审中",
    className: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  },
  finished: {
    label: "已结束",
    className: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
  },
};

export const contestSolutionTypeMeta: Record<ContestSolutionType, { label: string; shortLabel: string }> = {
  standard: { label: "标准解", shortLabel: "标准" },
  clever: { label: "巧解", shortLabel: "巧解" },
  teaching: { label: "教学解", shortLabel: "教学" },
  geometry: { label: "几何解", shortLabel: "几何" },
  algebra: { label: "代数解", shortLabel: "代数" },
  construction: { label: "构造解", shortLabel: "构造" },
  wrong_analysis: { label: "错解分析", shortLabel: "错析" },
  variant: { label: "题目变式", shortLabel: "变式" },
  supplement: { label: "补充说明", shortLabel: "补充" },
};

export const contestAwardMeta: Record<ContestAwardType, string> = {
  fastest: "最快正确解",
  best_standard: "最佳标准解",
  best_clever: "最佳巧解",
  best_teaching: "最佳教学解",
  best_wrong_analysis: "最佳错解分析",
  best_comment: "最佳评论",
  best_overall: "全场最佳解法",
  best_variant: "最佳题目变式",
  best_contributor: "最佳贡献者",
};

export const contestSolutionTypeOptions = Object.entries(contestSolutionTypeMeta).map(([value, meta]) => ({
  value: value as ContestSolutionType,
  label: meta.label,
}));
