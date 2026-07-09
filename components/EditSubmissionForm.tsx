'use client';

import { useState } from 'react';
import { AlertCircle, Send, X } from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_GENERAL_TEXT_CHARS,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_COUNT,
  MAX_TITLE_CHARS,
  clampText,
  extensionForImageType,
  isAllowedImage,
} from '@/lib/security';
import { ImageUploadField, SelectField, TextArea, TextField } from '@/components/SubmitForm';
import { MathPreviewTextArea } from '@/components/MathPreviewTextArea';

type SolutionKind = 'standard' | 'insight' | 'robust' | 'teaching';

const KINDS: Array<{ value: SolutionKind; label: string }> = [
  { value: 'standard', label: '标准解' },
  { value: 'insight', label: '启发解' },
  { value: 'robust', label: '稳健解' },
  { value: 'teaching', label: '教学解' },
];

type ChallengeInfo = {
  targetSolutionId?: string;
  targetSolutionTitle?: string;
  targetSolutionAuthor?: string;
  claim?: string;
  advantages?: string[];
  risk?: string;
};

export type EditableSubmission = {
  id: string;
  submission_type: 'problem' | 'solution';
  problem_id: string | null;
  problem_source: string | null;
  kind: SolutionKind;
  title: string;
  content: {
    markdown?: string;
    source?: string;
    statement?: string;
    answer?: string;
    tags?: string[];
    note?: string;
    approach?: string;
    keyTransform?: string;
    steps?: string;
    insight?: string;
    verification?: string;
    imageUrls?: string[];
    json?: {
      solution?: ({ challenge?: ChallengeInfo | null } & Record<string, unknown>) | undefined;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  attachment_urls?: string[] | null;
  challenge_target_solution_id?: string | null;
  challenge_claim?: string | null;
  challenge_advantages?: string[] | null;
  challenge_risk?: string | null;
};

function toLines(value: string) {
  return value
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildProblemEditMarkdown(form: { title: string; source: string; statement: string; answer: string; tags: string[]; note: string }) {
  return `# 题目投稿：${form.title}

## 来源
${form.source}

## 题干
${form.statement}

## 答案
${form.answer || '（未填写）'}

## 标签
${form.tags.map((tag) => `- ${tag}`).join('\n') || '（未填写）'}

## 备注
${form.note || '（无）'}
`;
}

function buildSolutionEditMarkdown(
  form: {
    title: string;
    kind: SolutionKind;
    approach: string;
    keyTransform: string;
    steps: string;
    insight: string;
    verification: string;
    challenge: (ChallengeInfo & { claim: string; advantages: string[]; risk: string }) | null;
  },
  problemLabel: string,
) {
  return `# 解法投稿：${form.title}

## 对应题目
${problemLabel}

## 类型
${KINDS.find((k) => k.value === form.kind)?.label ?? form.kind}

${form.challenge ? `## 挑战对象
${form.challenge.targetSolutionTitle ?? form.challenge.targetSolutionId}

## 我比它强在哪里
${form.challenge.claim || '（未填写）'}

## 优势标签
${form.challenge.advantages.map((item) => `- ${item}`).join('\n') || '（未填写）'}

## 风险自评
${form.challenge.risk || '（未填写）'}

` : ''}
## 思路来源
${form.approach}

## 关键转化
${form.keyTransform || '（未填写）'}

## 完整步骤
${form.steps}

## 最值得学的地方
${form.insight || '（未填写）'}

## 可验证位置
${form.verification || '（未填写）'}
`;
}

// Standalone edit-and-resubmit form for a submission that a moderator has
// marked needs_revision. Deliberately not folded into SubmitForm.tsx (which
// is the live, contest-critical insert path) — this only ever runs an
// UPDATE, gated server-side by the "Authors can revise needs_revision
// submissions" RLS policy + enforce_submission_revision_fields trigger
// (019_submission_author_revision.sql), which also forces status back to
// 'pending' and clears moderator_notes regardless of what this component
// sends. Scope: non-contest submissions only — the policy simply won't
// match contest-bound rows, so this form is never rendered for those
// (see app/profile/page.tsx).
export function EditSubmissionForm({
  submission,
  onCancel,
  onSaved,
}: {
  submission: EditableSubmission;
  onCancel: () => void;
  onSaved: (updated: EditableSubmission) => void;
}) {
  const supabase = createClient();
  const isProblem = submission.submission_type === 'problem';
  const previousSolution = submission.content.json?.solution ?? {};
  const challengeMeta = (previousSolution.challenge ?? null) as ChallengeInfo | null;
  const hasChallenge = Boolean(submission.challenge_target_solution_id);

  const [title, setTitle] = useState(submission.title ?? '');
  const [kind, setKind] = useState<SolutionKind>(submission.kind ?? 'standard');
  const [source, setSource] = useState(submission.content.source ?? submission.problem_source ?? '');
  const [statement, setStatement] = useState(submission.content.statement ?? '');
  const [answer, setAnswer] = useState(submission.content.answer ?? '');
  const [tags, setTags] = useState((submission.content.tags ?? []).join('\n'));
  const [note, setNote] = useState(submission.content.note ?? '');

  const [approach, setApproach] = useState(submission.content.approach ?? '');
  const [keyTransform, setKeyTransform] = useState(submission.content.keyTransform ?? '');
  const [steps, setSteps] = useState(submission.content.steps ?? '');
  const [insight, setInsight] = useState(submission.content.insight ?? '');
  const [verification, setVerification] = useState(submission.content.verification ?? '');
  const [challengeClaim, setChallengeClaim] = useState(submission.challenge_claim ?? '');
  const [challengeAdvantages, setChallengeAdvantages] = useState((submission.challenge_advantages ?? []).join('\n'));
  const [challengeRisk, setChallengeRisk] = useState(submission.challenge_risk ?? '');

  const [existingImageUrls, setExistingImageUrls] = useState(
    submission.attachment_urls ?? submission.content.imageUrls ?? [],
  );
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const totalImageCount = existingImageUrls.length + newImageFiles.length;

  function updateNewImageFiles(files: FileList | null) {
    if (!files) return;
    const next = [...newImageFiles, ...Array.from(files)]
      .filter(isAllowedImage)
      .slice(0, Math.max(0, MAX_IMAGE_COUNT - existingImageUrls.length));
    if (next.length === newImageFiles.length && files.length > 0) {
      setError(`图片需为 JPG/PNG/WebP/GIF，单张不超过 ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB，且总数不超过 ${MAX_IMAGE_COUNT} 张。`);
      return;
    }
    setNewImageFiles(next);
    setError('');
  }

  function removeExistingImage(index: number) {
    setExistingImageUrls((current) => current.filter((_, i) => i !== index));
  }

  function removeNewImage(index: number) {
    setNewImageFiles((current) => current.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (isProblem && !statement.trim()) {
      setError('请填写完整题干。');
      return;
    }
    if (!isProblem && (!approach.trim() || !steps.trim())) {
      setError('请填写思路来源和完整步骤。');
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) throw new Error('登录状态已失效，请重新登录后再试。');

      const uploadedUrls: string[] = [];
      if (newImageFiles.length) {
        setUploadingCount(newImageFiles.length);
        for (const file of newImageFiles) {
          if (!isAllowedImage(file)) {
            throw new Error(`图片需为 JPG/PNG/WebP/GIF，且单张不超过 ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB。`);
          }
          const ext = extensionForImageType(file.type);
          const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from('submission-images')
            .upload(path, file, { cacheControl: '3600', contentType: file.type, upsert: false });
          if (uploadError) throw new Error(uploadError.message || '图片上传失败');
          const { data: publicUrlData } = supabase.storage.from('submission-images').getPublicUrl(path);
          if (publicUrlData.publicUrl) uploadedUrls.push(publicUrlData.publicUrl);
          setUploadingCount((n) => Math.max(0, n - 1));
        }
      }
      const imageUrls = [...existingImageUrls, ...uploadedUrls].slice(0, MAX_IMAGE_COUNT);

      const patch = isProblem
        ? buildProblemPatch(imageUrls)
        : buildSolutionPatch(imageUrls);

      const { data, error: updateError } = await supabase
        .from('submissions')
        .update(patch)
        .eq('id', submission.id)
        .select('*');

      if (updateError) throw new Error(updateError.message || '保存失败，请稍后再试。');
      if (!data || data.length === 0) {
        throw new Error('没有权限修改这条投稿，或它已经不是"需要修改"状态，请刷新页面后重试。');
      }
      onSaved(data[0] as EditableSubmission);
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败，请稍后再试。');
    } finally {
      setSubmitting(false);
      setUploadingCount(0);
    }
  }

  function buildProblemPatch(imageUrls: string[]) {
    const normalizedTitle = clampText(title, MAX_TITLE_CHARS);
    const normalizedSource = clampText(source, MAX_TITLE_CHARS);
    const normalizedStatement = clampText(statement, MAX_GENERAL_TEXT_CHARS);
    const normalizedAnswer = clampText(answer, MAX_GENERAL_TEXT_CHARS);
    const normalizedNote = clampText(note, MAX_GENERAL_TEXT_CHARS);
    const tagList = toLines(tags);
    const markdown = buildProblemEditMarkdown({
      title: normalizedTitle,
      source: normalizedSource,
      statement: normalizedStatement,
      answer: normalizedAnswer,
      tags: tagList,
      note: normalizedNote,
    });

    return {
      title: normalizedTitle,
      problem_source: normalizedSource,
      content: {
        ...submission.content,
        markdown,
        source: normalizedSource,
        statement: normalizedStatement,
        answer: normalizedAnswer,
        tags: tagList,
        note: normalizedNote,
        imageUrls,
      },
      attachment_urls: imageUrls,
      status: 'pending',
      moderator_notes: null,
    };
  }

  function buildSolutionPatch(imageUrls: string[]) {
    const normalizedTitle = clampText(title, MAX_TITLE_CHARS);
    const normalizedApproach = clampText(approach, MAX_GENERAL_TEXT_CHARS);
    const normalizedKeyTransform = clampText(keyTransform, MAX_GENERAL_TEXT_CHARS);
    const normalizedSteps = clampText(steps, MAX_GENERAL_TEXT_CHARS);
    const normalizedInsight = clampText(insight, MAX_GENERAL_TEXT_CHARS);
    const normalizedVerification = clampText(verification, MAX_GENERAL_TEXT_CHARS);
    const challenge = hasChallenge
      ? {
          targetSolutionId: submission.challenge_target_solution_id ?? undefined,
          targetSolutionTitle: challengeMeta?.targetSolutionTitle,
          targetSolutionAuthor: challengeMeta?.targetSolutionAuthor,
          claim: clampText(challengeClaim, MAX_GENERAL_TEXT_CHARS),
          advantages: toLines(challengeAdvantages),
          risk: clampText(challengeRisk, MAX_GENERAL_TEXT_CHARS),
        }
      : null;
    const markdown = buildSolutionEditMarkdown(
      {
        title: normalizedTitle,
        kind,
        approach: normalizedApproach,
        keyTransform: normalizedKeyTransform,
        steps: normalizedSteps,
        insight: normalizedInsight,
        verification: normalizedVerification,
        challenge,
      },
      submission.problem_source ?? submission.problem_id ?? '',
    );

    return {
      title: normalizedTitle,
      kind,
      content: {
        ...submission.content,
        markdown,
        approach: normalizedApproach,
        keyTransform: normalizedKeyTransform,
        steps: normalizedSteps,
        insight: normalizedInsight,
        verification: normalizedVerification,
        imageUrls,
        json: {
          ...(submission.content.json ?? {}),
          solution: {
            ...previousSolution,
            title: normalizedTitle,
            kind,
            origin: normalizedApproach,
            keyTransform: normalizedKeyTransform,
            process: normalizedSteps,
            inspiration: normalizedInsight,
            verificationSteps: normalizedVerification,
            observationSignal: normalizedApproach,
            challenge,
            ...(challenge
              ? { challengeClaim: challenge.claim, challengeAdvantages: challenge.advantages, challengeRisk: challenge.risk }
              : {}),
          },
        },
      },
      challenge_claim: challenge?.claim ?? null,
      challenge_advantages: challenge?.advantages ?? [],
      challenge_risk: challenge?.risk ?? null,
      attachment_urls: imageUrls,
      status: 'pending',
      moderator_notes: null,
    };
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-5 rounded border border-cyan-400/25 bg-cyan-400/[0.03] p-5">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-bold text-white">修改并重新提交</h4>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex size-7 items-center justify-center text-zinc-500 transition hover:text-white"
          aria-label="取消修改"
        >
          <X className="size-4" />
        </button>
      </div>

      {isProblem ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField required label="题目来源" value={source} onChange={setSource} placeholder="例如：2026 天津卷第 20 题" />
            <TextField required label="题目标题" value={title} onChange={setTitle} placeholder="用一句话概括题目主题" />
          </div>
          <MathPreviewTextArea required label="完整题干" value={statement} onChange={setStatement} rows={8} placeholder="支持 LaTeX：$\frac{1}{2}$、$$\sum_{i=1}^n$$" />
          <div className="grid gap-4 sm:grid-cols-2">
            <MathPreviewTextArea label="标准答案" value={answer} onChange={setAnswer} rows={4} placeholder="答案，支持 LaTeX" />
            <TextArea label="标签" value={tags} onChange={setTags} rows={4} placeholder="导数、圆锥曲线、数列" />
          </div>
          <TextArea label="补充说明" value={note} onChange={setNote} rows={3} placeholder="来源链接、图片说明、你希望补充的审核信息" />
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-[1.5fr_1fr]">
            <TextField required label="解法标题" value={title} onChange={setTitle} placeholder="一句话概括这条解法" />
            <SelectField label="解法类型" value={kind} onChange={(value) => setKind(value as SolutionKind)} options={KINDS.map((k) => k.value)} />
          </div>
          <TextArea required label="思路来源" value={approach} onChange={setApproach} rows={4} placeholder="为什么会想到这条路线？" />
          <TextArea label="关键转化" value={keyTransform} onChange={setKeyTransform} rows={3} placeholder="真正改变问题形态的一步" />
          <TextArea required label="完整步骤" value={steps} onChange={setSteps} rows={8} placeholder="写出能独立复算的推理链" />
          <div className="grid gap-4 xl:grid-cols-2">
            <TextArea label="最值得学的地方" value={insight} onChange={setInsight} rows={4} />
            <TextArea label="可验证位置" value={verification} onChange={setVerification} rows={4} />
          </div>
          {hasChallenge && (
            <div className="space-y-4 rounded border border-amber-400/20 bg-amber-400/[0.04] p-4">
              <p className="text-xs font-bold text-amber-300">
                挑战对象：{challengeMeta?.targetSolutionTitle ?? submission.challenge_target_solution_id}
                {challengeMeta?.targetSolutionAuthor ? ` / ${challengeMeta.targetSolutionAuthor}` : ''}
              </p>
              <TextArea label="我比它强在哪里" value={challengeClaim} onChange={setChallengeClaim} rows={3} />
              <TextArea label="优势标签" value={challengeAdvantages} onChange={setChallengeAdvantages} rows={2} placeholder="计算更简、思路更自然" />
              <TextArea label="风险自评" value={challengeRisk} onChange={setChallengeRisk} rows={2} />
            </div>
          )}
        </>
      )}

      <div className="space-y-3">
        {existingImageUrls.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {existingImageUrls.map((url, index) => (
              <div key={url} className="group relative overflow-hidden border border-white/10 bg-black/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="已上传图片" className="h-32 w-full object-contain" />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 bg-black/70 px-2 py-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => removeExistingImage(index)}
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
        {totalImageCount < MAX_IMAGE_COUNT && (
          <ImageUploadField files={newImageFiles} onAdd={updateNewImageFiles} onRemove={removeNewImage} uploadingCount={uploadingCount} />
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 border border-red-400/30 bg-red-400/[0.06] px-4 py-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex h-10 items-center justify-center gap-2 rounded bg-cyan-400 px-5 text-sm font-bold text-zinc-950 transition active:translate-y-px hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send className="size-4" />
          {submitting ? '提交中…' : '重新提交审核'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="inline-flex h-10 items-center justify-center px-4 text-sm text-zinc-400 transition hover:text-white disabled:opacity-60"
        >
          取消
        </button>
      </div>
      <p className="text-xs text-zinc-600">图片总数不能超过 {MAX_IMAGE_COUNT} 张，支持 {ALLOWED_IMAGE_TYPES.map((type) => type.replace('image/', '').toUpperCase()).join(' / ')}。重新提交后状态会回到"等待审核"。</p>
    </form>
  );
}
