export type ExamRegion = "天津卷" | "北京卷" | "新高考 I 卷" | "新高考 II 卷" | "清华强基" | "北大强基";

export type Difficulty = "基础" | "中档" | "压轴";

export type QuestionType = "单选" | "多选" | "填空" | "解答";

export type VerificationStatus = "verified" | "partial" | "manual";

export type TagMatchSource = "auto" | "manual";

export type SolutionKind = "standard" | "insight" | "robust" | "teaching";

export type ContestStatus = "draft" | "active" | "judging" | "finished";

export type ContestSolutionType =
  | "standard"
  | "clever"
  | "teaching"
  | "geometry"
  | "algebra"
  | "construction"
  | "wrong_analysis"
  | "variant"
  | "supplement";

export type ContestAwardType =
  | "fastest"
  | "best_standard"
  | "best_clever"
  | "best_teaching"
  | "best_wrong_analysis"
  | "best_comment"
  | "best_overall"
  | "best_variant"
  | "best_contributor";

export const SCORE_DIMS = ["correctness", "examReady", "elegance", "calculation", "explanation"] as const;
export type ScoreDim = typeof SCORE_DIMS[number];
export type SolutionScores = Record<ScoreDim, number>;

export interface ConceptLink {
  conceptId?: string;
  label: string;
  relation: string;
  note: string;
}

export interface ConceptContrast {
  conceptA: string;
  conceptB: string;
  relationship: string;
  keyDifference: string;
  commonMistake: string;
  exampleProblemIds: string[];
}

export interface BoundaryNote {
  title: string;
  note: string;
  typicalMisuse?: string;
}

export interface ContrastProblem {
  problemId: string;
  role: "相似题" | "反例题" | "边界题" | "迁移题" | "对比题";
  focus: string;
  reason: string;
}

export interface WhyNotMethod {
  methodName: string;
  reason: string;
  whenItWouldWork: string;
  relatedConcepts: string[];
}

export interface TagMatch {
  tag: string;
  matchedKnowledgeIds: string[];
  matchedInsightIds: string[];
  confidence: number;
  source: TagMatchSource;
}

/** Shared pedagogical annotation fields used by both Problem and Solution. */
export interface PedagogicalAnnotations {
  knowledgeIds?: string[];
  insightIds?: string[];
  autoMatches?: TagMatch[];
  manualMatches?: TagMatch[];
  conceptLinks?: ConceptLink[];
  conceptContrasts?: ConceptContrast[];
  boundaryNotes?: BoundaryNote[];
  contrastProblems?: ContrastProblem[];
  whyNotMethods?: WhyNotMethod[];
}

export interface QualityReport {
  completenessScore: number;
  warnings: string[];
  suggestions: string[];
  missingFields: string[];
  strengths: string[];
}

export interface KnowledgeNode {
  id: string;
  title: string;
  category: string;
  summary: string;
  aliases: string[];
  prerequisites: string[];
  relatedIds: string[];
  examples: string[];
  conceptLinks?: ConceptLink[];
  conceptContrasts?: ConceptContrast[];
  boundaryNotes?: BoundaryNote[];
  contrastProblems?: ContrastProblem[];
  whyNotMethods?: WhyNotMethod[];
}

export interface InsightNode {
  id: string;
  title: string;
  trigger: string;
  idea: string;
  appliesTo: string[];
  relatedKnowledgeIds: string[];
  relatedProblemIds: string[];
  difficulty: Difficulty;
}

export interface Verification {
  status: VerificationStatus;
  engine: string;
  statement: string;
  checks: string[];
  verifiedScope: string[];
  unverifiedScope: string[];
  reviewNote: string;
}

export interface ThinkingCues {
  observations: string[];
  keySignals: string[];
  reasoning: string;
  suggestedMethods: string[];
  confidence?: number;
  forkOf?: {
    solutionId: string;
    solutionTitle: string;
    solutionAuthor: string;
  };
}

export interface SolutionChallenge {
  targetSolutionId: string;
  targetSolutionTitle?: string;
  targetSolutionAuthor?: string;
  claim: string;
  advantages: string[];
  risk: string;
}

export interface Solution extends PedagogicalAnnotations {
  id: string;
  kind: SolutionKind;
  title: string;
  author: string;
  authorRole: string;
  authorId?: string | null;
  sourceSubmissionId?: string | null;
  challenge?: SolutionChallenge | null;
  contestSolutionType?: ContestSolutionType | null;
  isPostContest?: boolean;
  tags: string[];
  badge: string;
  origin: string;
  keyTransform: string;
  thinkingCues: ThinkingCues;
  inspiration: string;
  transferValue: string;
  suitableFor: string[];
  tradeoffs: string[];
  limitations: string[];
  summary: string[];
  scores: SolutionScores;
  scoringReason: string;
  verification: Verification;
  estimatedMinutes: number;
}

export type ContestProblemStatus = "locked" | "open" | "reviewing" | "closed";
export type ContestProblemUnlockMode = "manual" | "auto_time";

