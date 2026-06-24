import type { QualityReport } from "@/lib/types";

export type QualitySolutionInput = {
  origin?: string;
  keyTransform?: string;
  fullProcess?: string;
  summary?: string[];
  inspiration?: string;
  transferValue?: string;
  pitfalls?: string;
  limitations?: string[];
  verifiableSteps?: string;
  verificationDraft?: string[];
  suitableFor?: string[] | string;
  tradeoffs?: string[] | string;
  scoringReason?: string;
};

type Rule = {
  field: string;
  label: string;
  weight: number;
  warning: string;
  suggestion: string;
  strength: string;
  isPresent: (solution: QualitySolutionInput) => boolean;
};

function hasText(value?: string) {
  return Boolean(value?.trim());
}

function hasList(value?: string[] | string) {
  if (Array.isArray(value)) return value.some((item) => item.trim());
  return hasText(value);
}

const qualityRules: Rule[] = [
  {
    field: "origin",
    label: "思路来源",
    weight: 12,
    warning: "缺少思路来源，读者很难知道这条路线是怎么想到的。",
    suggestion: "补一句从题目条件、图像特征或目标量中得到的入口观察。",
    strength: "有思路来源，适合做“怎么想到”的学习复盘。",
    isPresent: (solution) => hasText(solution.origin),
  },
  {
    field: "keyTransform",
    label: "关键转化",
    weight: 12,
    warning: "缺少关键转化，解法的核心跃迁不够清楚。",
    suggestion: "明确写出真正改变问题形态的一步，例如换元、构造、消元或放缩。",
    strength: "关键转化清楚，便于比较这条路线的结构价值。",
    isPresent: (solution) => hasText(solution.keyTransform),
  },
  {
    field: "fullProcess",
    label: "完整过程",
    weight: 14,
    warning: "缺少完整过程，暂时不能作为可独立阅读的题解。",
    suggestion: "把推理拆成可复算的步骤，尤其不要跳过决定正确性的边界条件。",
    strength: "完整过程已填写，可以进入步骤级审核。",
    isPresent: (solution) => hasText(solution.fullProcess) || hasList(solution.summary),
  },
  {
    field: "inspiration",
    label: "启发点",
    weight: 10,
    warning: "缺少启发点，解法容易只剩答案而不利于迁移。",
    suggestion: "写出这条解法最值得别人学走的观察。",
    strength: "启发点明确，符合 ProofArena 的学习导向。",
    isPresent: (solution) => hasText(solution.inspiration),
  },
  {
    field: "transferValue",
    label: "迁移价值",
    weight: 10,
    warning: "缺少迁移价值，读者不知道它还能用于哪些题型。",
    suggestion: "补充可迁移到的题型、常见设问或方法模型。",
    strength: "迁移价值已说明，有助于沉淀思路库。",
    isPresent: (solution) => hasText(solution.transferValue),
  },
  {
    field: "pitfalls",
    label: "易错点",
    weight: 10,
    warning: "缺少易错点，维护者还不能判断这条解法的风险位置。",
    suggestion: "标出定义域、符号、分类讨论、取等条件或点序对应等风险。",
    strength: "易错点已标注，适合学生复盘避坑。",
    isPresent: (solution) => hasText(solution.pitfalls) || hasList(solution.limitations),
  },
  {
    field: "verifiableSteps",
    label: "可验证步骤",
    weight: 10,
    warning: "缺少可验证步骤，暂时不便做人工复核或 CAS/数值检查。",
    suggestion: "列出可以代入、作图、数值验证或符号复算的关键结论。",
    strength: "可验证步骤已给出，方便后续审核。",
    isPresent: (solution) => hasText(solution.verifiableSteps) || hasList(solution.verificationDraft),
  },
  {
    field: "suitableForAndTradeoffs",
    label: "适用场景和局限",
    weight: 12,
    warning: "缺少适用场景或局限，解法画像还不完整。",
    suggestion: "同时写清适合谁看，以及它的代价、局限或不适合场景。",
    strength: "适用场景和局限都已填写，便于做解法导航。",
    isPresent: (solution) => hasList(solution.suitableFor) && hasList(solution.tradeoffs),
  },
  {
    field: "scoringReason",
    label: "评分理由",
    weight: 10,
    warning: "缺少评分理由，五维评分会显得像孤立数字。",
    suggestion: "用一句话说明考场性、结构美感、计算量或讲解友好的主要依据。",
    strength: "评分理由已填写，能削弱单一分数带来的误读。",
    isPresent: (solution) => hasText(solution.scoringReason),
  },
];

export function checkSolutionQuality(solution: QualitySolutionInput): QualityReport {
  const passedRules = qualityRules.filter((rule) => rule.isPresent(solution));
  const failedRules = qualityRules.filter((rule) => !rule.isPresent(solution));
  const maxScore = qualityRules.reduce((sum, rule) => sum + rule.weight, 0);
  const score = passedRules.reduce((sum, rule) => sum + rule.weight, 0);

  const warnings = failedRules.map((rule) => rule.warning);
  const suggestions = failedRules.map((rule) => rule.suggestion);
  const strengths = passedRules.map((rule) => rule.strength);

  if (passedRules.length >= 7) {
    strengths.unshift("核心学习信息较完整，已经接近可收录草稿。");
  }

  if (failedRules.length >= 4) {
    warnings.unshift("当前更像解题笔记，还没有达到 ProofArena 可学习、可比较、可验证的题解标准。");
  }

  return {
    completenessScore: Math.round((score / maxScore) * 100),
    warnings,
    suggestions,
    missingFields: failedRules.map((rule) => rule.label),
    strengths,
  };
}
