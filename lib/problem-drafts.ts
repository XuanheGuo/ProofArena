import { createServiceClient } from '@/lib/supabase-server';
import type { LearningGuide, Problem, ProofGraphV1, SolutionTree } from '@/lib/types';

// Problem Vault: unpublished problems used for brand-new contest problems,
// problems still being built out with a Proof Graph, or problems awaiting an
// official solution before public release. Backed by `problem_drafts`, which
// has RLS restricting all access to admin/moderator — there is no
// "viewable by everyone" policy on that table (see migration 012).
//
// Contest participants still need to read a draft's title/statement once its
// contest problem unlocks, even though they are not moderators. That reveal
// happens ONLY through getProblemDraftForContestDisplay below, which uses the
// service role key to bypass RLS from trusted server code — never call it
// before the caller has already confirmed the contest problem is unlocked
// (see app/contests/[slug]/problems/[id]/page.tsx). This function must never
// be imported into a client component or exposed via a public API route.

export type ProblemDraftStatus = 'drafting' | 'promoted';

export type ProblemDraftRow = {
  id: string;
  year: number;
  region: Problem['region'];
  paper: string;
  number: string;
  difficulty: Problem['difficulty'];
  question_type: Problem['questionType'];
  tags: string[];
  title: string;
  statement: string[];
  answer: string;
  source_pdf: string | null;
  source_page: number | null;
  answer_pdf: string | null;
  learning_guide: LearningGuide | null;
  solution_tree: SolutionTree | null;
  proof_graph: ProofGraphV1 | null;
  notes: string;
  status: ProblemDraftStatus;
  promoted_problem_id: string | null;
  promoted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProblemDraftSummary = Pick<
  ProblemDraftRow,
  'id' | 'title' | 'year' | 'region' | 'paper' | 'number' | 'difficulty' | 'status' | 'promoted_problem_id'
>;

const EMPTY_LEARNING_GUIDE: LearningGuide = {
  observation: [],
  triggers: [],
  pitfalls: [],
  readingPath: [],
  recommendation: '',
};

// Adapts a Problem Vault row into the same `Problem` shape the rest of the
// app (ProblemDetailExperience, redactLockedProblem) already knows how to
// render — so a draft-backed contest problem reuses every existing render
// path and hide-during-active rule instead of a parallel implementation.
// `solutions` is always empty: solutions can only ever reference a public
// `problems.id` (there is no schema path for a solution to attach to a
// draft), so there is nothing to redact there — it's simply never present.
export function adaptProblemDraftToProblem(draft: ProblemDraftRow): Problem {
  return {
    id: draft.id,
    year: draft.year,
    region: draft.region,
    paper: draft.paper,
    number: draft.number,
    difficulty: draft.difficulty,
    questionType: draft.question_type,
    tags: draft.tags ?? [],
    title: draft.title,
    statement: draft.statement ?? [],
    answer: draft.answer ?? '',
    heat: 0,
    sourcePdf: draft.source_pdf ?? '',
    sourcePage: draft.source_page ?? 1,
    answerPdf: draft.answer_pdf ?? undefined,
    learningGuide: draft.learning_guide ?? EMPTY_LEARNING_GUIDE,
    solutionTree: draft.solution_tree ?? undefined,
    proofGraph: draft.proof_graph ?? undefined,
    solutions: [],
    dataSource: 'supabase',
    dataNotice: undefined,
  };
}

// Trusted, server-only read — bypasses RLS via the service role key. Only
// call this after the caller has already established (via contestContext +
// getEffectiveProblemStatus) that the contest problem backed by this draft
// is currently unlocked. Never call from a client component.
export async function getProblemDraftForContestDisplay(draftId: string): Promise<ProblemDraftRow | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('problem_drafts')
    .select('*')
    .eq('id', draftId)
    .maybeSingle();

  if (error || !data) {
    if (error) console.error('[problem-drafts] getProblemDraftForContestDisplay error:', error.message);
    return null;
  }

  return data as ProblemDraftRow;
}

// Batched, title-only version of the above — for surfaces that need to show
// several unlocked draft-backed contest problems' titles at once (the
// contest detail page's problem list, the submit form's problem picker)
// without pulling full statement/answer/proofGraph content for each. Same
// trusted-server-only contract: only call with ids you have already
// confirmed are unlocked.
export async function getProblemDraftTitles(draftIds: string[]): Promise<Record<string, string>> {
  if (draftIds.length === 0 || !process.env.SUPABASE_SERVICE_ROLE_KEY) return {};

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('problem_drafts')
    .select('id, title')
    .in('id', draftIds);

  if (error || !data) {
    if (error) console.error('[problem-drafts] getProblemDraftTitles error:', error.message);
    return {};
  }

  return Object.fromEntries(data.map((row) => [row.id as string, row.title as string]));
}
