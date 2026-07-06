'use server';

import { createServiceClient } from '@/lib/supabase-server';
import { requireModerator } from '@/lib/require-moderator';
import { revalidatePublicProblemPaths, revalidateContestSlug } from '@/lib/revalidate-public';
import type { ProblemDraftRow } from '@/lib/problem-drafts';

function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${timestamp}-${random}`;
}

type ContestProblemLinkRow = {
  id: string;
  contests: { slug: string } | { slug: string }[] | null;
};

// Promotes a Problem Vault entry into a full public `problems` row —
// the only path by which a draft's content is ever allowed to become
// publicly visible (through /problems, /problems/[id], getProblemSummaries).
// Any contest_problems AND submissions rows still pointing at this draft are
// re-linked to the new public problem_id, so the contest keeps working
// seamlessly and previously-collected contest submissions become normal
// solution submissions eligible for the existing publishSubmission() flow.
// (`solutions` never needs relinking here — solutions.problem_id is NOT NULL
// and has no draft-referencing column, so a solutions row for a draft-backed
// problem cannot exist prior to this promotion in the first place.)
//
// This is intentionally a post-contest cleanup action (matching the existing
// "publish approved contest solutions" workflow) — promoting mid-contest
// would expose a still-active contest problem to the entire public site,
// defeating the point of using the vault in the first place.
export async function promoteProblemDraft(draftId: string): Promise<{
  success: boolean;
  error?: string;
  problemId?: string;
}> {
  try {
    const moderator = await requireModerator();
    if (!moderator.ok) return { success: false, error: moderator.error };

    const supabase = createServiceClient();

    const { data: draft, error: fetchError } = await supabase
      .from('problem_drafts')
      .select('*')
      .eq('id', draftId)
      .single();

    if (fetchError || !draft) {
      return { success: false, error: '找不到未公开题目: ' + (fetchError?.message ?? '') };
    }

    const draftRow = draft as ProblemDraftRow;

    if (draftRow.status === 'promoted' && draftRow.promoted_problem_id) {
      return { success: true, problemId: draftRow.promoted_problem_id };
    }

    if (!draftRow.title.trim() || !Array.isArray(draftRow.statement) || draftRow.statement.length === 0) {
      return { success: false, error: '题目标题和题干不能为空，请先完善未公开题目内容再发布。' };
    }

    const problemId = generateId('prob');

    const { error: insertError } = await supabase.from('problems').insert({
      id: problemId,
      year: draftRow.year,
      region: draftRow.region,
      paper: draftRow.paper,
      number: draftRow.number,
      difficulty: draftRow.difficulty,
      question_type: draftRow.question_type,
      tags: draftRow.tags ?? [],
      title: draftRow.title,
      statement: draftRow.statement,
      answer: draftRow.answer ?? '',
      heat: 0,
      source_pdf: draftRow.source_pdf,
      source_page: draftRow.source_page,
      answer_pdf: draftRow.answer_pdf,
      learning_guide: draftRow.learning_guide ?? {
        observation: [],
        triggers: [],
        pitfalls: [],
        readingPath: [],
        recommendation: '',
      },
      solution_tree: draftRow.solution_tree,
      proof_graph: draftRow.proof_graph,
      source_draft_id: draftRow.id,
    });

    if (insertError) {
      return { success: false, error: `创建正式题目失败: ${insertError.message}` };
    }

    await supabase
      .from('problem_drafts')
      .update({ status: 'promoted', promoted_problem_id: problemId, promoted_at: new Date().toISOString() })
      .eq('id', draftId);

    const { data: linkedContestProblems } = await supabase
      .from('contest_problems')
      .select('id, contests(slug)')
      .eq('draft_problem_id', draftId);

    for (const row of (linkedContestProblems ?? []) as ContestProblemLinkRow[]) {
      await supabase
        .from('contest_problems')
        .update({ problem_id: problemId, draft_problem_id: null })
        .eq('id', row.id);
      const contest = Array.isArray(row.contests) ? row.contests[0] : row.contests;
      revalidateContestSlug(contest?.slug, problemId);
    }

    // Relink all submissions that were targeting this draft. Once problem_id
    // is set they become indistinguishable from submissions that were always
    // attached to a public problem, so publishSubmission() can process them
    // without any special-case code.
    await supabase
      .from('submissions')
      .update({ problem_id: problemId, draft_problem_id: null })
      .eq('draft_problem_id', draftId);

    revalidatePublicProblemPaths(problemId);

    return { success: true, problemId };
  } catch (error) {
    console.error('[promoteProblemDraft] Unhandled exception:', error);
    return {
      success: false,
      error: '发布未公开题目时发生异常: ' + (error instanceof Error ? error.message : String(error)),
    };
  }
}
