'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { publishSubmission } from '@/lib/publish-submission';
import { createClient } from '@/lib/supabase-client';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  FileText,
  Lightbulb,
  ListChecks,
  MessageSquareText,
  Route,
  Save,
  SlidersHorizontal,
  X,
  XCircle,
} from 'lucide-react';
import { MathBlock } from '@/components/MathBlock';
import { ScoreBar } from '@/components/ScoreBar';
import { convertPlainMathTextToLatex } from '@/lib/math-normalizer';
import { getSolutionKindMeta } from '@/lib/solution-kinds';
import { contestSolutionTypeMeta } from '@/lib/contest-meta';
import type { ContestSolutionType, SolutionScores } from '@/lib/types';

type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'needs_revision';
type SolutionKind = 'standard' | 'insight' | 'robust' | 'teaching';

type SubmissionContent = {
  markdown?: string;
  json?: {
    solution?: Record<string, unknown>;
    [key: string]: unknown;
  };
  approach?: string;
  keyTransform?: string;
  steps?: string;
  insight?: string;
  verification?: string;
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
  created_at: string;
  user_id: string;
  moderator_notes?: string | null;
  contest_slug?: string | null;
  contest_problem_key?: string | null;
  contest_solution_type?: ContestSolutionType | null;
  is_post_contest?: boolean | null;
  attachment_urls?: string[] | null;
};

type ReviewForm = {
  title: string;
  kind: SolutionKind;
  tags: string;
  origin: string;
  keyTransform: string;
  process: string;
  inspiration: string;
  transferValue: string;
  suitableFor: string;
  tradeoffs: string;
  pitfalls: string;
  verifiableSteps: string;
  scores: SolutionScores;
  scoringReason: string;
  moderatorNotes: string;
};

const scoreLabels: Array<[keyof SolutionScores, string, string]> = [
  ['correctness', '正确性', '推理是否严密'],
  ['examReady', '考场性', '时间和入口是否可控'],
  ['elegance', '结构美感', '转化是否自然简洁'],
  ['calculation', '计算量', '展开和重复运算是否少'],
  ['explanation', '讲解友好', '是否便于复盘迁移'],
];

const kindLabels: Record<SolutionKind, string> = {
  standard: '标准解',
  insight: '启发解',
  robust: '稳健解',
  teaching: '教学解',
};

const defaultScores: SolutionScores = {
  correctness: 8,
  examReady: 8,
  elegance: 8,
  calculation: 8,
  explanation: 8,
};

function splitList(value: string) {
  return value
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitProcess(value: string) {
  if (!value.trim()) return [];

  const chineseStepRe = /第[一二三四五六七八九十百]+步[:：]?/;
  if (chineseStepRe.test(value)) {
    return value
      .split(/(?=第[一二三四五六七八九十百]+步)/)
      .map((chunk) => chunk.replace(/^第[一二三四五六七八九十百]+步[:：]?\s*/, "").trim())
      .filter(Boolean);
  }

  const numericStepRe = /^\s*\d+[.)、]/m;
  if (numericStepRe.test(value)) {
    return value
      .split(/(?=^\s*\d+[.)、])/m)
      .map((chunk) => chunk.replace(/^\s*\d+[.)、]\s*/, "").trim())
      .filter(Boolean);
  }

  return value
    .split(/(?<=[。！？；])/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function joinList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).join('\n');
  return typeof value === 'string' ? value : '';
}

function normalizeScore(value: unknown, fallback: number) {
  const score = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(score)) return fallback;
  return Math.min(10, Math.max(1, Math.round(score * 10) / 10));
}

function normalizeScores(value: unknown): SolutionScores {
  const raw = value && typeof value === 'object' ? value as Partial<Record<keyof SolutionScores, unknown>> : {};
  return {
    correctness: normalizeScore(raw.correctness, defaultScores.correctness),
    examReady: normalizeScore(raw.examReady, defaultScores.examReady),
    elegance: normalizeScore(raw.elegance, defaultScores.elegance),
    calculation: normalizeScore(raw.calculation, defaultScores.calculation),
    explanation: normalizeScore(raw.explanation, defaultScores.explanation),
  };
}

