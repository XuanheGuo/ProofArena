export type ExamRegion = "天津卷" | "北京卷" | "新高考全国卷";

export type Difficulty = "基础" | "中档" | "压轴";

export type QuestionType = "单选" | "多选" | "填空" | "解答";

export type VerificationStatus = "verified" | "partial" | "manual";

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
  summary: string[];
  scores: SolutionScores;
  scoringReason: string;
  verification: Verification;
  estimatedMinutes: number;
}

export interface LearningGuide {
  observation: string[];
  triggers: string[];
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
}
