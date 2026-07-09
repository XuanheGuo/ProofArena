import type { ContestAccessMode, ContestAwardType, ContestProblemPhase, ContestRegistrationStatus, ContestSolutionType, ContestStatus } from "@/lib/types";

export const accessModeMeta: Record<ContestAccessMode, { label: string; description: string }> = {
  open: {
    label: "公开（open）",
    description: "登录用户即可直接提交，无需报名。",
  },
  approval: {
    label: "报名审批（approval）",
    description: "用户需先申请参赛，管理员批准后才能提交。",
  },
  invite: {
    label: "邀请制（invite）",
    description: "只有管理员邀请的用户才能提交，不支持自助报名。",
  },
};

export const contestRegistrationStatusMeta: Record<ContestRegistrationStatus, { label: string; className: string }> = {
  invited: { label: "已邀请", className: "border-cyan-400/40 bg-cyan-400/[0.07] text-cyan-300" },
  pending: { label: "待审核", className: "border-amber-400/40 bg-amber-400/[0.07] text-amber-300" },
  approved: { label: "已批准", className: "border-emerald-500/40 bg-emerald-500/[0.07] text-emerald-300" },
  rejected: { label: "已拒绝", className: "border-red-500/40 bg-red-500/[0.07] text-red-300" },
  removed: { label: "已移除", className: "border-zinc-500/40 bg-zinc-800 text-zinc-400" },
  suspended: { label: "已暂停", className: "border-orange-500/40 bg-orange-500/[0.07] text-orange-300" },
};

export const contestStatusMeta: Record<ContestStatus, { label: string; className: string }> = {
  draft: {
    label: "未开始",
    className: "border-zinc-500/50 bg-zinc-800 text-zinc-300",
  },
  active: {
    label: "进行中",
    className: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300",
  },
  judging: {
    label: "评审中",
    className: "border-amber-500/50 bg-amber-500/15 text-amber-300",
  },
  finished: {
    label: "已结束",
    className: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  },
};

// See docs/WEEKLY_CONTEST_FORMAT.md §1 for what each phase means.
export const contestProblemPhaseMeta: Record<ContestProblemPhase, { label: string; className: string }> = {
  daily: {
    label: "普通题",
    className: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
  },
  challenge: {
    label: "挑战题",
    className: "border-red-400/30 bg-red-400/10 text-red-300",
  },
  sprint: {
    label: "计时题",
    className: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  },
  major: {
    label: "解答题",
    className: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  },
  discussion: {
    label: "讨论题",
    className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
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
