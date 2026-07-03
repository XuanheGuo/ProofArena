'use server';

import { createClient } from '@/lib/supabase-server';
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
};

function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Publish an approved submission to the problems/solutions tables
 */
export async function publishSubmission(submissionId: string): Promise<{
  success: boolean;
  error?: string;
  problemId?: string;
  solutionId?: string;
}> {
  const supabase = await createClient();

  // Fetch the submission
  const { data: submission, error: fetchError } = await supabase
    .from('submissions')
    .select('*')
    .eq('id', submissionId)
    .single();

  if (fetchError || !submission) {
    return { success: false, error: '找不到投稿记录' };
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
}

async function publishProblem(submission: Submission): Promise<{
  success: boolean;
  error?: string;
  problemId?: string;
}> {
  const supabase = await createClient();
  const problemData = submission.content.json?.problem ?? {};

  const problemId = generateId('prob');

  const problem = {
    id: problemId,
    year: Number(problemData.year) || new Date().getFullYear(),
    region: (problemData.region as string) || '其他',
    paper: (problemData.paper as string) || '',
    number: (problemData.number as string) || '',
    difficulty: (problemData.difficulty as string) || 'medium',
    question_type: (problemData.questionType as string) || 'general',
    tags: Array.isArray(problemData.tags) ? problemData.tags : [],
    title: submission.title,
    statement: Array.isArray(problemData.statement) ? problemData.statement : [problemData.statement || ''].filter(Boolean),
    answer: (problemData.answer as string) || '',
    heat: 0,
    source_pdf: (problemData.sourcePdf as string) || '',
    source_page: Number(problemData.sourcePage) || 1,
    answer_pdf: problemData.answerPdf as string | undefined,
    learning_guide: problemData.learningGuide || null,
    solution_tree: problemData.solutionTree || null,
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

  const { error: insertError } = await supabase
    .from('problems')
    .insert(problem);

  if (insertError) {
    return { success: false, error: `插入题目失败: ${insertError.message}` };
  }

  return { success: true, problemId };
}

async function publishSolution(submission: Submission): Promise<{
  success: boolean;
  error?: string;
  solutionId?: string;
}> {
  const supabase = await createClient();

  if (!submission.problem_id) {
    return { success: false, error: '解法投稿必须绑定题目 ID' };
  }

  // Verify the problem exists
  const { data: problem, error: problemError } = await supabase
    .from('problems')
    .select('id')
    .eq('id', submission.problem_id)
    .single();

  if (problemError || !problem) {
    return { success: false, error: `题目 ${submission.problem_id} 不存在` };
  }

  const solutionData = submission.content.json?.solution ?? {};
  const solutionId = generateId('sol');

  // Get user info for author field
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('display_name, role')
    .eq('id', submission.user_id)
    .single();

  const solution = {
    id: solutionId,
    problem_id: submission.problem_id,
    kind: submission.kind,
    title: submission.title,
    author: profile?.display_name || '匿名用户',
    author_role: profile?.role || 'user',
    tags: Array.isArray(solutionData.tags) ? solutionData.tags : [],
    badge: (solutionData.badge as string) || '',
    origin: (solutionData.origin as string) || '',
    key_transform: (solutionData.keyTransform as string) || '',
    thinking_cues: solutionData.thinkingCues || null,
    inspiration: (solutionData.inspiration as string) || '',
    transfer_value: (solutionData.transferValue as string) || '',
    suitable_for: Array.isArray(solutionData.suitableFor) ? solutionData.suitableFor : [],
    tradeoffs: Array.isArray(solutionData.tradeoffs) ? solutionData.tradeoffs : [],
    limitations: Array.isArray(solutionData.limitations) ? solutionData.limitations : [],
    summary: Array.isArray(solutionData.process)
      ? solutionData.process
      : (solutionData.process ? [solutionData.process] : []),
    scores: (solutionData.scores as SolutionScores) || {
      correctness: 8,
      examReady: 8,
      elegance: 8,
      calculation: 8,
      explanation: 8,
    },
    scoring_reason: (solutionData.scoringReason as string) || '',
    verification: solutionData.verification || null,
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

  const { error: insertError } = await supabase
    .from('solutions')
    .insert(solution);

  if (insertError) {
    return { success: false, error: `插入解法失败: ${insertError.message}` };
  }

  return { success: true, solutionId };
}