function buildMarkdown(submission: Submission, form: ReviewForm) {
  return `# 解法投稿：${form.title}

## 对应题目
${submission.problem_source ?? submission.problem_id ?? '（未绑定）'}

## 类型
${kindLabels[form.kind]}

## 标签
${splitList(form.tags).map((tag) => `- ${tag}`).join('\n') || '（未填写）'}

## 思路来源
${form.origin || '（未填写）'}

## 关键转化
${form.keyTransform || '（未填写）'}

## 完整过程
${form.process || '（未填写）'}

## 启发点
${form.inspiration || '（未填写）'}

## 迁移价值
${form.transferValue || '（未填写）'}

## 适用场景
${splitList(form.suitableFor).map((item) => `- ${item}`).join('\n') || '（未填写）'}

## 代价与局限
${splitList(form.tradeoffs).map((item) => `- ${item}`).join('\n') || '（未填写）'}

## 易错点
${splitList(form.pitfalls).map((item) => `- ${item}`).join('\n') || '（未填写）'}

## 可验证步骤
${splitList(form.verifiableSteps).map((item) => `- ${item}`).join('\n') || '（未填写）'}

## 五维自评
${scoreLabels.map(([key, label]) => `- ${label}：${form.scores[key].toFixed(1)}`).join('\n')}

## 评分理由
${form.scoringReason || '（未填写）'}
`;
}

function formFromSubmission(submission: Submission): ReviewForm {
  const solution = submission.content.json?.solution ?? {};
  const scores = normalizeScores(solution.scores);

  return {
    title: String(solution.title ?? submission.title ?? ''),
    kind: (solution.kind ?? submission.kind ?? 'standard') as SolutionKind,
    tags: joinList(solution.tags),
    origin: String(solution.origin ?? submission.content.approach ?? ''),
    keyTransform: String(solution.keyTransform ?? submission.content.keyTransform ?? ''),
    process: String(solution.process ?? submission.content.steps ?? ''),
    inspiration: String(solution.inspiration ?? submission.content.insight ?? ''),
    transferValue: String(solution.transferValue ?? ''),
    suitableFor: joinList(solution.suitableFor),
    tradeoffs: joinList(solution.tradeoffs),
    pitfalls: joinList(solution.pitfalls),
    verifiableSteps: joinList(solution.verifiableSteps ?? submission.content.verification),
    scores,
    scoringReason: String(solution.scoringReason ?? ''),
    moderatorNotes: submission.moderator_notes ?? '',
  };
}

function contentFromForm(submission: Submission, form: ReviewForm): SubmissionContent {
  const previousJson = submission.content.json ?? {};
  const previousSolution = previousJson.solution ?? {};
  const solution = {
    ...previousSolution,
    kind: form.kind,
    title: form.title,
    tags: splitList(form.tags),
    origin: form.origin,
    keyTransform: form.keyTransform,
    process: form.process,
    inspiration: form.inspiration,
    transferValue: form.transferValue,
    suitableFor: splitList(form.suitableFor),
    tradeoffs: splitList(form.tradeoffs),
    pitfalls: splitList(form.pitfalls),
    verifiableSteps: splitList(form.verifiableSteps),
    scores: form.scores,
    scoringReason: form.scoringReason,
  };

  return {
    ...submission.content,
    markdown: buildMarkdown(submission, form),
    json: {
      ...previousJson,
      solution,
    },
    approach: form.origin,
    keyTransform: form.keyTransform,
    steps: form.process,
    insight: form.inspiration,
    verification: form.verifiableSteps,
  };
}

