import type { ScoringContestProblem } from "@/components/AdminContestScoringView";
import type {
  ContestAnswerType,
  ContestSolutionType,
  SolutionScores,
} from "@/lib/types";

export type SubmissionStatus =
  "pending" | "approved" | "rejected" | "needs_revision" | "precheck_failed";
export type SolutionKind = "standard" | "insight" | "robust" | "teaching";

export type SubmissionContent = {
  markdown?: string;
  json?: {
    solution?: Record<string, unknown>;
    [key: string]: unknown;
  };
  approach?: string;
  keyTransform?: string;
  steps?: string;
  insight?: string;
  verification?: string;
  [key: string]: unknown;
};

export type Submission = {
  id: string;
  submission_type: "problem" | "solution";
  problem_id: string | null;
  draft_problem_id?: string | null;
  problem_source: string | null;
  kind: SolutionKind;
  title: string;
  content: SubmissionContent;
  status: SubmissionStatus;
  created_at: string;
  user_id: string;
  moderator_notes?: string | null;
  contest_slug?: string | null;
  contest_problem_key?: string | null;
  contest_solution_type?: ContestSolutionType | null;
  is_post_contest?: boolean | null;
  attachment_urls?: string[] | null;
  challenge_target_solution_id?: string | null;
  challenge_claim?: string | null;
  challenge_advantages?: string[] | null;
  challenge_risk?: string | null;
};

export type ScoringContest = {
  id: string;
  slug: string;
  title: string;
  contest_problems: ScoringContestProblem[];
};

export type ContestProblemAnswerKeyRow = {
  contest_problem_id: string;
  answer_type: ContestAnswerType;
  answer_key: unknown;
  format_note: string;
};

export type ContestProblemAnswerHint = {
  contestProblemId: string;
  contestId: string;
  contestProblemTitle: string;
  problemPhase: string;
  scoreMax: number;
  answerType: ContestAnswerType | null;
  answerFormatNote: string;
  answerKey: unknown;
  referenceAnswer: string;
};

export type ContestSubmissionScoreRow = {
  id: string;
  contest_problem_id: string;
  submission_id: string | null;
  user_id: string;
  raw_score: number;
  judge_note: string;
  scored_at: string | null;
};

export type InlineScoreDraft = {
  rawScore: string;
  judgeNote: string;
};

export function isForkPR(submission: Submission): boolean {
  const solution = submission.content.json?.solution;
  return Boolean(
    solution &&
    typeof solution === "object" &&
    "forkOf" in solution &&
    solution.forkOf,
  );
}

export function isContestSubmission(submission: Submission): boolean {
  return Boolean(submission.contest_slug);
}

export type ReviewForm = {
  title: string;
  kind: SolutionKind;
  tags: string;
  origin: string;
  keyTransform: string;
  process: string;
  inspiration: string;
  transferValue: string;
  suitableFor: string;
  tradeoffs: string;
  pitfalls: string;
  verifiableSteps: string;
  challengeTargetSolutionId: string;
  challengeTargetSolutionTitle: string;
  challengeTargetSolutionAuthor: string;
  challengeClaim: string;
  challengeAdvantages: string;
  challengeRisk: string;
  scores: SolutionScores;
  scoringReason: string;
  moderatorNotes: string;
  graphObservationSignal: string;
  graphObservationWhy: string;
  graphTransformFrom: string;
  graphTransformTo: string;
  graphTransformJustification: string;
  graphTransformComplexityReduction: string;
  graphBoundaryName: string;
  graphBoundaryWhyTempting: string;
  graphBoundaryWhyNotPriority: string;
  graphBoundaryWhereItBreaks: string;
  graphBoundaryWhenItWorks: string;
  forkOf: string;
};

export const scoreLabels: Array<[keyof SolutionScores, string, string]> = [
  ["correctness", "正确性", "推理是否严密"],
  ["examReady", "考场性", "时间和入口是否可控"],
  ["elegance", "结构美感", "转化是否自然简洁"],
  ["calculation", "计算量", "展开和重复运算是否少"],
  ["explanation", "讲解友好", "是否便于复盘迁移"],
];

export const kindLabels: Record<SolutionKind, string> = {
  standard: "标准解",
  insight: "启发解",
  robust: "稳健解",
  teaching: "教学解",
};

export const defaultScores: SolutionScores = {
  correctness: 8,
  examReady: 8,
  elegance: 8,
  calculation: 8,
  explanation: 8,
};

export function splitList(value: string) {
  return value
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function splitProcess(value: string) {
  if (!value.trim()) return [];

  const chineseStepRe = /第[一二三四五六七八九十百]+步[:：]?/;
  if (chineseStepRe.test(value)) {
    return value
      .split(/(?=第[一二三四五六七八九十百]+步)/)
      .map((chunk) =>
        chunk.replace(/^第[一二三四五六七八九十百]+步[:：]?\s*/, "").trim(),
      )
      .filter(Boolean);
  }

  const numericStepRe = /^\s*\d+[.)、]/m;
  if (numericStepRe.test(value)) {
    return value
      .split(/(?=^\s*\d+[.)、])/m)
      .map((chunk) => chunk.replace(/^\s*\d+[.)、]\s*/, "").trim())
      .filter(Boolean);
  }

  return value
    .split(/(?<=[。！？；])/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function joinList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join("\n");
  return typeof value === "string" ? value : "";
}

