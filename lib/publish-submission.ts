'use server';

import { createClient, createServiceClient } from '@/lib/supabase-server';
import { MAX_TITLE_CHARS, clampText } from '@/lib/security';
import type { SolutionScores } from '@/lib/types';

type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'needs_revision';
type SolutionKind = 'standard' | 'insight' | 'robust' | 'teaching';

type SubmissionContent = {
  markdown?: string;
  json?: {
    solution?: Record<string, unknown>;
    problem?: Record<string, unknown>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type Submission = {
  id: string;
  submission_type: 'problem' | 'solution';
  problem_id: string | null;
  problem_source: string | null;
  kind: SolutionKind;
  title: string;
  content: SubmissionContent;
  status: SubmissionStatus;
  user_id: string;
  moderator_notes?: string | null;
  contest_id?: string | null;
  contest_problem_id?: string | null;
  contest_slug?: string | null;
  contest_problem_key?: string | null;
  contest_solution_type?: string | null;
  is_post_contest?: boolean | null;
  attachment_urls?: string[] | null;
  challenge_target_solution_id?: string | null;
  challenge_claim?: string | null;
  challenge_advantages?: string[] | null;
  challenge_risk?: string | null;
};

async function requireModerator() {
  const supabase = await createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  const user = auth.user;

  if (authError || !user) {
    return { ok: false as const, error: '需要登录后才能发布投稿。', supabase };
  }

  if (user.email === 'xuanheguo@icloud.com') {
    return { ok: true as const, supabase };
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile || !['moderator', 'admin'].includes(profile.role as string)) {
    return { ok: false as const, error: '当前账号没有发布投稿的权限。', supabase };
  }

  return { ok: true as const, supabase };
}

function splitProcessSteps(value: string): string[] {
  if (!value.trim()) return [];

  // Split at Chinese step markers: 第一步, 第二步, ...
  const chineseStepRe = /第[一二三四五六七八九十百]+步[:：]?/;
  if (chineseStepRe.test(value)) {
    return value
      .split(/(?=第[一二三四五六七八九十百]+步)/)
      .map((chunk) => chunk.replace(/^第[一二三四五六七八九十百]+步[:：]?\s*/, '').trim())
      .filter(Boolean);
  }

  // Split at numeric step markers at line start: 1. / 1) / 1、
  const numericStepRe = /^\s*\d+[.)、]/m;
  if (numericStepRe.test(value)) {
    return value
      .split(/(?=^\s*\d+[.)、])/m)
      .map((chunk) => chunk.replace(/^\s*\d+[.)、]\s*/, '').trim())
      .filter(Boolean);
  }

  // Fallback: split by sentence-ending punctuation
  return value
    .split(/(?<=[。！？；])/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${timestamp}-${random}`;
}

export async function publishSubmission(submissionId: string): Promise<{
  success: boolean;
  error?: string;
  problemId?: string;
  solutionId?: string;
}> {
  try {
    const moderator = await requireModerator();
    if (!moderator.ok) return { success: false, error: moderator.error };

    const supabase = moderator.supabase;

    const { data: submission, error: fetchError } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (fetchError || !submission) {
      console.error('[publishSubmission] Fetch error:', fetchError);
      return { success: false, error: '找不到投稿记录: ' + (fetchError?.message ?? '') };
    }

    const sub = submission as Submission;

    if (sub.status !== 'approved') {
      return { success: false, error: '只能发布状态为"已通过"的投稿' };
    }

    if (sub.submission_type === 'problem') {
      return await publishProblem(sub);
    } else if (sub.submission_type === 'solution') {
      return await publishSolution(sub);
    }

    return { success: false, error: '未知的投稿类型' };
  } catch (error) {
    console.error('[publishSubmission] Unhandled exception:', error);
    return {
      success: false,
      error: '发布时发生异常: ' + (error instanceof Error ? error.message : String(error)),
    };
  }
}

async function publishProblem(submission: Submission): Promise<{
  success: boolean;
  error?: string;
  problemId?: string;
}> {
  try {
    const supabase = createServiceClient();
    const problemData = submission.content.json?.problem ?? {};
    const problemId = generateId('prob');

    const problem = {
      id: problemId,
      year: Number(problemData.year) || new Date().getFullYear(),
      region: (problemData.region as string) || '天津卷',
      paper: (problemData.paper as string) || '',
      number: (problemData.number as string) || '',
      difficulty: (problemData.difficulty as string) || '中档',
      question_type: (problemData.questionType as string) || '解答',
      tags: Array.isArray(problemData.tags) ? problemData.tags : [],
      title: clampText(submission.title, MAX_TITLE_CHARS),
      statement: Array.isArray(problemData.statement)
        ? problemData.statement
        : [problemData.statement || ''].filter(Boolean),
      answer: (problemData.answer as string) || '',
      heat: 0,
      source_pdf: (problemData.sourcePdf as string) || '',
      source_page: Number(problemData.sourcePage) || 1,
      answer_pdf: problemData.answerPdf as string | undefined,
      learning_guide: problemData.learningGuide || null,
      solution_tree: problemData.solutionTree || null,
      // proof_graph: official per-problem ProofGraphV1 if included in the submission.
      // No automatic inference from Markdown or solution drafts — must be explicitly
      // provided in submission.content.json.problem.proofGraph.
      proof_graph: problemData.proofGraph || null,
      knowledge_ids: Array.isArray(problemData.knowledgeIds) ? problemData.knowledgeIds : [],
      insight_ids: Array.isArray(problemData.insightIds) ? problemData.insightIds : [],
      auto_matches: problemData.autoMatches || null,
      manual_matches: problemData.manualMatches || null,
      concept_links: problemData.conceptLinks || null,
      concept_contrasts: problemData.conceptContrasts || null,
      boundary_notes: problemData.boundaryNotes || null,
      contrast_problems: problemData.contrastProblems || null,
      why_not_methods: problemData.whyNotMethods || null,
    };

    const { error: insertError } = await supabase.from('problems').insert(problem);

    if (insertError) {
      console.error('[publishProblem] Insert error:', insertError);
      return { success: false, error: `插入题目失败: ${insertError.message}` };
    }

    return { success: true, problemId };
  } catch (error) {
    console.error('[publishProblem] Unhandled exception:', error);
    return {
      success: false,
      error: '插入题目时发生异常: ' + (error instanceof Error ? error.message : String(error)),
    };
  }
}

async function publishSolution(submission: Submission): Promise<{
  success: boolean;
  error?: string;
  solutionId?: string;
}> {
  try {
    const supabase = createServiceClient();

    if (!submission.problem_id) {
      return { success: false, error: '解法投稿必须绑定题目 ID' };
    }

    const { data: existingSolution } = await supabase
      .from('solutions')
      .select('id')
      .eq('source_submission_id', submission.id)
      .maybeSingle();

    if (existingSolution?.id) {
      return { success: true, solutionId: existingSolution.id as string };
    }

    const solutionData = submission.content.json?.solution ?? {};
    const challenge = solutionData.challenge && typeof solutionData.challenge === 'object'
      ? solutionData.challenge as Record<string, unknown>
      : {};
    const solutionId = generateId('sol');

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('display_name, role')
      .eq('id', submission.user_id)
      .single();

    const solution = {
      id: solutionId,
      problem_id: submission.problem_id,
      author_id: submission.user_id,
      source_submission_id: submission.id,
      challenge_target_solution_id: (challenge.targetSolutionId as string) || submission.challenge_target_solution_id || null,
      challenge_target_solution_title: (challenge.targetSolutionTitle as string) || null,
      challenge_target_solution_author: (challenge.targetSolutionAuthor as string) || null,
      challenge_claim: (challenge.claim as string) || submission.challenge_claim || null,
      challenge_advantages: Array.isArray(challenge.advantages) ? challenge.advantages : submission.challenge_advantages ?? [],
      challenge_risk: (challenge.risk as string) || submission.challenge_risk || null,
      contest_id: submission.contest_id ?? null,
      contest_problem_id: submission.contest_problem_id ?? null,
      contest_slug: submission.contest_slug ?? null,
      contest_problem_key: submission.contest_problem_key ?? null,
      contest_solution_type: submission.contest_solution_type ?? null,
      is_post_contest: Boolean(submission.is_post_contest),
      kind: submission.kind,
      title: clampText(submission.title, MAX_TITLE_CHARS),
      author: (profile?.display_name as string) || '匿名用户',
      author_role: (profile?.role as string) || 'user',
      tags: Array.isArray(solutionData.tags) ? solutionData.tags : [],
      badge: (solutionData.badge as string) || '',
      origin: (solutionData.origin as string) || '',
      key_transform: (solutionData.keyTransform as string) || '',
      thinking_cues: {
        ...(typeof solutionData.thinkingCues === 'object' && solutionData.thinkingCues !== null
          ? (solutionData.thinkingCues as Record<string, unknown>)
          : { observations: [], keySignals: [], reasoning: '', suggestedMethods: [] }),
        // proofGraphDraft: approved public graph content reviewed and confirmed by moderator.
        // Stored under thinking_cues until Cycle 5 adds a dedicated column.
        // This is published data — same approval gate as all other solution fields.
        // Challenge fields (claim/advantages/risk) live in dedicated columns; not duplicated here.
        // verificationSteps here is a structured copy; solution.verification is authoritative for display.
        ...(solutionData.observationSignal || solutionData.transformationFrom ||
            solutionData.methodBoundaryName || solutionData.verificationSteps
          ? {
              proofGraphDraft: {
                observationSignal: solutionData.observationSignal ?? null,
                observationWhy: solutionData.observationWhy ?? null,
                transformationFrom: solutionData.transformationFrom ?? null,
                transformationTo: solutionData.transformationTo ?? null,
                transformationJustification: solutionData.transformationJustification ?? null,
                transformationComplexityReduction: solutionData.transformationComplexityReduction ?? null,
                methodBoundaryName: solutionData.methodBoundaryName ?? null,
                methodBoundaryWhyTempting: solutionData.methodBoundaryWhyTempting ?? null,
                methodBoundaryWhyNotPriority: solutionData.methodBoundaryWhyNotPriority ?? null,
                methodBoundaryWhereItBreaks: solutionData.methodBoundaryWhereItBreaks ?? null,
                methodBoundaryWhenItWorks: solutionData.methodBoundaryWhenItWorks ?? null,
                verificationSteps: solutionData.verificationSteps ?? null,
              },
            }
          : {}),
      },
      inspiration: (solutionData.inspiration as string) || '',
      transfer_value: (solutionData.transferValue as string) || '',
      suitable_for: Array.isArray(solutionData.suitableFor) ? solutionData.suitableFor : [],
      tradeoffs: Array.isArray(solutionData.tradeoffs) ? solutionData.tradeoffs : [],
      limitations: Array.isArray(solutionData.limitations) ? solutionData.limitations : [],
      summary: Array.isArray(solutionData.process)
        ? solutionData.process
        : splitProcessSteps(String(solutionData.process ?? '')),
      scores: (solutionData.scores as SolutionScores) || {
        correctness: 8,
        examReady: 8,
        elegance: 8,
        calculation: 8,
        explanation: 8,
      },
      scoring_reason: (solutionData.scoringReason as string) || '',
      verification: solutionData.verification || {
        status: 'manual',
        engine: '',
        statement: '',
        checks: [],
        verifiedScope: [],
        unverifiedScope: [],
        reviewNote: '',
      },
      estimated_minutes: Number(solutionData.estimatedMinutes) || 20,
      knowledge_ids: Array.isArray(solutionData.knowledgeIds) ? solutionData.knowledgeIds : [],
      insight_ids: Array.isArray(solutionData.insightIds) ? solutionData.insightIds : [],
      auto_matches: solutionData.autoMatches || null,
      manual_matches: solutionData.manualMatches || null,
      concept_links: solutionData.conceptLinks || null,
      concept_contrasts: solutionData.conceptContrasts || null,
      boundary_notes: solutionData.boundaryNotes || null,
      contrast_problems: solutionData.contrastProblems || null,
      why_not_methods: solutionData.whyNotMethods || null,
    };

    const { error: insertError } = await supabase.from('solutions').insert(solution);

    if (insertError) {
      console.error('[publishSolution] Insert error:', insertError);
      return { success: false, error: `插入解法失败: ${insertError.message}` };
    }

    return { success: true, solutionId };
  } catch (error) {
    console.error('[publishSolution] Unhandled exception:', error);
    return {
      success: false,
      error: '插入解法时发生异常: ' + (error instanceof Error ? error.message : String(error)),
    };
  }
}
