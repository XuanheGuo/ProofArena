'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, FileImage, FilePlus2, Lightbulb, LogIn, RotateCcw, Send, X } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-client';
import { contestSolutionTypeMeta, contestSolutionTypeOptions } from '@/lib/contest-meta';
import { ALLOWED_IMAGE_TYPES, MAX_CONTEST_THOUGHT_CHARS, MAX_GENERAL_TEXT_CHARS, MAX_IMAGE_BYTES, MAX_IMAGE_COUNT, MAX_TITLE_CHARS, clampText, extensionForImageType, isAllowedImage } from '@/lib/security';
import { getEffectiveProblemStatus, type Contest, type ContestProblem, type ContestSolutionType } from '@/lib/types';
import { MathPreviewTextArea } from '@/components/MathPreviewTextArea';
import { CASVerifier } from '@/components/CASVerifier';
import { MathBlock } from '@/components/MathBlock';
import { stripMathDelimiters } from '@/lib/math-normalizer';

type SubmitMode = 'problem' | 'solution';
type SolutionKind = 'standard' | 'insight' | 'robust' | 'teaching';

type ProblemOption = {
  id: string;
  title: string;
  source: string;
  solutions?: Array<{
    id: string;
    title: string;
    author: string;
    kind: SolutionKind;
    scores?: Record<string, number>;
    origin?: string;
    keyTransform?: string;
    inspiration?: string;
  }>;
};

const KINDS: Array<{ value: SolutionKind; label: string }> = [
  { value: 'standard', label: '标准解' },
  { value: 'insight', label: '启发解' },
  { value: 'robust', label: '稳健解' },
  { value: 'teaching', label: '教学解' },
];

const initialProblemForm = {
  source: '',
  title: '',
  statement: '',
  answer: '',
  tags: '',
  note: '',
};

const initialVaultForm = {
  year: String(new Date().getFullYear()),
  region: '',
  paper: '',
  number: '',
  difficulty: '',
  questionType: '',
  title: '',
  statement: '',
  answer: '',
  tags: '',
  notes: '',
};

const initialSolutionForm = {
  problemId: '',
  title: '',
  kind: 'standard' as SolutionKind,
  contestSolutionType: 'standard' as ContestSolutionType,
  approach: '',
  keyTransform: '',
  steps: '',
  insight: '',
  verification: '',
  challengeTargetSolutionId: '',
  challengeClaim: '',
  challengeAdvantages: '',
  challengeRisk: '',
  // optional graph-aware fields — map to stable ProofGraphV1 keys
  observationWhy: '',
  transformationJustification: '',
};

// Draft auto-save key format: pa:cdraft:v1:{contestSlug}:{problemId}
// problemId is the public problem_id or the draft_problem_id, whichever is relevant.
// The special value "any" covers no-problem-selected state.
function contestDraftKey(contestSlug: string, problemId: string) {
  return `pa:cdraft:v1:${contestSlug}:${problemId || 'any'}`;
}

type ContestDraft = {
  title: string;
  contestSolutionType: ContestSolutionType;
  approach: string;
};

function readContestDraft(key: string): ContestDraft | null {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    if (!raw) return null;
    return JSON.parse(raw) as ContestDraft;
  } catch {
    return null;
  }
}

function writeContestDraft(key: string, draft: ContestDraft) {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    // storage quota exceeded — fail silently
  }
}

function clearContestDraft(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function getContestSubmissionState(contest?: Contest, contestProblem?: ContestProblem, now = Date.now()) {
  if (!contest) {
    return {
      canSubmit: true,
      isPostContest: false,
      label: '',
      description: '',
    };
  }

  const startAt = new Date(contest.startAt).getTime();
  const endAt = new Date(contest.endAt).getTime();

  if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) {
    return {
      canSubmit: false,
      isPostContest: false,
      label: '比赛时间未配置完整',
      description: '请等待管理员设置开始和结束时间后再提交。',
    };
  }

  if (contest.status === 'draft') {
    return {
      canSubmit: false,
      isPostContest: false,
      label: '比赛尚未开始',
      description: '比赛开始前不能提前提交参赛思路。开始后，这里会开放比赛投稿。',
    };
  }

  if (now > endAt || contest.status === 'judging' || contest.status === 'finished') {
    return {
      canSubmit: true,
      isPostContest: true,
      label: '赛后补充',
      description: '比赛已结束，现在提交的内容会标记为赛后补充，不计入正式参赛提交。',
    };
  }

  if (contest.status === 'active') {
    if (!contestProblem) {
      return {
        canSubmit: false,
        isPostContest: false,
        label: '请选择赛题',
        description: '比赛投稿需要绑定到当天开放的赛题。',
      };
    }

    const effectiveStatus = getEffectiveProblemStatus(contestProblem, new Date(now));
    if (effectiveStatus !== 'open') {
      return {
        canSubmit: false,
        isPostContest: false,
        label: effectiveStatus === 'locked' ? '赛题未解锁' : '赛题已关闭',
        description: effectiveStatus === 'locked'
          ? '这道赛题还没有开放提交。'
          : '这道赛题的正式提交窗口已经结束，等待讨论阶段或赛后补充。',
      };
    }

    return {
      canSubmit: true,
      isPostContest: false,
      label: '比赛进行中',
      description: '当前可以提交参赛思路。内容会先进入审核队列。',
    };
  }

  if (now < startAt) {
    return {
      canSubmit: false,
      isPostContest: false,
      label: '比赛尚未开始',
      description: '比赛开始前不能提前提交参赛思路。开始后，这里会开放比赛投稿。',
    };
  }

  return {
    canSubmit: false,
    isPostContest: false,
    label: '暂未开放提交',
    description: '当前比赛状态不允许提交，请等待管理员开放比赛或进入赛后补充阶段。',
  };
}

