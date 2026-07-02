export type ExamRegion = "天津卷" | "北京卷" | "新高考 I 卷" | "新高考 II 卷";

export type Difficulty = "基础" | "中档" | "压轴";

export type QuestionType = "单选" | "多选" | "填空" | "解答";

export type VerificationStatus = "verified" | "partial" | "manual";

export type TagMatchSource = "auto" | "manual";

export type SolutionKind = "standard" | "insight" | "robust" | "teaching";

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

export interface TagMatch {
  tag: string;
  matchedKnowledgeIds: string[];
  matchedInsightIds: string[];
  confidence: number;
  source: TagMatchSource;
}

export interface QualityReport {
  completenessScore: number;
  warnings: string[];
  suggestions: string[];
  missingFields: string[];
  strengths: string[];
}

export interface SolutionScores {
  correctness: number;
  examReady: number;
  elegance: number;
  calculation: number;
  explanation: number;
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
}

export interface Solution {
  id: string;
  kind: SolutionKind;
  title: string;
  author: string;
  authorRole: string;
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
  /** Custom draw function for complex visualizations (parametric curves, dynamic geometry). Called after sliders are created. */
  draw?: (
    board: JXG.Board,
    sliders: Map<string, JXG.Slider>,
    colors: Record<GraphColor, string>,
    dark: boolean
  ) => void;
}

export interface Problem {
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
  solutions: Solution[];
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