export function normalizeScore(value: unknown, fallback: number) {
  const score = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(score)) return fallback;
  return Math.min(10, Math.max(1, Math.round(score * 10) / 10));
}

export function normalizeScores(value: unknown): SolutionScores {
  const raw =
    value && typeof value === "object"
      ? (value as Partial<Record<keyof SolutionScores, unknown>>)
      : {};
  return {
    correctness: normalizeScore(raw.correctness, defaultScores.correctness),
    examReady: normalizeScore(raw.examReady, defaultScores.examReady),
    elegance: normalizeScore(raw.elegance, defaultScores.elegance),
    calculation: normalizeScore(raw.calculation, defaultScores.calculation),
    explanation: normalizeScore(raw.explanation, defaultScores.explanation),
  };
}

export function answerKeyToText(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item))
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value === "string") return value;
  if (value == null) return "";
  return JSON.stringify(value);
}

export const answerTypeLabels: Record<ContestAnswerType, string> = {
  single_choice: "单选",
  multiple_choice: "多选",
  fill_blank: "填空",
};

export function inlineScoreDraftFrom(
  score?: ContestSubmissionScoreRow,
): InlineScoreDraft {
  return {
    rawScore: score ? String(score.raw_score) : "",
    judgeNote: score?.judge_note ?? "",
  };
}

export function buildMarkdown(submission: Submission, form: ReviewForm) {
  return `# 解法投稿：${form.title}

## 对应题目
${submission.problem_source ?? submission.problem_id ?? "（未绑定）"}

## 类型
${kindLabels[form.kind]}

${
  form.challengeTargetSolutionId
    ? `## 挑战对象
${form.challengeTargetSolutionTitle || form.challengeTargetSolutionId}${form.challengeTargetSolutionAuthor ? ` / ${form.challengeTargetSolutionAuthor}` : ""}

## 我比它强在哪里
${form.challengeClaim || "（未填写）"}

## 优势标签
${
  splitList(form.challengeAdvantages)
    .map((item) => `- ${item}`)
    .join("\n") || "（未填写）"
}

## 风险自评
${form.challengeRisk || "（未填写）"}

`
    : ""
}## 标签
${
  splitList(form.tags)
    .map((tag) => `- ${tag}`)
    .join("\n") || "（未填写）"
}

## 思路来源
${form.origin || "（未填写）"}

## 关键转化
${form.keyTransform || "（未填写）"}

## 完整过程
${form.process || "（未填写）"}

## 启发点
${form.inspiration || "（未填写）"}

## 迁移价值
${form.transferValue || "（未填写）"}

## 适用场景
${
  splitList(form.suitableFor)
    .map((item) => `- ${item}`)
    .join("\n") || "（未填写）"
}

## 代价与局限
${
  splitList(form.tradeoffs)
    .map((item) => `- ${item}`)
    .join("\n") || "（未填写）"
}

## 易错点
${
  splitList(form.pitfalls)
    .map((item) => `- ${item}`)
    .join("\n") || "（未填写）"
}

## 可验证步骤
${
  splitList(form.verifiableSteps)
    .map((item) => `- ${item}`)
    .join("\n") || "（未填写）"
}

## 五维自评
${scoreLabels.map(([key, label]) => `- ${label}：${form.scores[key].toFixed(1)}`).join("\n")}

## 评分理由
${form.scoringReason || "（未填写）"}
`;
}