function toLines(value: string) {
  return value
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildProblemMarkdown(form: typeof initialProblemForm) {
  return `# 题目投稿：${clampText(form.title, MAX_TITLE_CHARS)}

## 来源
${clampText(form.source, MAX_TITLE_CHARS)}

## 题干
${clampText(form.statement, MAX_GENERAL_TEXT_CHARS)}

## 答案
${clampText(form.answer, MAX_GENERAL_TEXT_CHARS) || '（未填写）'}

## 标签
${toLines(form.tags).map((tag) => `- ${tag}`).join('\n') || '（未填写）'}

## 备注
${clampText(form.note, MAX_GENERAL_TEXT_CHARS) || '（无）'}
`;
}

function buildSolutionMarkdown(
  form: typeof initialSolutionForm,
  problem?: ProblemOption,
  contestContext?: { contest: Contest; contestProblem?: ContestProblem },
  imageUrls: string[] = [],
) {
  if (contestContext) {
    return `# 比赛思路投稿：${form.title}

## 对应题目
${problem ? `${problem.source} · ${problem.title}` : form.problemId}

## 参赛信息
${contestContext.contest.title}${contestContext.contestProblem ? ` · Day ${contestContext.contestProblem.dayIndex} ${contestContext.contestProblem.title}` : ''}

## 我的思路
${clampText(form.approach, MAX_CONTEST_THOUGHT_CHARS)}

${imageUrls.length ? `## 图片
${imageUrls.map((url) => `- ${url}`).join('\n')}
` : ''}`;
  }

  return `# 解法投稿：${form.title}

## 对应题目
${problem ? `${problem.source} · ${problem.title}` : form.problemId}

## 类型
${KINDS.find((kind) => kind.value === form.kind)?.label ?? form.kind}

${form.challengeTargetSolutionId ? `## 挑战对象
${problem?.solutions?.find((solution) => solution.id === form.challengeTargetSolutionId)?.title ?? form.challengeTargetSolutionId}

## 我比它强在哪里
${clampText(form.challengeClaim, MAX_GENERAL_TEXT_CHARS) || '（未填写）'}

## 优势标签
${toLines(form.challengeAdvantages).map((item) => `- ${item}`).join('\n') || '（未填写）'}

## 风险自评
${clampText(form.challengeRisk, MAX_GENERAL_TEXT_CHARS) || '（未填写）'}

` : ''}
## 思路来源
${clampText(form.approach, MAX_GENERAL_TEXT_CHARS)}

## 关键转化
${clampText(form.keyTransform, MAX_GENERAL_TEXT_CHARS) || '（未填写）'}

## 完整步骤
${clampText(form.steps, MAX_GENERAL_TEXT_CHARS)}

## 最值得学的地方
${clampText(form.insight, MAX_GENERAL_TEXT_CHARS) || '（未填写）'}

## 可验证位置
${clampText(form.verification, MAX_GENERAL_TEXT_CHARS) || '（未填写）'}

${imageUrls.length ? `## 图片
${imageUrls.map((url) => `- ${url}`).join('\n')}
` : ''}
`;
}

export function SubmitForm({
  problems,
  initialProblemId,
  initialForkSolutionId,
  contestContext,
  vaultMode = false,
}: {
  problems: ProblemOption[];
  initialProblemId?: string;
  initialForkSolutionId?: string;
  contestContext?: {
    contest: Contest;
    contestProblem?: ContestProblem;
  };
  vaultMode?: boolean;
}) {
  const isContestMode = Boolean(contestContext);
  const contestProblemIds = useMemo(
    () => new Set((contestContext?.contest.problems ?? []).map((problem) => problem.problemId).filter(Boolean)),
    [contestContext],
  );
  const availableProblems = useMemo(
    () => isContestMode ? problems.filter((problem) => contestProblemIds.has(problem.id)) : problems,
    [contestProblemIds, isContestMode, problems],
  );
  const initialSelectedProblemId = initialProblemId && availableProblems.some((problem) => problem.id === initialProblemId)
    ? initialProblemId
    : availableProblems[0]?.id ?? '';
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [mode, setMode] = useState<SubmitMode>(vaultMode ? 'problem' : 'solution');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<SubmitMode | null>(null);
  const [error, setError] = useState('');
  const [draftRestored, setDraftRestored] = useState(false);
  const [hasDraftToRestore, setHasDraftToRestore] = useState(false);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [problemForm, setProblemForm] = useState(initialProblemForm);
  const [vaultForm, setVaultForm] = useState(initialVaultForm);
  const [solutionForm, setSolutionForm] = useState({
    ...initialSolutionForm,
    problemId: initialSelectedProblemId,
  });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [forkDismissed, setForkDismissed] = useState(false);

  // One-time fork prefill on mount.
  const [forkInitialized, setForkInitialized] = useState(false);
  useEffect(() => {
    if (forkInitialized || !initialForkSolutionId) return;
    setForkInitialized(true);
    const source = availableProblems
      .find((p) => p.id === initialSelectedProblemId)
      ?.solutions?.find((s) => s.id === initialForkSolutionId);
    if (!source) return;
    setSolutionForm((current) => ({
      ...current,
      title: `[fork] ${source.title}`,
      kind: source.kind,
      approach: source.origin ?? '',
      keyTransform: source.keyTransform ?? '',
      insight: source.inspiration ?? '',
    }));
  }, [forkInitialized, initialForkSolutionId, availableProblems]);
  const supabase = createClient();

  const selectedProblem = useMemo(
    () => availableProblems.find((problem) => problem.id === solutionForm.problemId),
    [availableProblems, solutionForm.problemId]
  );
  const selectedChallengeSolution = useMemo(
    () => selectedProblem?.solutions?.find((solution) => solution.id === solutionForm.challengeTargetSolutionId),
    [selectedProblem, solutionForm.challengeTargetSolutionId],
  );
  const selectedContestProblem = useMemo(
    () =>
      contestContext?.contest.problems.find(
        (problem) =>
          problem.problemId === solutionForm.problemId ||
          problem.draftProblemId === solutionForm.problemId,
      ) ?? contestContext?.contestProblem,
    [contestContext, solutionForm.problemId]
  );
  const activeContestContext = contestContext
    ? {
        contest: contestContext.contest,
        contestProblem: selectedContestProblem,
      }
    : undefined;
  const contestSubmissionState = getContestSubmissionState(activeContestContext?.contest, activeContestContext?.contestProblem, now);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });
  }, [supabase]);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!availableProblems.length) return;
    if (!availableProblems.some((problem) => problem.id === solutionForm.problemId)) {
      setSolutionForm((current) => ({ ...current, problemId: availableProblems[0].id }));
    }
  }, [availableProblems, solutionForm.problemId]);

  useEffect(() => {
    if (!solutionForm.challengeTargetSolutionId) return;
    const stillExists = selectedProblem?.solutions?.some((solution) => solution.id === solutionForm.challengeTargetSolutionId);
    if (!stillExists) {
      setSolutionForm((current) => ({
        ...current,
        challengeTargetSolutionId: '',
        challengeClaim: '',
        challengeAdvantages: '',
        challengeRisk: '',
      }));
    }
  }, [selectedProblem, solutionForm.challengeTargetSolutionId]);

  // ── Contest mode draft auto-save ──────────────────────────────────────────
  // Key: pa:cdraft:v1:{contestSlug}:{problemId or "any"}
  // Saved fields: title, contestSolutionType, approach (no images).
  // Debounce: 1500ms. Cleared on successful submit.
  const activeDraftKey = isContestMode && contestContext
    ? contestDraftKey(
        contestContext.contest.slug,
        solutionForm.problemId || 'any',
      )
    : null;

  // On mount (and when problem changes), check if a saved draft exists.
  useEffect(() => {
    if (!activeDraftKey) return;
    const saved = readContestDraft(activeDraftKey);
    if (saved && (saved.approach || saved.title)) {
      setHasDraftToRestore(true);
    } else {
      setHasDraftToRestore(false);
    }
    // Don't restore automatically — wait for user to click.
  }, [activeDraftKey]);

  // Debounce-save contest form fields.
  const draftToSave = isContestMode
    ? { title: solutionForm.title, contestSolutionType: solutionForm.contestSolutionType, approach: solutionForm.approach }
    : null;
  const draftToSaveStr = draftToSave ? JSON.stringify(draftToSave) : null;
  useEffect(() => {
    if (!activeDraftKey || !draftToSaveStr) return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      const parsed = JSON.parse(draftToSaveStr) as ContestDraft;
      if (parsed.approach || parsed.title) {
        writeContestDraft(activeDraftKey, parsed);
      }
    }, 1500);
    return () => {
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    };
  }, [activeDraftKey, draftToSaveStr]);

  const restoreDraft = useCallback(() => {
    if (!activeDraftKey) return;
    const saved = readContestDraft(activeDraftKey);
    if (!saved) return;
    setSolutionForm((current) => ({
      ...current,
      title: saved.title ?? current.title,
      contestSolutionType: saved.contestSolutionType ?? current.contestSolutionType,
      approach: saved.approach ?? current.approach,
    }));
    setDraftRestored(true);
    setHasDraftToRestore(false);
  }, [activeDraftKey]);

  function discardDraft() {
    if (activeDraftKey) clearContestDraft(activeDraftKey);
    setHasDraftToRestore(false);
    setDraftRestored(false);
  }
  // ─────────────────────────────────────────────────────────────────────────

  function updateImageFiles(files: FileList | null) {
    if (!files) return;
    const next = [...imageFiles, ...Array.from(files)]
      .filter(isAllowedImage)
      .slice(0, MAX_IMAGE_COUNT);
    if (next.length === imageFiles.length && files.length > 0) {
      setError(`图片需为 JPG/PNG/WebP/GIF，且单张不超过 ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB。`);
      return;
    }
    setImageFiles(next);
    setError('');
  }

  function handlePaste(event: React.ClipboardEvent) {
    const imageItems = Array.from(event.clipboardData.items).filter((item) =>
      item.kind === 'file' && item.type.startsWith('image/'),
    );
    if (imageItems.length === 0) return;
    const pasted = imageItems
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null)
      .filter(isAllowedImage)
      .slice(0, MAX_IMAGE_COUNT - imageFiles.length);
    if (pasted.length > 0) {
      setImageFiles((current) => [...current, ...pasted].slice(0, MAX_IMAGE_COUNT));
    }
  }

  async function uploadImages() {
    if (!imageFiles.length || !user) return [];

    const urls: string[] = [];
    setUploadingCount(imageFiles.length);
    try {
      for (const file of imageFiles) {
        if (!isAllowedImage(file)) throw new Error(`图片需为 JPG/PNG/WebP/GIF，且单张不超过 ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB。`);
        const ext = extensionForImageType(file.type);
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('submission-images')
          .upload(path, file, { cacheControl: '3600', contentType: file.type, upsert: false });

        if (uploadError) throw new Error(uploadError.message || '图片上传失败');

        const { data } = supabase.storage.from('submission-images').getPublicUrl(path);
        if (data.publicUrl) urls.push(data.publicUrl);
        setUploadingCount((n) => Math.max(0, n - 1));
      }
    } finally {
      setUploadingCount(0);
    }
    return urls;
  }

  async function submitProblem(imageUrls: string[]) {
    const markdown = buildProblemMarkdown(problemForm);
    return supabase.from('submissions').insert({
      submission_type: 'problem',
      problem_id: null,
      problem_source: clampText(problemForm.source, MAX_TITLE_CHARS),
      user_id: user?.id,
      kind: 'standard',
      title: clampText(problemForm.title, MAX_TITLE_CHARS),
      content: {
        markdown,
        imageUrls,
        source: clampText(problemForm.source, MAX_TITLE_CHARS),
        statement: clampText(problemForm.statement, MAX_GENERAL_TEXT_CHARS),
        answer: clampText(problemForm.answer, MAX_GENERAL_TEXT_CHARS),
        tags: toLines(problemForm.tags),
        note: clampText(problemForm.note, MAX_GENERAL_TEXT_CHARS),
      },
      attachment_urls: imageUrls,
      status: 'pending',
    });
  }

  function generateDraftId() {
    return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  async function submitVault() {
    const tags = toLines(vaultForm.tags);
    const statement = vaultForm.statement.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const { error: err } = await supabase.from('problem_drafts').insert({
      id: generateDraftId(),
      year: Number(vaultForm.year) || new Date().getFullYear(),
      region: clampText(vaultForm.region, MAX_TITLE_CHARS),
      paper: clampText(vaultForm.paper, MAX_TITLE_CHARS),
      number: clampText(vaultForm.number, MAX_TITLE_CHARS),
      difficulty: clampText(vaultForm.difficulty, MAX_TITLE_CHARS),
      question_type: clampText(vaultForm.questionType, MAX_TITLE_CHARS),
      tags,
      title: clampText(vaultForm.title, MAX_TITLE_CHARS),
      statement,
      answer: clampText(vaultForm.answer, MAX_GENERAL_TEXT_CHARS),
      notes: clampText(vaultForm.notes, MAX_GENERAL_TEXT_CHARS),
      status: 'drafting',
    });
    return { error: err };
  }

  async function submitSolution(imageUrls: string[]) {
    if (activeContestContext && !contestSubmissionState.canSubmit) {
      return { error: { message: contestSubmissionState.description } };
    }

    const normalizedTitle = clampText(solutionForm.title, MAX_TITLE_CHARS)
      || (activeContestContext?.contestProblem
        ? `思路投稿：${activeContestContext.contestProblem.title}`
        : `${contestSolutionTypeMeta[solutionForm.contestSolutionType].label}投稿`);
    const normalizedForm = {
      ...solutionForm,
      title: normalizedTitle,
      approach: clampText(solutionForm.approach, activeContestContext ? MAX_CONTEST_THOUGHT_CHARS : MAX_GENERAL_TEXT_CHARS),
      keyTransform: clampText(solutionForm.keyTransform, MAX_GENERAL_TEXT_CHARS),
      steps: clampText(solutionForm.steps, MAX_GENERAL_TEXT_CHARS),
      insight: clampText(solutionForm.insight, MAX_GENERAL_TEXT_CHARS),
      verification: clampText(solutionForm.verification, MAX_GENERAL_TEXT_CHARS),
      challengeClaim: clampText(solutionForm.challengeClaim, MAX_GENERAL_TEXT_CHARS),
      challengeAdvantages: clampText(solutionForm.challengeAdvantages, MAX_GENERAL_TEXT_CHARS),
      challengeRisk: clampText(solutionForm.challengeRisk, MAX_GENERAL_TEXT_CHARS),
      observationWhy: clampText(solutionForm.observationWhy, MAX_GENERAL_TEXT_CHARS),
      transformationJustification: clampText(solutionForm.transformationJustification, MAX_GENERAL_TEXT_CHARS),
    };
    const markdown = buildSolutionMarkdown(normalizedForm, selectedProblem, activeContestContext, imageUrls);
    const isPostContest = activeContestContext ? contestSubmissionState.isPostContest : false;
    const challengeAdvantages = toLines(normalizedForm.challengeAdvantages);
    const challenge = selectedChallengeSolution
      ? {
          targetSolutionId: selectedChallengeSolution.id,
          targetSolutionTitle: selectedChallengeSolution.title,
          targetSolutionAuthor: selectedChallengeSolution.author,
          claim: normalizedForm.challengeClaim,
          advantages: challengeAdvantages,
          risk: normalizedForm.challengeRisk,
        }
      : null;
    return supabase.from('submissions').insert({
      submission_type: 'solution',
      // When the contest problem is draft-backed the id in solutionForm.problemId
      // is a problem_drafts.id, not a problems.id. Route it to the correct column
      // so the DB FK and the 012 trigger can enforce contest membership properly.
      // After the draft is promoted, promote-problem-draft.ts relinks these rows
      // to the real problem_id automatically.
      problem_id: activeContestContext?.contestProblem?.draftProblemId
        ? null
        : solutionForm.problemId,
      draft_problem_id: activeContestContext?.contestProblem?.draftProblemId
        ? solutionForm.problemId
        : null,
      problem_source: selectedProblem?.source,
      user_id: user?.id,
      kind: normalizedForm.kind,
      title: normalizedTitle,
      contest_slug: activeContestContext?.contest.slug,
      contest_solution_type: activeContestContext ? solutionForm.contestSolutionType : null,
      is_post_contest: isPostContest,
      challenge_target_solution_id: challenge?.targetSolutionId ?? null,
      challenge_claim: challenge?.claim ?? null,
      challenge_advantages: challenge?.advantages ?? [],
      challenge_risk: challenge?.risk ?? null,
      attachment_urls: imageUrls,
      content: {
        markdown,
        thought: activeContestContext ? normalizedForm.approach : undefined,
        imageUrls,
        contest: activeContestContext
          ? {
              slug: activeContestContext.contest.slug,
              contestId: activeContestContext.contest.id,
              title: activeContestContext.contest.title,
              contestProblemId: activeContestContext.contestProblem?.id,
              contestProblemTitle: activeContestContext.contestProblem?.title,
              contestSolutionType: solutionForm.contestSolutionType,
              isPostContest,
            }
          : undefined,
        approach: normalizedForm.approach,
        keyTransform: normalizedForm.keyTransform,
        steps: normalizedForm.steps,
        insight: normalizedForm.insight,
        verification: normalizedForm.verification,
        json: {
          solution: {
            ...(challenge ? { challenge } : {}),
            // stable keys that map to ProofGraphV1 fields
            observationSignal: normalizedForm.approach,
            observationWhy: normalizedForm.observationWhy,
            transformationFrom: normalizedForm.keyTransform,
            transformationJustification: normalizedForm.transformationJustification,
            verificationSteps: normalizedForm.verification,
            ...(challenge
              ? {
                  challengeClaim: challenge.claim,
                  challengeAdvantages: challenge.advantages,
                  challengeRisk: challenge.risk,
                }
              : {}),
            // fork provenance — stored separately from challenge metadata
            ...(initialForkSolutionId && !forkDismissed
              ? (() => {
                  const src = selectedProblem?.solutions?.find((s) => s.id === initialForkSolutionId);
                  return src
                    ? { forkOf: { solutionId: src.id, solutionTitle: src.title, solutionAuthor: src.author } }
                    : {};
                })()
              : {}),
          },
        },
      },
      status: 'pending',
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    if (mode === 'solution' && activeContestContext && !contestSubmissionState.canSubmit) {
      setError(contestSubmissionState.description);
      return;
    }

    setSubmitting(true);
    setError('');

    let imageUrls: string[] = [];
    try {
      imageUrls = await uploadImages();
    } catch (uploadError) {
      setSubmitting(false);
      setError(uploadError instanceof Error ? uploadError.message : '图片上传失败，请稍后再试。');
      return;
    }

    const { error: submitError } = vaultMode
      ? await submitVault()
      : mode === 'problem'
        ? await submitProblem(imageUrls)
        : await submitSolution(imageUrls);

    setSubmitting(false);
    if (submitError) {
      setError(submitError.message || '提交失败，请稍后再试。');
      return;
    }

    setDone(mode);
    if (activeDraftKey) clearContestDraft(activeDraftKey);
    if (vaultMode) {
      setVaultForm(initialVaultForm);
    } else if (mode === 'problem') {
      setProblemForm(initialProblemForm);
    } else {
      setSolutionForm({
        ...initialSolutionForm,
        problemId: initialSelectedProblemId,
      });
    }
    setImageFiles([]);
  }

  if (loading) {
    return <div className="h-56 animate-pulse rounded bg-white/5" />;
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <div className={`border p-4 ${isContestMode ? 'border-amber-400/25 bg-amber-400/[0.06]' : 'border-white/10 bg-black/20'}`}>
          <p className={`text-sm font-bold ${isContestMode ? 'text-amber-100' : 'text-white'}`}>
            {isContestMode ? '比赛投稿模式' : '普通投稿模式'}
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            {isContestMode
              ? '这里收集参赛思路，不要求写成完整标准答案。一个入口、一个观察、一个模糊但有价值的感觉，都可以先投进来。'
              : '普通投稿会进入题库审核，更适合提交完整题目或相对成型的解法。'}
          </p>
          {activeContestContext && (
            <p className={`mt-3 border px-3 py-2 text-xs leading-5 ${
              contestSubmissionState.canSubmit
                ? 'border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-200'
                : 'border-red-400/25 bg-red-400/[0.06] text-red-200'
            }`}>
              <strong>{contestSubmissionState.label}</strong>：{contestSubmissionState.description}
            </p>
          )}
        </div>
      <div className="rounded border border-amber-400/30 bg-amber-400/[0.06] p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-400" />
          <div>
            <p className="font-bold text-white">需要登录才能投稿</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">登录后可以提交新题或为已有题补充解法，所有内容都会先进入审核队列。</p>
            <Link href="/auth/login" className="mt-4 inline-flex h-10 items-center gap-2 bg-cyan-400 px-5 text-sm font-bold text-zinc-950 transition hover:bg-cyan-300">
              <LogIn className="size-4" />
              前往登录
            </Link>
          </div>
        </div>
      </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} onPaste={handlePaste} className="space-y-5">
      {/* Mode indicator */}
      <div className={`flex items-center gap-3 border px-4 py-3 ${
        isContestMode
          ? 'border-amber-400/40 bg-amber-400/[0.08]'
          : 'border-white/10 bg-black/20'
      }`}>
        <div className={`size-2 rounded-full shrink-0 ${isContestMode ? 'bg-amber-400' : 'bg-zinc-600'}`} />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-bold ${isContestMode ? 'text-amber-200' : 'text-white'}`}>
            {isContestMode ? '比赛投稿模式' : '普通投稿模式'}
          </p>
          <p className="mt-0.5 text-xs leading-5 text-zinc-500">
            {isContestMode
              ? '不要求完整答案——一个入口、一个观察、一个有价值的感觉都可以投。'
              : '普通投稿会进入题库审核，适合提交完整题目或成型解法。'}
          </p>
        </div>
      </div>

      {/* Contest draft restore banner */}
      {isContestMode && hasDraftToRestore && !draftRestored && (
        <div className="flex items-center justify-between gap-3 border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3">
          <div className="flex items-center gap-2 text-sm">
            <RotateCcw className="size-4 shrink-0 text-amber-400" />
            <span className="text-zinc-300">发现上次未提交的草稿，是否恢复？</span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={restoreDraft} className="inline-flex h-8 items-center border border-amber-400/40 bg-amber-400/10 px-3 text-xs font-bold text-amber-300 hover:bg-amber-400/15">
              恢复草稿
            </button>
            <button type="button" onClick={discardDraft} className="inline-flex h-8 items-center border border-white/10 px-3 text-xs text-zinc-500 hover:text-white">
              忽略
            </button>
          </div>
        </div>
      )}
      {isContestMode && draftRestored && (
        <p className="text-xs text-zinc-600">已恢复上次草稿。提交成功后自动清除。</p>
      )}

      {!isContestMode && (
        <div className="grid grid-cols-2 gap-2 rounded border border-white/10 bg-black/20 p-1">
        {[
          ['solution', Lightbulb, '上传解法'],
          ['problem', FilePlus2, '上传题目'],
        ].map(([value, Icon, label]) => {
          const ModeIcon = Icon as typeof Lightbulb;
          const active = mode === value;
          return (
            <button
              key={value as string}
              type="button"
              onClick={() => {
                setMode(value as SubmitMode);
                setDone(null);
                setError('');
              }}
              className={`inline-flex h-11 items-center justify-center gap-2 rounded text-sm font-bold transition ${
                active ? 'bg-cyan-400 text-zinc-950' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-white'
              }`}
            >
              <ModeIcon className="size-4" />
              {label as string}
            </button>
          );
        })}
        </div>
      )}

      {done && (
        <div className="flex items-start gap-3 border border-emerald-500/40 bg-emerald-500/[0.08] px-4 py-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
          <div className="text-sm leading-6 text-zinc-300">
            {done === 'problem' ? (
              <p>已提交题目，感谢贡献。管理员审核后会进入正式题库。</p>
            ) : isContestMode ? (
              <>
                <p>已提交参赛思路，感谢参赛！管理员审核通过后，会进入本场比赛的思路专区，讨论阶段开放互评——不会自动进入正式题库。</p>
                {contestContext && (
                  <Link
                    href={`/contests/${contestContext.contest.slug}`}
                    className="mt-2 inline-block text-xs font-bold text-cyan-300 hover:underline"
                  >
                    返回比赛主页
                  </Link>
                )}
              </>
            ) : (
              <p>已提交解法，感谢贡献。管理员审核后会进入正式题库。</p>
            )}
          </div>
        </div>
      )}

      {activeContestContext && mode === 'solution' && (
        <div className="border border-amber-400/35 bg-amber-400/[0.07]">
          <div className="px-4 py-3">
            <p className="text-sm font-bold text-amber-200">{activeContestContext.contest.title}</p>
            <p className="mt-0.5 text-xs leading-5 text-zinc-400">
              {activeContestContext.contestProblem
              ? `当前投稿会作为 Day ${activeContestContext.contestProblem.dayIndex}「${activeContestContext.contestProblem.title}」的参赛解法进入审核。`
              : '当前投稿会带上比赛上下文，管理员审核后可归入本届思路擂台。'}
          </p>
          <p className={`mt-2 border px-3 py-1.5 text-xs leading-5 ${
            contestSubmissionState.canSubmit
              ? 'border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-300'
              : 'border-red-500/40 bg-red-500/[0.08] text-red-300'
          }`}>
            <strong>{contestSubmissionState.label}</strong>：{contestSubmissionState.description}
          </p>
          </div>
        </div>
      )}

      {mode === 'solution' ? (
        <div className="space-y-5">
          {isContestMode && availableProblems.length === 0 && (
            <div className="border border-red-400/25 bg-red-400/[0.06] p-4 text-sm leading-6 text-red-200">
              这场比赛还没有关联可投稿的题目。请等待管理员在比赛后台关联题目后再提交。
            </div>
          )}
          {/* Fork banner */}
          {initialForkSolutionId && !forkDismissed && (() => {
            const src = selectedProblem?.solutions?.find((s) => s.id === initialForkSolutionId);
            if (!src) return null;
            return (
              <div className="flex items-start justify-between gap-3 border border-violet-400/30 bg-violet-400/[0.06] p-3 text-sm">
                <div className="min-w-0">
                  <span className="font-bold text-violet-200">你正在 fork：</span>
                  <span className="text-zinc-300"><MathBlock>{src.title}</MathBlock></span>
                  <span className="mx-2 text-zinc-600">/</span>
                  <span className="text-zinc-500">{src.author}</span>
                  <p className="mt-1 text-xs leading-5 text-zinc-600">
                    思路来源、关键转化和最值得学的地方已预填。请修改成你自己的路线；如果要挑战原解，请在下方另选挑战对象并写明主张。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setForkDismissed(true)}
                  className="shrink-0 text-xs text-zinc-500 hover:text-white"
                  aria-label="关闭 fork 提示"
                >
                  ✕
                </button>
              </div>
            );
          })()}
          <label className="grid min-w-0 gap-2 text-sm">
            <span className="font-bold text-white">选择对应题目</span>
            <select
              required
              value={solutionForm.problemId}
              onChange={(event) => setSolutionForm({ ...solutionForm, problemId: event.target.value })}
              className="h-11 w-full min-w-0 rounded border border-white/10 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-cyan-400/50"
            >
              {availableProblems.map((problem) => (
                <option key={problem.id} value={problem.id}>{problem.source} · {problem.title}</option>
              ))}
            </select>
            {isContestMode && (
              <span className="text-xs leading-5 text-zinc-600">比赛投稿只能选择本场比赛关联的题目。</span>
            )}
          </label>

          {isContestMode ? (
            <>
              <div className="grid gap-4 xl:grid-cols-2">
                <TextField
                  label="投稿标题（选填）"
                  value={solutionForm.title}
                  onChange={(title) => setSolutionForm({ ...solutionForm, title })}
                  placeholder="给你的思路起个名字，例如：切线放缩入口"
                />
                <label className="grid min-w-0 gap-2 text-sm">
                  <span className="font-bold text-white">解法类型</span>
                  <select
                    value={solutionForm.contestSolutionType}
                    onChange={(event) => setSolutionForm({ ...solutionForm, contestSolutionType: event.target.value as ContestSolutionType })}
                    className="h-11 w-full min-w-0 rounded border border-white/10 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-amber-400/50"
                  >
                    {contestSolutionTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <TextArea
                required
                label="你的思路"
                value={solutionForm.approach}
                onChange={(approach) => setSolutionForm({ ...solutionForm, approach })}
                rows={9}
                placeholder="可以很粗糙：一个入口、一个观察、一个卡点、一张草稿图，或者你希望别人接着讨论的地方。"
              />
              <ImageUploadField
                files={imageFiles}
                onAdd={updateImageFiles}
                onRemove={(index) => setImageFiles((current) => current.filter((_, i) => i !== index))}
                uploadingCount={uploadingCount}
              />
            </>
          ) : (
            <>
            {selectedProblem?.solutions && selectedProblem.solutions.length > 0 && (
              <section className="rounded border border-amber-400/25 bg-amber-400/[0.055] p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-amber-100">挑战已有解法</h3>
                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      选择一个已有解法作为对手，说明你的路线在什么场景下更值得进入擂台。
                    </p>
                  </div>
                  {selectedChallengeSolution && (
                    <span className="shrink-0 border border-amber-400/30 px-2.5 py-1 text-xs font-bold text-amber-200">
                      正在挑战：<MathBlock>{selectedChallengeSolution.title}</MathBlock>
                    </span>
                  )}
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <label className="grid min-w-0 gap-2 text-sm">
                    <span className="font-bold text-white">挑战对象</span>
                    <select
                      value={solutionForm.challengeTargetSolutionId}
                      onChange={(event) => setSolutionForm({
                        ...solutionForm,
                        challengeTargetSolutionId: event.target.value,
                        challengeClaim: event.target.value ? solutionForm.challengeClaim : '',
                        challengeAdvantages: event.target.value ? solutionForm.challengeAdvantages : '',
                        challengeRisk: event.target.value ? solutionForm.challengeRisk : '',
                      })}
                      className="h-11 w-full min-w-0 rounded border border-white/10 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-amber-400/50"
                    >
                      <option value="">不挑战，作为独立补充解法</option>
                      {selectedProblem.solutions.map((solution) => (
                        <option key={solution.id} value={solution.id}>
                          {stripMathDelimiters(solution.title)} · {solution.author}
                        </option>
                      ))}
                    </select>
                  </label>
                  <TextField
                    label="一句话优势"
                    value={solutionForm.challengeClaim}
                    onChange={(challengeClaim) => setSolutionForm({ ...solutionForm, challengeClaim })}
                    placeholder="例如：更少分类，更适合 15 分钟内完成"
                  />
                </div>
                {solutionForm.challengeTargetSolutionId && (
                  <div className="mt-4 grid gap-4 xl:grid-cols-2">
                    <TextArea
                      label="优势标签"
                      value={solutionForm.challengeAdvantages}
                      onChange={(challengeAdvantages) => setSolutionForm({ ...solutionForm, challengeAdvantages })}
                      rows={3}
                      placeholder="每行一个：更短、计算量更少、入口更自然、讲解更友好"
                    />
                    <TextArea
                      label="风险自评"
                      value={solutionForm.challengeRisk}
                      onChange={(challengeRisk) => setSolutionForm({ ...solutionForm, challengeRisk })}
                      rows={3}
                      placeholder="它在哪些情况下不如被挑战的解法？"
                    />
                  </div>
                )}
              </section>
            )}
            <div className="grid gap-4 xl:grid-cols-2">
              <TextField
                required
                label="解法标题"
                value={solutionForm.title}
                onChange={(title) => setSolutionForm({ ...solutionForm, title })}
                placeholder="例如：差函数导数法"
              />
              <label className="grid min-w-0 gap-2 text-sm">
                <span className="font-bold text-white">解法类型</span>
                <select
                  value={solutionForm.kind}
                  onChange={(event) => setSolutionForm({ ...solutionForm, kind: event.target.value as SolutionKind })}
                  className="h-11 w-full min-w-0 rounded border border-white/10 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-cyan-400/50"
                >
                  {KINDS.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
                </select>
              </label>
            </div>
            <TextArea
              required
              label="思路来源"
              value={solutionForm.approach}
              onChange={(approach) => setSolutionForm({ ...solutionForm, approach })}
              rows={4}
              placeholder="为什么会想到这条路线？"
            />
            <TextArea
              label="关键转化"
              value={solutionForm.keyTransform}
              onChange={(keyTransform) => setSolutionForm({ ...solutionForm, keyTransform })}
              rows={3}
              placeholder="真正改变问题形态的一步"
            />
            <TextArea
              required
              label="完整步骤"
              value={solutionForm.steps}
              onChange={(steps) => setSolutionForm({ ...solutionForm, steps })}
              rows={8}
              placeholder="写出能独立复算的推理链"
            />
            <div className="grid gap-4 xl:grid-cols-2">
              <TextArea label="最值得学的地方" value={solutionForm.insight} onChange={(insight) => setSolutionForm({ ...solutionForm, insight })} rows={4} />
              <TextArea label="可验证位置" value={solutionForm.verification} onChange={(verification) => setSolutionForm({ ...solutionForm, verification })} rows={4} />
            </div>
            <CASVerifier steps={solutionForm.steps.split('\n').filter(Boolean)} />
            <details className="group rounded border border-white/10 bg-black/20">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold text-zinc-400 marker:hidden hover:text-white">
                推理结构（选填）
                <span className="text-xs font-normal text-zinc-600">帮助审核员更快整理推理图谱</span>
              </summary>
              <div className="space-y-3 border-t border-white/10 px-4 pb-4 pt-3">
                <TextArea
                  label="为什么这个条件是入口"
                  value={solutionForm.observationWhy}
                  onChange={(observationWhy) => setSolutionForm({ ...solutionForm, observationWhy })}
                  rows={2}
                  placeholder="这个条件为什么触发了你的路线？"
                />
                <TextArea
                  label="关键转化的合法性说明"
                  value={solutionForm.transformationJustification}
                  onChange={(transformationJustification) => setSolutionForm({ ...solutionForm, transformationJustification })}
                  rows={2}
                  placeholder="为什么这一步变换是合法的？"
                />
              </div>
            </details>
            <ImageUploadField
              files={imageFiles}
              onAdd={updateImageFiles}
              onRemove={(index) => setImageFiles((current) => current.filter((_, i) => i !== index))}
              uploadingCount={uploadingCount}
            />
            </>
          )}
        </div>
      ) : vaultMode ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField required label="年份" value={vaultForm.year} onChange={(year) => setVaultForm({ ...vaultForm, year })} placeholder="2026" />
            <TextField required label="地区" value={vaultForm.region} onChange={(region) => setVaultForm({ ...vaultForm, region })} placeholder="全国甲卷" />
            <TextField label="卷别" value={vaultForm.paper} onChange={(paper) => setVaultForm({ ...vaultForm, paper })} placeholder="数学（理）" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField label="题号" value={vaultForm.number} onChange={(number) => setVaultForm({ ...vaultForm, number })} placeholder="第 20 题" />
            <TextField label="难度" value={vaultForm.difficulty} onChange={(difficulty) => setVaultForm({ ...vaultForm, difficulty })} placeholder="困难" />
            <TextField label="题型" value={vaultForm.questionType} onChange={(questionType) => setVaultForm({ ...vaultForm, questionType })} placeholder="填空题" />
          </div>
          <TextField required label="题目标题" value={vaultForm.title} onChange={(title) => setVaultForm({ ...vaultForm, title })} placeholder="用一句话概括题目主题，可含 LaTeX，如：关于 $x^2$ 的不等式" />
          <MathPreviewTextArea required label="完整题干" value={vaultForm.statement} onChange={(statement) => setVaultForm({ ...vaultForm, statement })} rows={8} placeholder="在此输入题目，$x^2 + y^2 = r^2$，支持行内公式 $...$ 和块公式 $$...$$" />
          <MathPreviewTextArea label="标准答案" value={vaultForm.answer} onChange={(answer) => setVaultForm({ ...vaultForm, answer })} rows={3} placeholder="答案，支持 LaTeX" />
          <div className="grid gap-4 xl:grid-cols-2">
            <TextArea label="标签" value={vaultForm.tags} onChange={(tags) => setVaultForm({ ...vaultForm, tags })} rows={3} placeholder="导数、圆锥曲线、数列" />
            <TextArea label="备注" value={vaultForm.notes} onChange={(notes) => setVaultForm({ ...vaultForm, notes })} rows={3} placeholder="命题背景、出处链接、审核提示" />
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-2">
            <TextField required label="题目来源" value={problemForm.source} onChange={(source) => setProblemForm({ ...problemForm, source })} placeholder="例如：2026 天津卷第 20 题" />
            <TextField required label="题目标题" value={problemForm.title} onChange={(title) => setProblemForm({ ...problemForm, title })} placeholder="用一句话概括题目主题" />
          </div>
          <MathPreviewTextArea required label="完整题干" value={problemForm.statement} onChange={(statement) => setProblemForm({ ...problemForm, statement })} rows={8} placeholder="支持 LaTeX：$\frac{1}{2}$、$$\sum_{i=1}^n$$" />
          <div className="grid gap-4 xl:grid-cols-2">
            <MathPreviewTextArea label="标准答案" value={problemForm.answer} onChange={(answer) => setProblemForm({ ...problemForm, answer })} rows={4} placeholder="答案，支持 LaTeX" />
            <TextArea label="标签" value={problemForm.tags} onChange={(tags) => setProblemForm({ ...problemForm, tags })} rows={4} placeholder="导数、圆锥曲线、数列" />
          </div>
          <TextArea label="补充说明" value={problemForm.note} onChange={(note) => setProblemForm({ ...problemForm, note })} rows={3} placeholder="来源链接、图片说明、你希望补充的审核信息" />
          <ImageUploadField
            files={imageFiles}
            onAdd={updateImageFiles}
            onRemove={(index) => setImageFiles((current) => current.filter((_, i) => i !== index))}
            uploadingCount={uploadingCount}
          />
        </div>
      )}

      {error && (
        <div className="rounded border border-red-400/30 bg-red-400/[0.06] px-4 py-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="submit"
          disabled={submitting || (mode === 'solution' && availableProblems.length === 0) || (mode === 'solution' && activeContestContext && !contestSubmissionState.canSubmit)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded bg-cyan-400 px-8 text-sm font-bold text-zinc-950 transition hover:bg-cyan-300 disabled:opacity-50"
        >
          <Send className="size-4" />
          {submitting
            ? '保存中...'
            : vaultMode
              ? '存入草稿箱'
              : mode === 'problem'
                ? '提交题目'
                : contestContext
                  ? contestSubmissionState.isPostContest ? '提交赛后补充' : '提交参赛解法'
                  : '提交解法'}
        </button>
        <p className="text-xs leading-5 text-zinc-600">
          {vaultMode
            ? '保存为草稿，可随时在草稿箱中编辑或发布到公开题库。'
            : mode === 'problem'
              ? '题目审核通过后会进入题库，再继续收集多种解法。'
              : contestContext
                ? contestSubmissionState.description
                : '解法会绑定到所选题目，审核通过后进入对比视图。'}
        </p>
      </div>
    </form>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-sm">
      <span className="font-bold text-white">{label} {required && <span className="text-red-400">*</span>}</span>
      <input
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full min-w-0 rounded border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-400/50"
      />
    </label>
  );
}

function ImageUploadField({
  files,
  onAdd,
  onRemove,
  uploadingCount = 0,
}: {
  files: File[];
  onAdd: (files: FileList | null) => void;
  onRemove: (index: number) => void;
  uploadingCount?: number;
}) {
  // Generate stable object URLs for previews (revoked when component unmounts
  // or files change — kept simple, no compression).
  const previews = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files.map((f) => f.name + f.size).join(',')],
  );
  useEffect(() => () => { previews.forEach((url) => URL.revokeObjectURL(url)); }, [previews]);

  return (
    <div className="rounded border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <FileImage className="mt-0.5 size-4 shrink-0 text-cyan-300" />
          <div>
            <p className="text-sm font-bold text-white">图片</p>
            <p className="mt-1 text-xs leading-5 text-zinc-600">
              最多 {MAX_IMAGE_COUNT} 张，支持 {ALLOWED_IMAGE_TYPES.map((type) => type.replace("image/", "").toUpperCase()).join(" / ")}，单张不超过 {Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB。支持粘贴截图（Ctrl/Cmd+V）。
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {uploadingCount > 0 && (
            <span className="text-xs text-amber-300 animate-pulse">
              上传中 {uploadingCount} 张…
            </span>
          )}
          <label className="inline-flex h-9 cursor-pointer items-center justify-center border border-cyan-400/30 px-3 text-xs font-bold text-cyan-300 transition hover:bg-cyan-400/10">
            选择图片
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                onAdd(event.target.files);
                event.currentTarget.value = '';
              }}
              className="sr-only"
            />
          </label>
        </div>
      </div>
      {files.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="group relative overflow-hidden border border-white/10 bg-black/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previews[index]}
                alt={file.name}
                className="h-32 w-full object-contain"
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-black/70 px-2 py-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                <span className="min-w-0 truncate text-[11px] text-zinc-400">{file.name}</span>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="inline-flex size-6 shrink-0 items-center justify-center text-zinc-400 transition hover:text-red-400"
                  aria-label="移除图片"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="grid min-w-0 gap-2 text-sm">
      <span className="font-bold text-white">{label} {required && <span className="text-red-400">*</span>}</span>
      <textarea
        required={required}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full min-w-0 resize-y rounded border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-400/50"
      />
    </label>
  );
}
