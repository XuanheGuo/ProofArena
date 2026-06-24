export type ExamRegion = "天津卷" | "北京卷" | "新高考全国卷";

export type Difficulty = "基础" | "中档" | "压轴";

export type QuestionType = "单选" | "多选" | "填空" | "解答";

export type VerificationStatus = "verified" | "partial" | "manual";

export type TagMatchSource = "auto" | "manual";

export interface KnowledgeNode {
  id: string;
  title: string;
  category: string;
  summary: string;
  aliases: string[];
  prerequisites: string[];
  relatedIds: string[];
  examples: string[];
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

export interface Solution {
  id: string;
  title: string;
  author: string;
  authorRole: string;
  tags: string[];
  badge: string;
  origin: string;
  keyTransform: string;
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
}

export interface LearningGuide {
  observation: string[];
  triggers: string[];
  pitfalls: string[];
  readingPath: string[];
  recommendation: string;
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
  solutions: Solution[];
  knowledgeIds?: string[];
  insightIds?: string[];
  autoMatches?: TagMatch[];
  manualMatches?: TagMatch[];
}