export function formFromSubmission(submission: Submission): ReviewForm {
  const solution = submission.content.json?.solution ?? {};
  const challenge =
    solution.challenge && typeof solution.challenge === "object"
      ? (solution.challenge as Record<string, unknown>)
      : {};
  const scores = normalizeScores(solution.scores);

  return {
    title: String(solution.title ?? submission.title ?? ""),
    kind: (solution.kind ?? submission.kind ?? "standard") as SolutionKind,
    tags: joinList(solution.tags),
    origin: String(solution.origin ?? submission.content.approach ?? ""),
    keyTransform: String(
      solution.keyTransform ?? submission.content.keyTransform ?? "",
    ),
    process: String(solution.process ?? submission.content.steps ?? ""),
    inspiration: String(
      solution.inspiration ?? submission.content.insight ?? "",
    ),
    transferValue: String(solution.transferValue ?? ""),
    suitableFor: joinList(solution.suitableFor),
    tradeoffs: joinList(solution.tradeoffs),
    pitfalls: joinList(solution.pitfalls),
    verifiableSteps: joinList(
      solution.verifiableSteps ?? submission.content.verification,
    ),
    challengeTargetSolutionId: String(
      challenge.targetSolutionId ??
        submission.challenge_target_solution_id ??
        "",
    ),
    challengeTargetSolutionTitle: String(challenge.targetSolutionTitle ?? ""),
    challengeTargetSolutionAuthor: String(challenge.targetSolutionAuthor ?? ""),
    challengeClaim: String(challenge.claim ?? submission.challenge_claim ?? ""),
    challengeAdvantages: joinList(
      challenge.advantages ?? submission.challenge_advantages,
    ),
    challengeRisk: String(challenge.risk ?? submission.challenge_risk ?? ""),
    scores,
    scoringReason: String(solution.scoringReason ?? ""),
    moderatorNotes: submission.moderator_notes ?? "",
    graphObservationSignal: String(
      solution.observationSignal ?? submission.content.approach ?? "",
    ),
    graphObservationWhy: String(solution.observationWhy ?? ""),
    graphTransformFrom: String(
      solution.transformationFrom ?? submission.content.keyTransform ?? "",
    ),
    graphTransformTo: String(solution.transformationTo ?? ""),
    graphTransformJustification: String(
      solution.transformationJustification ?? "",
    ),
    graphTransformComplexityReduction: String(
      solution.transformationComplexityReduction ?? "",
    ),
    graphBoundaryName: String(solution.methodBoundaryName ?? ""),
    graphBoundaryWhyTempting: String(solution.methodBoundaryWhyTempting ?? ""),
    graphBoundaryWhyNotPriority: String(
      solution.methodBoundaryWhyNotPriority ?? "",
    ),
    graphBoundaryWhereItBreaks: String(
      solution.methodBoundaryWhereItBreaks ?? "",
    ),
    graphBoundaryWhenItWorks: String(solution.methodBoundaryWhenItWorks ?? ""),
    forkOf:
      typeof solution.forkOf === "object" && solution.forkOf !== null
        ? JSON.stringify(solution.forkOf)
        : "",
  };
}

export function contentFromForm(
  submission: Submission,
  form: ReviewForm,
): SubmissionContent {
  const previousJson = submission.content.json ?? {};
  const previousSolution = previousJson.solution ?? {};
  const solution = {
    ...previousSolution,
    kind: form.kind,
    title: form.title,
    tags: splitList(form.tags),
    origin: form.origin,
    keyTransform: form.keyTransform,
    process: form.process,
    inspiration: form.inspiration,
    transferValue: form.transferValue,
    suitableFor: splitList(form.suitableFor),
    tradeoffs: splitList(form.tradeoffs),
    pitfalls: splitList(form.pitfalls),
    verifiableSteps: splitList(form.verifiableSteps),
    challenge: form.challengeTargetSolutionId
      ? {
          targetSolutionId: form.challengeTargetSolutionId,
          targetSolutionTitle: form.challengeTargetSolutionTitle,
          targetSolutionAuthor: form.challengeTargetSolutionAuthor,
          claim: form.challengeClaim,
          advantages: splitList(form.challengeAdvantages),
          risk: form.challengeRisk,
        }
      : null,
    scores: form.scores,
    scoringReason: form.scoringReason,
    observationSignal: form.graphObservationSignal || undefined,
    observationWhy: form.graphObservationWhy || undefined,
    transformationFrom: form.graphTransformFrom || undefined,
    transformationTo: form.graphTransformTo || undefined,
    transformationJustification: form.graphTransformJustification || undefined,
    transformationComplexityReduction:
      form.graphTransformComplexityReduction || undefined,
    methodBoundaryName: form.graphBoundaryName || undefined,
    methodBoundaryWhyTempting: form.graphBoundaryWhyTempting || undefined,
    methodBoundaryWhyNotPriority: form.graphBoundaryWhyNotPriority || undefined,
    methodBoundaryWhereItBreaks: form.graphBoundaryWhereItBreaks || undefined,
    methodBoundaryWhenItWorks: form.graphBoundaryWhenItWorks || undefined,
    verificationSteps: form.verifiableSteps
      ? splitList(form.verifiableSteps)
      : undefined,
    forkOf: form.forkOf
      ? (() => {
          try {
            return JSON.parse(form.forkOf);
          } catch {
            return undefined;
          }
        })()
      : undefined,
  };

  return {
    ...submission.content,
    markdown: buildMarkdown(submission, form),
    json: {
      ...previousJson,
      solution,
    },
    approach: form.origin,
    keyTransform: form.keyTransform,
    steps: form.process,
    insight: form.inspiration,
    verification: form.verifiableSteps,
  };
}

export function computeSubmissionScopeKey(submission: Submission): string {
  if (submission.contest_problem_key)
    return `contest_problem:${submission.contest_problem_key}`;
  if (submission.problem_id) return `problem:${submission.problem_id}`;
  if (submission.draft_problem_id)
    return `draft_problem:${submission.draft_problem_id}`;
  return "general";
}
