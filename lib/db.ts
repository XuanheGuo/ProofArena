import { createClient } from '@/lib/supabase-server';
import { getProblem as getStaticProblem, problems as staticProblems } from '@/data/problems';
import type { Problem, Solution, SolutionScores } from '@/lib/types';

// ── Mappers ────────────────────────────────────────────────────────────────

function toSolution(row: Record<string, unknown>): Solution {
  return {
    id: row.id as string,
    kind: row.kind as Solution['kind'],
    title: row.title as string,
    author: row.author as string,
    authorRole: row.author_role as string,
    tags: (row.tags as string[]) ?? [],
    badge: row.badge as string,
    origin: row.origin as string,
    keyTransform: row.key_transform as string,
    thinkingCues: row.thinking_cues as Solution['thinkingCues'],
    inspiration: row.inspiration as string,
    transferValue: row.transfer_value as string,
    suitableFor: (row.suitable_for as string[]) ?? [],
    tradeoffs: (row.tradeoffs as string[]) ?? [],
    limitations: (row.limitations as string[]) ?? [],
    summary: (row.summary as string[]) ?? [],
    scores: row.scores as SolutionScores,
    scoringReason: row.scoring_reason as string,
    verification: row.verification as Solution['verification'],
    estimatedMinutes: row.estimated_minutes as number,
    knowledgeIds: (row.knowledge_ids as string[]) ?? [],
    insightIds: (row.insight_ids as string[]) ?? [],
    autoMatches: (row.auto_matches as Solution['autoMatches']) ?? [],
    manualMatches: (row.manual_matches as Solution['manualMatches']) ?? [],
    conceptLinks: row.concept_links as Solution['conceptLinks'],
    conceptContrasts: row.concept_contrasts as Solution['conceptContrasts'],
    boundaryNotes: row.boundary_notes as Solution['boundaryNotes'],
    contrastProblems: row.contrast_problems as Solution['contrastProblems'],
    whyNotMethods: row.why_not_methods as Solution['whyNotMethods'],
  };
}

function toProblem(row: Record<string, unknown>): Problem {
  const solutions = Array.isArray(row.solutions)
    ? (row.solutions as Record<string, unknown>[]).map(toSolution)
    : [];

  return {
    id: row.id as string,
    year: row.year as number,
    region: row.region as Problem['region'],
    paper: row.paper as string,
    number: row.number as string,
    difficulty: row.difficulty as Problem['difficulty'],
    questionType: row.question_type as Problem['questionType'],
    tags: (row.tags as string[]) ?? [],
    title: row.title as string,
    statement: (row.statement as string[]) ?? [],
    answer: row.answer as string,
    heat: (row.heat as number) ?? 0,
    sourcePdf: (row.source_pdf as string) ?? '',
    sourcePage: (row.source_page as number) ?? 1,
    answerPdf: row.answer_pdf as string | undefined,
    learningGuide: row.learning_guide as Problem['learningGuide'],
    solutionTree: row.solution_tree as Problem['solutionTree'],
    solutions,
    knowledgeIds: (row.knowledge_ids as string[]) ?? [],
    insightIds: (row.insight_ids as string[]) ?? [],
    autoMatches: (row.auto_matches as Problem['autoMatches']) ?? [],
    manualMatches: (row.manual_matches as Problem['manualMatches']) ?? [],
    conceptLinks: row.concept_links as Problem['conceptLinks'],
    conceptContrasts: row.concept_contrasts as Problem['conceptContrasts'],
    boundaryNotes: row.boundary_notes as Problem['boundaryNotes'],
    contrastProblems: row.contrast_problems as Problem['contrastProblems'],
    whyNotMethods: row.why_not_methods as Problem['whyNotMethods'],
  };
}

// ── Data Access ────────────────────────────────────────────────────────────

export async function getProblems(): Promise<Problem[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return staticProblems;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('problems')
    .select('*, solutions(*)')
    .order('heat', { ascending: false });

  if (error) {
    console.error('[db] getProblems error:', error.message, error.code);
    return staticProblems;
  }
  if (!data || data.length === 0) return staticProblems;
  return data.map(toProblem);
}

export async function getProblem(id: string): Promise<Problem | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return getStaticProblem(id) ?? null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('problems')
    .select('*, solutions(*)')
    .eq('id', id)
    .single();

  if (error || !data) return getStaticProblem(id) ?? null;
  return toProblem(data);
}

// ── Pure Utility Functions (no DB needed) ──────────────────────────────────

export function getLearningIndex(problem: Problem): string {
  const bestExplanation = Math.max(...problem.solutions.map((s) => s.scores.explanation));
  const bestExamReady = Math.max(...problem.solutions.map((s) => s.scores.examReady));
  const bestElegance = Math.max(...problem.solutions.map((s) => s.scores.elegance));
  return (bestExplanation * 0.5 + bestExamReady * 0.25 + bestElegance * 0.25).toFixed(1);
}

export function getAverageScore(problem: Problem): number {
  const values = problem.solutions.flatMap((s) => Object.values(s.scores));
  return values.reduce((sum, score) => sum + score, 0) / values.length;
}

export function getSolutionAverage(solution: Problem['solutions'][number]): number {
  const values = Object.values(solution.scores);
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function getBestSolution(
  problem: Problem,
  score: keyof Problem['solutions'][number]['scores']
): Problem['solutions'][number] {
  return [...problem.solutions].sort((a, b) => b.scores[score] - a.scores[score])[0];
}