export function AdminSubmissionsView() {
  const searchParams = useSearchParams();
  const contestParam = searchParams.get('contest');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [form, setForm] = useState<ReviewForm | null>(null);
  const [previewMode, setPreviewMode] = useState<'structured' | 'card' | 'markdown'>('structured');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<'all' | 'regular' | 'contest'>(() =>
    contestParam ? 'contest' : 'all'
  );
  const supabase = createClient();

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    const { data, error: loadError } = await supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (!loadError && data) {
      setSubmissions(data as Submission[]);
    }
    setLoading(false);
  };

  const openSubmission = (submission: Submission) => {
    setSelectedSubmission(submission);
    setForm(formFromSubmission(submission));
    setPreviewMode('structured');
    setMessage('');
    setError('');
  };

  const closeSubmission = () => {
    setSelectedSubmission(null);
    setForm(null);
    setMessage('');
    setError('');
  };

  const updateField = <K extends keyof ReviewForm>(key: K, value: ReviewForm[K]) => {
    setForm((current) => current ? { ...current, [key]: value } : current);
    setMessage('');
    setError('');
  };

  const updateScore = (key: keyof SolutionScores, value: number) => {
    setForm((current) => current ? {
      ...current,
      scores: { ...current.scores, [key]: normalizeScore(value, current.scores[key]) },
    } : current);
    setMessage('');
    setError('');
  };

  const convertMathFields = () => {
    setForm((current) => current ? {
      ...current,
      origin: convertPlainMathTextToLatex(current.origin),
      keyTransform: convertPlainMathTextToLatex(current.keyTransform),
      process: convertPlainMathTextToLatex(current.process),
      inspiration: convertPlainMathTextToLatex(current.inspiration),
      transferValue: convertPlainMathTextToLatex(current.transferValue),
      tradeoffs: convertPlainMathTextToLatex(current.tradeoffs),
      pitfalls: convertPlainMathTextToLatex(current.pitfalls),
      verifiableSteps: convertPlainMathTextToLatex(current.verifiableSteps),
      scoringReason: convertPlainMathTextToLatex(current.scoringReason),
      moderatorNotes: convertPlainMathTextToLatex(current.moderatorNotes),
    } : current);
    setMessage('已把常见数学写法转成 LaTeX 片段，请快速检查一次。');
    setError('');
  };

  const saveReview = async (nextStatus?: SubmissionStatus) => {
    if (!selectedSubmission || !form) return;
    if (nextStatus && !form.moderatorNotes.trim()) {
      setError('请先填写审核评语，再给出通过、退回或拒绝结论。');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const nextContent = contentFromForm(selectedSubmission, form);
    const patch = {
      title: form.title,
      kind: form.kind,
      content: nextContent,
      moderator_notes: form.moderatorNotes.trim() || null,
      ...(nextStatus ? { status: nextStatus } : {}),
    };

    const { data, error: updateError } = await supabase
      .from('submissions')
      .update(patch)
      .eq('id', selectedSubmission.id)
      .select('*');

    setSaving(false);

    if (updateError) {
      setError(updateError.message || '保存失败，请稍后再试。');
      return;
    }

    if (!data || data.length === 0) {
      setError('保存没有更新到任何投稿。请确认当前账号仍有管理员权限，或在 Supabase 中补齐 submissions 的 UPDATE RLS policy。');
      await loadSubmissions();
      return;
    }

    const updated = data[0] as Submission;
    setSelectedSubmission(updated);
    setForm(formFromSubmission(updated));
    setSubmissions((current) => current.map((item) => item.id === updated.id ? updated : item));

    if (nextStatus === 'approved' && !updated.contest_slug) {
      const publishResult = await publishSubmission(selectedSubmission.id);
      if (!publishResult.success) {
        setMessage('审核结论已保存，但发布到题库时出错：' + (publishResult.error ?? '未知错误'));
      } else {
        setMessage('审核通过，已发布到题库。');
      }
    } else if (nextStatus === 'approved' && updated.contest_slug) {
      setMessage('比赛投稿已通过，已进入比赛思路专区；暂不自动发布为正式题解。');
    } else {
      setMessage(nextStatus ? '审核结论和评语已保存。' : '修改已保存。');
    }

    await loadSubmissions();
  };

  const publishExisting = async (submissionId: string) => {
    setPublishing(submissionId);
    try {
      const result = await publishSubmission(submissionId);
      if (!result.success) {
        alert('发布失败：' + (result.error ?? '未知错误'));
      } else {
        alert('已成功发布到题库。');
      }
    } catch (error) {
      console.error('Publish error:', error);
      alert('发布时发生异常：' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setPublishing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'border-amber-400/30 bg-amber-400/[0.06] text-amber-300',
      approved: 'border-emerald-400/30 bg-emerald-400/[0.06] text-emerald-300',
      rejected: 'border-red-400/30 bg-red-400/[0.06] text-red-300',
      needs_revision: 'border-cyan-400/30 bg-cyan-400/[0.06] text-cyan-300',
    };
    const labels = { pending: '待审核', approved: '已通过', rejected: '已拒绝', needs_revision: '需修改' };
    return (
      <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-bold ${styles[status as keyof typeof styles]}`}>
        {status === 'pending' && <Clock className="size-3" />}
        {status === 'approved' && <CheckCircle2 className="size-3" />}
        {status === 'rejected' && <XCircle className="size-3" />}
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const getTypeLabel = (submission: Submission) => submission.submission_type === 'problem' ? '题目投稿' : '解法投稿';
  const getScopeLabel = (submission: Submission) => {
    if (!submission.contest_slug) return '普通投稿';
    const type = submission.contest_solution_type ? contestSolutionTypeMeta[submission.contest_solution_type]?.label : '参赛解法';
    return `${submission.is_post_contest ? '赛后补充' : '比赛投稿'} · ${type}`;
  };
  const getTargetLabel = (submission: Submission) => {
    if (submission.submission_type === 'problem') return submission.problem_source ?? '新题';
    return submission.problem_source ? `${submission.problem_source} · ${submission.problem_id ?? '未绑定题目'}` : submission.problem_id ?? '未绑定题目';
  };

  const currentMarkdown = useMemo(() => {
    if (!selectedSubmission || !form) return '';
    return buildMarkdown(selectedSubmission, form);
  }, [selectedSubmission, form]);
  const visibleSubmissions = useMemo(() => {
    let result = submissions;
    if (scopeFilter === 'regular') result = result.filter((s) => !s.contest_slug);
    else if (scopeFilter === 'contest') result = result.filter((s) => Boolean(s.contest_slug));
    if (contestParam && scopeFilter === 'contest') {
      result = result.filter((s) => s.contest_slug === contestParam);
    }
    return result;
  }, [scopeFilter, submissions, contestParam]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-16">
        <div className="mx-auto max-w-6xl animate-pulse">
          <div className="mb-8 h-8 w-48 rounded bg-white/5" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded bg-white/5" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">投稿审核</h1>
            <p className="mt-2 text-sm text-zinc-500">先修改内容，再写审核评语，最后给出通过、退回或拒绝结论。</p>
            <a href="/admin/contests" className="mt-3 inline-flex border border-white/10 px-3 py-1.5 text-xs font-bold text-zinc-300 transition hover:border-cyan-400/40 hover:text-cyan-200">
              管理比赛
            </a>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="text-zinc-500">
              待审核 <span className="font-bold text-amber-300">{submissions.filter((s) => s.status === 'pending').length}</span>
            </span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-500">
              总计 <span className="font-bold text-white">{submissions.length}</span>
            </span>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-2 border border-white/10 bg-black/20 p-2">
          {[
            ['all', '全部投稿'],
            ['regular', '普通投稿'],
            ['contest', '比赛投稿'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setScopeFilter(value as typeof scopeFilter)}
              className={`h-9 border px-3 text-xs font-bold transition ${
                scopeFilter === value
                  ? 'border-cyan-400 bg-cyan-400 text-zinc-950'
                  : 'border-white/10 text-zinc-400 hover:border-cyan-400/30 hover:text-cyan-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {visibleSubmissions.map((sub) => (
            <div key={sub.id} className="rounded border border-white/10 bg-white/[0.02] p-5 transition hover:bg-white/[0.04]">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    {getStatusBadge(sub.status)}
                    <span className={`rounded border px-2 py-1 text-xs font-bold ${sub.contest_slug ? 'border-amber-400/30 bg-amber-400/[0.06] text-amber-300' : 'border-white/10 text-zinc-500'}`}>
                      {getScopeLabel(sub)}
                    </span>
                    <span className="text-xs text-zinc-600">{new Date(sub.created_at).toLocaleDateString('zh-CN')}</span>
                    {sub.moderator_notes && <span className="rounded border border-white/10 px-2 py-1 text-xs text-zinc-500">已有评语</span>}
                  </div>
                  <h3 className="truncate font-bold text-white">{sub.title}</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    {getTypeLabel(sub)} · {getTargetLabel(sub)} · 类型: {kindLabels[sub.kind] ?? sub.kind}
                    {sub.contest_slug && ` · ${sub.contest_slug}${sub.contest_problem_key ? ` / ${sub.contest_problem_key}` : ''}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {sub.status === 'approved' && !sub.contest_slug && (
                    <button
                      type="button"
                      onClick={() => publishExisting(sub.id)}
                      disabled={publishing === sub.id}
                      className="inline-flex h-9 items-center gap-2 rounded border border-emerald-400/30 px-4 text-sm text-emerald-300 transition hover:bg-emerald-400/10 disabled:opacity-50"
                    >
                      <CheckCircle2 className="size-4" />
                      {publishing === sub.id ? '发布中...' : '发布到题库'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openSubmission(sub)}
                    className="inline-flex h-9 items-center gap-2 rounded border border-white/10 px-4 text-sm text-zinc-400 transition hover:border-cyan-400/50 hover:text-cyan-400"
                  >
                    <Eye className="size-4" />
                    审核编辑
                  </button>
                </div>
              </div>
            </div>
          ))}

          {visibleSubmissions.length === 0 && (
            <div className="rounded border border-white/10 bg-white/[0.02] p-12 text-center">
              <p className="text-zinc-500">暂无投稿</p>
            </div>
          )}
        </div>

        {selectedSubmission && form && (
          <div className="fixed inset-0 z-50 bg-black/80 p-4">
            <div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded border border-white/10 bg-zinc-950">
              <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-2">
                    {getStatusBadge(selectedSubmission.status)}
                    <span className={`rounded border px-2 py-1 text-xs font-bold ${selectedSubmission.contest_slug ? 'border-amber-400/30 bg-amber-400/[0.06] text-amber-300' : 'border-white/10 text-zinc-500'}`}>
                      {getScopeLabel(selectedSubmission)}
                    </span>
                    <span className="text-xs text-zinc-600">{new Date(selectedSubmission.created_at).toLocaleString('zh-CN')}</span>
                  </div>
                  <h2 className="truncate text-xl font-black text-white">{form.title || selectedSubmission.title}</h2>
                  <p className="mt-1 text-sm text-zinc-500">{getTypeLabel(selectedSubmission)} · {getTargetLabel(selectedSubmission)}</p>
                </div>
                <button
                  type="button"
                  onClick={closeSubmission}
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded border border-white/10 text-zinc-400 transition hover:border-white/30 hover:text-white"
                  aria-label="关闭"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="min-h-0 overflow-auto p-5">
                  <div className="mb-5 inline-flex rounded border border-white/10 bg-black/20 p-1">
                    {[
                      ['structured', FileText, '图形化编辑'],
                      ['card', Eye, '真实卡片'],
                      ['markdown', MessageSquareText, 'Markdown 预览'],
                    ].map(([value, Icon, label]) => {
                      const TabIcon = Icon as typeof FileText;
                      const active = previewMode === value;
                      return (
                        <button
                          key={value as string}
                          type="button"
                          onClick={() => setPreviewMode(value as typeof previewMode)}
                          className={`inline-flex h-9 items-center gap-2 rounded px-3 text-xs font-bold transition ${
                            active ? 'bg-cyan-400 text-zinc-950' : 'text-zinc-400 hover:text-white'
                          }`}
                        >
                          <TabIcon className="size-3.5" />
                          {label as string}
                        </button>
                      );
                    })}
                  </div>

                  {previewMode === 'structured' ? (
                    <div className="space-y-5">
                      <section className="grid gap-4 md:grid-cols-2">
                        <TextField label="解法标题" value={form.title} onChange={(value) => updateField('title', value)} />
                        <label className="grid gap-2 text-sm">
                          <span className="font-bold text-white">解法类型</span>
                          <select
                            value={form.kind}
                            onChange={(event) => updateField('kind', event.target.value as SolutionKind)}
                            className="h-11 rounded border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-cyan-400/60"
                          >
                            {Object.entries(kindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </label>
                        <div className="md:col-span-2">
                          <TextField label="解法标签" value={form.tags} onChange={(value) => updateField('tags', value)} placeholder="导数、切线、不等式" />
                        </div>
                      </section>

                      <section className="grid gap-4 md:grid-cols-2">
                        <TextArea label="思路来源" value={form.origin} onChange={(value) => updateField('origin', value)} rows={5} />
                        <TextArea label="关键转化" value={form.keyTransform} onChange={(value) => updateField('keyTransform', value)} rows={5} />
                        <TextArea label="启发点" value={form.inspiration} onChange={(value) => updateField('inspiration', value)} rows={5} />
                        <TextArea label="迁移价值" value={form.transferValue} onChange={(value) => updateField('transferValue', value)} rows={5} />
                      </section>

                        <TextArea label="完整过程" value={form.process} onChange={(value) => updateField('process', value)} rows={12} />

                      {selectedSubmission.attachment_urls && selectedSubmission.attachment_urls.length > 0 && (
                        <section className="rounded border border-white/10 bg-black/20 p-4">
                          <h3 className="text-sm font-bold text-white">投稿图片</h3>
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            {selectedSubmission.attachment_urls.map((url) => (
                              <a key={url} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded border border-white/10 bg-zinc-950">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt="投稿图片" className="max-h-80 w-full object-contain" />
                              </a>
                            ))}
                          </div>
                        </section>
                      )}

                      <section className="grid gap-4 md:grid-cols-3">
                        <TextArea label="适用场景" value={form.suitableFor} onChange={(value) => updateField('suitableFor', value)} rows={5} />
                        <TextArea label="代价与局限" value={form.tradeoffs} onChange={(value) => updateField('tradeoffs', value)} rows={5} />
                        <TextArea label="易错点" value={form.pitfalls} onChange={(value) => updateField('pitfalls', value)} rows={5} />
                      </section>

                      <TextArea label="可验证步骤" value={form.verifiableSteps} onChange={(value) => updateField('verifiableSteps', value)} rows={4} />

                      <section className="space-y-4 rounded border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center gap-2">
                          <SlidersHorizontal className="size-4 text-cyan-300" />
                          <h3 className="text-sm font-bold text-white">五维评分</h3>
                          <span className="text-xs text-zinc-600">支持一位小数</span>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          {scoreLabels.map(([key, label, description], index) => (
                            <div key={key} className="rounded border border-white/10 bg-zinc-950 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-bold text-white">{label}</p>
                                  <p className="mt-1 text-xs text-zinc-600">{description}</p>
                                </div>
                                <strong className="font-display text-2xl text-cyan-300">{form.scores[key].toFixed(1)}</strong>
                              </div>
                              <input
                                type="range"
                                min="1"
                                max="10"
                                step="0.1"
                                value={form.scores[key]}
                                onChange={(event) => updateScore(key, Number(event.target.value))}
                                className="mt-4 w-full accent-cyan-400"
                              />
                              <div className="mt-3">
                                <ScoreBar label={label} value={form.scores[key]} tone={index === 1 ? 'red' : index === 2 ? 'amber' : 'cyan'} />
                              </div>
                            </div>
                          ))}
                        </div>
                        <TextArea label="评分理由" value={form.scoringReason} onChange={(value) => updateField('scoringReason', value)} rows={5} />
                      </section>
                    </div>
                  ) : previewMode === 'card' ? (
                    <ReviewCardPreview submission={selectedSubmission} form={form} />
                  ) : (
                    <pre className="max-h-full overflow-auto rounded border border-white/10 bg-black/20 p-4 text-xs leading-6 text-zinc-300">
                      <code>{currentMarkdown}</code>
                    </pre>
                  )}
                </div>

                <aside className="min-h-0 overflow-auto border-t border-white/10 p-5 lg:border-l lg:border-t-0">
                  <div className="space-y-5">
                    <TextArea
                      label="审核评语"
                      value={form.moderatorNotes}
                      onChange={(value) => updateField('moderatorNotes', value)}
                      rows={8}
                      placeholder="说明通过理由、需要修改的位置，或拒绝原因。审核结论必须带评语。"
                    />

                    <button
                      type="button"
                      onClick={convertMathFields}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-amber-400/30 text-sm font-bold text-amber-300 transition hover:bg-amber-400/10"
                    >
                      自动转码公式
                    </button>

                    {message && <p className="rounded border border-emerald-400/30 bg-emerald-400/[0.06] px-3 py-2 text-sm text-emerald-300">{message}</p>}
                    {error && <p className="rounded border border-red-400/30 bg-red-400/[0.06] px-3 py-2 text-sm text-red-300">{error}</p>}

                    <button
                      type="button"
                      onClick={() => saveReview()}
                      disabled={saving}
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded border border-white/10 text-sm font-bold text-zinc-300 transition hover:border-cyan-400/40 hover:text-cyan-200 disabled:opacity-50"
                    >
                      <Save className="size-4" />
                      {saving ? '保存中...' : '保存修改'}
                    </button>

                    <div className="space-y-3 border-t border-white/10 pt-5">
                      <button
                        type="button"
                        onClick={() => saveReview('approved')}
                        disabled={saving}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded bg-emerald-400 text-sm font-bold text-zinc-950 transition hover:bg-emerald-300 disabled:opacity-50"
                      >
                        <CheckCircle2 className="size-4" />
                        保存并通过
                      </button>
                      <button
                        type="button"
                        onClick={() => saveReview('needs_revision')}
                        disabled={saving}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded border border-cyan-400/30 text-sm font-bold text-cyan-300 transition hover:bg-cyan-400/10 disabled:opacity-50"
                      >
                        <Check className="size-4" />
                        保存并要求修改
                      </button>
                      <button
                        type="button"
                        onClick={() => saveReview('rejected')}
                        disabled={saving}
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded border border-red-400/30 text-sm font-bold text-red-400 transition hover:bg-red-400/10 disabled:opacity-50"
                      >
                        <XCircle className="size-4" />
                        保存并拒绝
                      </button>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function scoreTone(index: number) {
  return index === 1 ? 'red' : index === 2 ? 'amber' : 'cyan';
}

function ReviewCardPreview({ submission, form }: { submission: Submission; form: ReviewForm }) {
  const [expanded, setExpanded] = useState(true);
  const meta = getSolutionKindMeta(form.kind);
  const tags = splitList(form.tags);
  const processSteps = splitProcess(form.process);
  const suitableFor = splitList(form.suitableFor);
  const tradeoffs = splitList(form.tradeoffs);
  const pitfalls = splitList(form.pitfalls);
  const verifiableSteps = splitList(form.verifiableSteps);
  const target = submission.problem_source
    ? `${submission.problem_source}${submission.problem_id ? ` · ${submission.problem_id}` : ''}`
    : submission.problem_id ?? '未绑定题目';

  return (
    <article className="overflow-hidden rounded border border-white/10 bg-zinc-950">
      <div className="border-b border-white/10 bg-black/20 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">审核真实卡片预览</p>
            <p className="mt-1 text-sm font-bold text-zinc-300">{target}</p>
          </div>
          <span className="rounded border border-cyan-400/30 bg-cyan-400/5 px-3 py-1.5 text-xs font-bold text-cyan-200">
            按当前编辑内容实时渲染
          </span>
        </div>
      </div>

      <div className="grid gap-px bg-white/10 lg:grid-cols-[1fr_18rem]">
        <div className="bg-zinc-950 p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-zinc-600">审核稿</span>
            <span className={`border px-2.5 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span>
            <span className="text-xs text-zinc-600">{meta.description}</span>
            {tags.length ? tags.map((tag) => (
              <span key={tag} className="border border-white/10 px-2 py-1 text-xs text-zinc-500">
                {tag}
              </span>
            )) : (
              <span className="border border-white/10 px-2 py-1 text-xs text-zinc-600">待补标签</span>
            )}
          </div>
          <h3 className="mt-4 text-xl font-bold text-white">{form.title || '未命名解法'}</h3>
          <p className="mt-2 text-sm text-zinc-500">投稿内容 <span className="mx-2 text-zinc-700">/</span> {meta.label}</p>
          <p className="mt-4 text-sm leading-7 text-zinc-300">
            <MathBlock>{form.inspiration || '这里会展示这条解法最值得学习的观察。'}</MathBlock>
          </p>
        </div>

        <div className="flex flex-col justify-between bg-zinc-950 p-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
              <Lightbulb className="size-4" />
              核心转化
            </div>
            <p className="mt-3 line-clamp-5 text-sm leading-7 text-zinc-400">
              <MathBlock>{form.keyTransform || '这里会展示真正改变问题形态的关键一步。'}</MathBlock>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded border border-cyan-400/35 bg-cyan-400/5 px-4 text-sm font-bold text-cyan-200 transition hover:bg-cyan-400/10"
          >
            {expanded ? '收起解析' : '展开查看'}
            <ChevronDown className={`size-4 transition ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/10 p-5 md:p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
            <div className="space-y-5">
              <section className="rounded border border-cyan-400/20 bg-cyan-400/[0.04] p-4">
                <h4 className="flex items-center gap-2 text-sm font-bold text-white">
                  <Route className="size-4 text-cyan-300" />
                  为什么会想到
                </h4>
                <p className="mt-3 text-sm leading-7 text-zinc-300">
                  <MathBlock>{form.origin || '这里会展示你从题目条件中识别出的入口。'}</MathBlock>
                </p>
              </section>

              <section className="rounded border border-white/10 bg-black/20 p-4">
                <h4 className="flex items-center gap-2 text-sm font-bold text-white">
                  <ListChecks className="size-4 text-amber-300" />
                  完整解析摘要
                </h4>
                {processSteps.length ? (
                  <ol className="mt-4 space-y-4">
                    {processSteps.map((step, index) => (
                      <li key={`${step}-${index}`} className="grid grid-cols-[2rem_1fr] gap-3 text-sm leading-7 text-zinc-300">
                        <span className="font-mono text-cyan-300">{String(index + 1).padStart(2, '0')}</span>
                        <span><MathBlock>{step}</MathBlock></span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-sm leading-7 text-zinc-600">完整步骤会在这里按条展示。</p>
                )}
              </section>

              <section className="rounded border border-white/10 bg-black/20 p-4">
                <h4 className="text-sm font-bold text-white">解法画像</h4>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <ReviewPreviewBlock title="迁移价值" value={form.transferValue || '这条观察可以迁移到哪些题型，会显示在这里。'} />
                  <ReviewPreviewList title="适合场景" tone="emerald" items={suitableFor} emptyText="考场拿分、复盘训练、课堂讲解" />
                  <ReviewPreviewList title="代价与局限" tone="red" items={tradeoffs} emptyText="计算量、入口难度、适用限制会显示在这里" />
                  <ReviewPreviewList title="易错点" tone="red" items={pitfalls} emptyText="定义域、分类讨论、取等条件等风险会显示在这里" />
                </div>
              </section>

              {form.moderatorNotes.trim() && (
                <section className="rounded border border-amber-400/20 bg-amber-400/[0.04] p-4">
                  <h4 className="text-sm font-bold text-white">审核评语</h4>
                  <p className="mt-3 text-sm leading-7 text-zinc-300">
                    <MathBlock>{form.moderatorNotes}</MathBlock>
                  </p>
                </section>
              )}
            </div>

            <aside className="space-y-5">
              <section className="rounded border border-white/10 bg-black/20">
                <div className="border-b border-white/10 px-4 py-3">
                  <h4 className="text-sm font-bold text-white">评分细节</h4>
                </div>
                <div className="space-y-3 p-4">
                  {scoreLabels.map(([key, label], index) => (
                    <ScoreBar key={key} label={label} value={form.scores[key]} tone={scoreTone(index)} />
                  ))}
                  <p className="pt-2 text-xs leading-6 text-zinc-500">
                    <MathBlock>{form.scoringReason || '评分理由会在这里解释这条解法的取舍。'}</MathBlock>
                  </p>
                </div>
              </section>

              <section className="rounded border border-emerald-400/20 bg-emerald-400/[0.035] p-4">
                <h4 className="text-sm font-bold text-white">可验证步骤</h4>
                {verifiableSteps.length ? (
                  <ul className="mt-3 space-y-2">
                    {verifiableSteps.map((item) => (
                      <li key={item} className="border-l border-emerald-400/40 pl-3 text-xs leading-6 text-zinc-300">
                        <MathBlock>{item}</MathBlock>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs leading-6 text-zinc-600">可代入、作图或数值复核的位置会显示在这里。</p>
                )}
              </section>
            </aside>
          </div>
        </div>
      )}
    </article>
  );
}

function ReviewPreviewBlock({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <h5 className="text-xs font-bold text-amber-300">{title}</h5>
      <p className="mt-2 text-sm leading-7 text-zinc-300">
        <MathBlock>{value}</MathBlock>
      </p>
    </div>
  );
}

function ReviewPreviewList({
  title,
  items,
  emptyText,
  tone,
}: {
  title: string;
  items: string[];
  emptyText: string;
  tone: 'emerald' | 'red';
}) {
  const titleClass = tone === 'emerald' ? 'text-emerald-300' : 'text-red-300';
  const chipClass = tone === 'emerald'
    ? 'border-emerald-400/20 bg-emerald-400/5'
    : 'border-red-400/20 bg-red-400/5';

  return (
    <div>
      <h5 className={`text-xs font-bold ${titleClass}`}>{title}</h5>
      {items.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className={`border px-2.5 py-1.5 text-xs text-zinc-300 ${chipClass}`}>
              <MathBlock>{item}</MathBlock>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm leading-6 text-zinc-600">{emptyText}</p>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-bold text-white">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 rounded border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-400/60"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-bold text-white">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="resize-y rounded border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-400/60"
      />
    </label>
  );
}
