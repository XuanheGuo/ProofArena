import { cache } from 'react';
import { createPublicClient } from '@/lib/supabase-public';
import { getProblem as getStaticProblem, problems as staticProblems } from '@/data/problems';
import { hasSupabasePublicEnv } from '@/lib/supabase-env';
import type { Problem, ProblemSummary, Solution, SolutionScores, SolutionSummary } from '@/lib/types';

// ── Mappers ────────────────────────────────────────────────────────────────

const DB_OFFLINE_NOTICE = '数据库暂时不可用，当前显示静态兜底题库；登录、投稿和最新社区内容可能暂时不同步。';

function markSupabaseProblem(problem: Problem): Problem {
  return { ...problem, dataSource: 'supabase', dataNotice: undefined };
}

function markFallbackProblem(problem: Problem, notice = DB_OFFLINE_NOTICE): Problem {
  return { ...problem, dataSource: 'static-fallback', dataNotice: notice };
}

function markFallbackProblems(problems: Problem[], notice = DB_OFFLINE_NOTICE): Problem[] {
  return problems.map((problem) => markFallbackProblem(problem, notice));
}

function toSolution(row: Record<string, unknown>): Solution {
  return {
    id: row.id as string,
    kind: row.kind as Solution['kind'],
    title: row.title as string,
    author: row.author as string,
    authorRole: row.author_role as string,
    authorId: row.author_id as string | null,
    sourceSubmissionId: row.source_submission_id as string | null,
    challenge: row.challenge_target_solution_id
      ? {
          targetSolutionId: row.challenge_target_solution_id as string,
          targetSolutionTitle: row.challenge_target_solution_title as string | undefined,
          targetSolutionAuthor: row.challenge_target_solution_author as string | undefined,
          claim: (row.challenge_claim as string) ?? '',
          advantages: (row.challenge_advantages as string[]) ?? [],
          risk: (row.challenge_risk as string) ?? '',
        }
      : null,
    contestSolutionType: row.contest_solution_type as Solution['contestSolutionType'],
    isPostContest: Boolean(row.is_post_contest),
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

  return markSupabaseProblem({
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
    // proof_graph: official per-problem ProofGraphV1, editorially approved.
    // Distinct from solution.thinking_cues.proofGraphDraft (solution-level draft).
    // Null on older rows — ProblemDetailExperience tolerates undefined gracefully.
    proofGraph: (row.proof_graph ?? undefined) as Problem['proofGraph'],
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
  });
}

function toSolutionSummary(row: Record<string, unknown>): SolutionSummary {
  return {
    id: row.id as string,
    title: row.title as string,
    inspiration: row.inspiration as string,
    scores: row.scores as SolutionScores,
  };
}

function pickSolutionSummary(solution: Solution): SolutionSummary {
  const { id, title, inspiration, scores } = solution;
  return { id, title, inspiration, scores };
}

function toProblemSummary(row: Record<string, unknown>): ProblemSummary {
  const solutions = Array.isArray(row.solutions)
    ? (row.solutions as Record<string, unknown>[]).map(toSolutionSummary)
    : [];
  const statement = (row.statement as string[]) ?? [];

  return {
    id: row.id as string,
    year: row.year as number,
    region: row.region as ProblemSummary['region'],
    paper: row.paper as string,
    number: row.number as string,
    difficulty: row.difficulty as ProblemSummary['difficulty'],
    questionType: row.question_type as ProblemSummary['questionType'],
    tags: (row.tags as string[]) ?? [],
    title: row.title as string,
    excerpt: statement[0] ?? '',
    heat: (row.heat as number) ?? 0,
    hasProofGraph: Boolean(row.proof_graph),
    solutions,
    dataSource: 'supabase',
    dataNotice: undefined,
  };
}

function toProblemSummaryFallback(problem: Problem, notice = DB_OFFLINE_NOTICE): ProblemSummary {
  return {
    id: problem.id,
    year: problem.year,
    region: problem.region,
    paper: problem.paper,
    number: problem.number,
    difficulty: problem.difficulty,
    questionType: problem.questionType,
    tags: problem.tags,
    title: problem.title,
    excerpt: problem.statement[0] ?? '',
    heat: problem.heat,
    hasProofGraph: Boolean(problem.proofGraph),
    solutions: problem.solutions.map(pickSolutionSummary),
    dataSource: 'static-fallback',
    dataNotice: notice,
  };
}

// ── Data Access ────────────────────────────────────────────────────────────

export async function getProblems(): Promise<Problem[]> {
  if (!hasSupabasePublicEnv()) {
    return markFallbackProblems(staticProblems, '未配置 Supabase 环境变量，当前使用静态题库。');
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('problems')
    .select('*, solutions(*)')
    .order('heat', { ascending: false });

  if (error) {
    console.error('[db] getProblems error:', error.message, error.code);
    return markFallbackProblems(staticProblems);
  }
  if (!data || data.length === 0) {
    return markFallbackProblems(staticProblems, '数据库题库为空，当前显示静态兜底题库。');
  }
  return data.map(toProblem);
}

export const getProblem = cache(async (id: string): Promise<Problem | null> => {
  if (!hasSupabasePublicEnv()) {
    const fallback = getStaticProblem(id);
    return fallback ? markFallbackProblem(fallback, '未配置 Supabase 环境变量，当前使用静态题库。') : null;
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('problems')
    .select('*, solutions(*)')
    .eq('id', id)
    .single();

  if (error || !data) {
    if (error) console.error('[db] getProblem error:', error.message, error.code);
    const fallback = getStaticProblem(id);
    return fallback ? markFallbackProblem(fallback) : null;
  }
  return toProblem(data);
});

// Targeted full-data fetch for a known, small set of ids (e.g. the home
// page's featured problems) — avoids pulling the entire table just to pick
// a handful of rows.
export async function getProblemsByIds(ids: string[]): Promise<Problem[]> {
  if (ids.length === 0) return [];

  if (!hasSupabasePublicEnv()) {
    const fallback = ids.map(getStaticProblem).filter((p): p is Problem => Boolean(p));
    return markFallbackProblems(fallback, '未配置 Supabase 环境变量，当前使用静态题库。');
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('problems')
    .select('*, solutions(*)')
    .in('id', ids);

  if (error || !data || data.length === 0) {
    if (error) console.error('[db] getProblemsByIds error:', error.message, error.code);
    const fallback = ids.map(getStaticProblem).filter((p): p is Problem => Boolean(p));
    return markFallbackProblems(fallback);
  }
  return data.map(toProblem);
}

const SUMMARY_COLUMNS =
  'id, year, region, paper, number, difficulty, question_type, tags, title, statement, heat, proof_graph, solutions(id, title, inspiration, scores)';

// Lightweight query for list/preview surfaces (problem list, home stats,
// related problems) — skips answer/learning_guide/solution_tree/*_matches and
// full solution text (thinking_cues/verification/summary/...).
export async function getProblemSummaries(): Promise<ProblemSummary[]> {
  if (!hasSupabasePublicEnv()) {
    return staticProblems.map((p) => toProblemSummaryFallback(p, '未配置 Supabase 环境变量，当前使用静态题库。'));
  }

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('problems')
    .select(SUMMARY_COLUMNS)
    .order('heat', { ascending: false });

  if (error) {
    console.error('[db] getProblemSummaries error:', error.message, error.code);
    return staticProblems.map((p) => toProblemSummaryFallback(p));
  }
  if (!data || data.length === 0) {
    return staticProblems.map((p) => toProblemSummaryFallback(p, '数据库题库为空，当前显示静态兜底题库。'));
  }
  return (data as unknown as Record<string, unknown>[]).map(toProblemSummary);
}

// ── Pure Utility Functions (no DB needed) ──────────────────────────────────
//
// Generic over any problem/solution shape that carries `scores`, so both the
// full `Problem`/`Solution` and the lightweight `ProblemSummary`/`SolutionSummary`
// DTOs can share this logic without duplication.

type ScoredSolution = { scores: SolutionScores };
type ScoredProblem = { solutions: readonly ScoredSolution[] };

export function getLearningIndex<P extends ScoredProblem>(problem: P): string {
  const bestExplanation = Math.max(...problem.solutions.map((s) => s.scores.explanation));
  const bestExamReady = Math.max(...problem.solutions.map((s) => s.scores.examReady));
  const bestElegance = Math.max(...problem.solutions.map((s) => s.scores.elegance));
  return (bestExplanation * 0.5 + bestExamReady * 0.25 + bestElegance * 0.25).toFixed(1);
}

export function getAverageScore<P extends ScoredProblem>(problem: P): number {
  const values = problem.solutions.flatMap((s) => Object.values(s.scores));
  return values.reduce((sum, score) => sum + score, 0) / values.length;
}

export function getSolutionAverage<S extends ScoredSolution>(solution: S): number {
  const values = Object.values(solution.scores);
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function getBestSolution<P extends ScoredProblem>(
  problem: P,
  score: keyof SolutionScores
): P['solutions'][number] {
  return [...problem.solutions].sort((a, b) => b.scores[score] - a.scores[score])[0];
}