export interface ContestProblem {
  id: string;
  contestId: string;
  problemId: string | null;
  dayIndex: number;
  title: string;
  theme: string;
  openAt: string;
  closeAt: string;
  weight: number;
  status: ContestProblemStatus;
  unlockMode: ContestProblemUnlockMode;
}

/** Compute the effective display status based on unlock mode and current time. */
export function getEffectiveProblemStatus(problem: ContestProblem, now = new Date()): ContestProblemStatus {
  if (problem.unlockMode === "auto_time") {
    if (now >= new Date(problem.closeAt)) return "closed";
    if (now >= new Date(problem.openAt)) return "open";
    return "locked";
  }
  return problem.status;
}

export interface ContestAward {
  id: string;
  contestId: string;
  problemId?: string;
  solutionId?: string;
  userId?: string;
  type: ContestAwardType;
  title: string;
  reason: string;
  points: number;
  createdAt: string;
}

export interface Contest {
  id: string;
  slug: string;
  title: string;
  description: string;
  tagline: string;
  rules: string[];
  startAt: string;
  endAt: string;
  discussionStartAt?: string | null;
  discussionEndAt?: string | null;
  status: ContestStatus;
  problems: ContestProblem[];
  awards: ContestAward[];
}

export interface LearningGuide {
  observation: string[];
  triggers: string[];
  pitfalls: string[];
  readingPath: string[];
  recommendation: string;
}

export interface SolutionTreeMethod {
  id: string;
  title: string;
  description?: string;
  solutionIds?: string[];
  children?: SolutionTreeMethod[];
}

export interface SolutionTreeRoot {
  id: string;
  title: string;
  description: string;
  methods: SolutionTreeMethod[];
}

export interface SolutionTree {
  roots: SolutionTreeRoot[];
}

export interface Problem extends PedagogicalAnnotations {
  id: string;
  year: number;
  region: ExamRegion;
  paper: string;
  number: string;
  difficulty: Difficulty;
  questionType: QuestionType;
  tags: string[];
  title: string;
  statement: string[];
  answer: string;
  heat: number;
  sourcePdf: string;
  sourcePage: number;
  answerPdf?: string;
  learningGuide: LearningGuide;
  solutionTree?: SolutionTree;
  proofGraph?: ProofGraphV1;
  dataSource?: "supabase" | "static-fallback";
  dataNotice?: string;
  solutions: Solution[];
}

// ─── Proof Graph v1 ──────────────────────────────────────────────────────────

export interface ProofObservation {
  id: string;
  title: string;
  signal: string;
  whyItMatters: string;
  relatedSolutionIds: string[];
}

export interface ProofStrategyBranch {
  id: string;
  observationId: string;
  title: string;
  promise: string;
  risk: string;
  methodBoundaryIds?: string[];
  solutionIds: string[];
}

export interface ProofTransformation {
  id: string;
  solutionId: string;
  title: string;
  from: string;
  to: string;
  justification: string;
  complexityReduction: string;
}

export interface ProofVerificationStep {
  id: string;
  solutionId: string;
  type: "substitution" | "boundary" | "equality" | "numeric" | "cas" | "manual";
  statement: string;
  status: VerificationStatus;
  note: string;
}

export interface ProofMethodBoundary {
  id: string;
  methodName: string;
  whyTempting: string;
  whyNotPriority: string;
  whereItBreaks: string;
  whenItWorks: string;
  relatedConcepts: string[];
}

export interface ProofChallengeEdge {
  id: string;
  challengerSolutionId: string;
  targetSolutionId: string;
  claim: string;
  advantages: string[];
  risk: string;
  reviewerNote?: string;
}

export interface ProofGraphV1 {
  observations: ProofObservation[];
  branches: ProofStrategyBranch[];
  transformations: ProofTransformation[];
  verificationSteps: ProofVerificationStep[];
  methodBoundaries: ProofMethodBoundary[];
  challengeEdges: ProofChallengeEdge[];
}

// ─────────────────────────────────────────────────────────────────────────────

export type GraphColor = "cyan" | "amber" | "red" | "green" | "violet" | "zinc";

export interface SliderParam {
  name: string;
  label: string;
  min: number;
  max: number;
  step: number;
  initial: number;
}

export interface TraceSpec {
  fn: (x: number, p: Record<string, number>) => number;
  color?: GraphColor;
  style?: "solid" | "dashed";
  width?: number;
  label?: string;
  domain?: [number, number];
}

export interface PointSpec {
  x: number | ((p: Record<string, number>) => number);
  y: number | ((p: Record<string, number>) => number);
  label?: string;
  color?: GraphColor;
}

export interface FunctionGraphSpec {
  title: string;
  description: string;
  insight?: string;
  boundingBox: [number, number, number, number];
  keepAspectRatio?: boolean;
  sliders: SliderParam[];
  traces?: TraceSpec[];
  points?: PointSpec[];
  draw?: (
    board: JXG.Board,
    sliders: Map<string, JXG.Slider>,
    colors: Record<GraphColor, string>,
    dark: boolean
  ) => void;
}
