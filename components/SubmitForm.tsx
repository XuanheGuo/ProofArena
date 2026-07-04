'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, FilePlus2, Lightbulb, LogIn, Send } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-client';
import { contestSolutionTypeMeta, contestSolutionTypeOptions } from '@/lib/contest-meta';
import type { Contest, ContestProblem, ContestSolutionType } from '@/lib/types';

type ProblemOption = {
  id: string;
  title: string;
  source: string;
};

type SubmitMode = 'problem' | 'solution';
type SolutionKind = 'standard' | 'insight' | 'robust' | 'teaching';

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
};

function mapContestTypeToKind(type: ContestSolutionType): SolutionKind {
  if (type === 'standard') return 'standard';
  if (type === 'teaching' || type === 'wrong_analysis' || type === 'supplement') return 'teaching';
  if (type === 'geometry' || type === 'algebra' || type === 'construction') return 'robust';
  return 'insight';
}

function getContestSubmissionState(contest?: Contest, now = Date.now()) {
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
  return `# 题目投稿：${form.title}

## 来源
${form.source}

## 题干
${form.statement}

## 答案
${form.answer || '（未填写）'}

## 标签
${toLines(form.tags).map((tag) => `- ${tag}`).join('\n') || '（未填写）'}

## 备注
${form.note || '（无）'}
`;
}

function buildSolutionMarkdown(
  form: typeof initialSolutionForm,
  problem?: ProblemOption,
  contestContext?: { contest: Contest; contestProblem?: ContestProblem }
) {
  return `# 解法投稿：${form.title}

## 对应题目
${problem ? `${problem.source} · ${problem.title}` : form.problemId}

## 类型
${KINDS.find((kind) => kind.value === form.kind)?.label ?? form.kind}

${contestContext ? `## 参赛信息
${contestContext.contest.title}${contestContext.contestProblem ? ` · Day ${contestContext.contestProblem.dayIndex} ${contestContext.contestProblem.title}` : ''}

## 参赛解法类型
${contestSolutionTypeMeta[form.contestSolutionType].label}
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

export function SubmitForm({
  problems,
  initialProblemId,
  contestContext,
}: {
  problems: ProblemOption[];
  initialProblemId?: string;
  contestContext?: {
    contest: Contest;
    contestProblem?: ContestProblem;
  };
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
  const [mode, setMode] = useState<SubmitMode>('solution');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<SubmitMode | null>(null);
  const [error, setError] = useState('');
  const [problemForm, setProblemForm] = useState(initialProblemForm);
  const [solutionForm, setSolutionForm] = useState({
    ...initialSolutionForm,
    problemId: initialSelectedProblemId,
  });
  const supabase = createClient();

  const selectedProblem = useMemo(
    () => availableProblems.find((problem) => problem.id === solutionForm.problemId),
    [availableProblems, solutionForm.problemId]
  );
  const selectedContestProblem = useMemo(
    () => contestContext?.contest.problems.find((problem) => problem.problemId === solutionForm.problemId) ?? contestContext?.contestProblem,
    [contestContext, solutionForm.problemId]
  );
  const activeContestContext = contestContext
    ? {
        contest: contestContext.contest,
        contestProblem: selectedContestProblem,
      }
    : undefined;
  const contestSubmissionState = getContestSubmissionState(activeContestContext?.contest, now);

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

  async function submitProblem() {
    const markdown = buildProblemMarkdown(problemForm);
    return supabase.from('submissions').insert({
      submission_type: 'problem',
      problem_id: null,
      problem_source: problemForm.source,
      user_id: user?.id,
      kind: 'standard',
      title: problemForm.title,
      content: {
        markdown,
        source: problemForm.source,
        statement: problemForm.statement,
        answer: problemForm.answer,
        tags: toLines(problemForm.tags),
        note: problemForm.note,
      },
      status: 'pending',
    });
  }

  async function submitSolution() {
    if (activeContestContext && !contestSubmissionState.canSubmit) {
      return { error: { message: contestSubmissionState.description } };
    }

    const normalizedTitle = solutionForm.title.trim()
      || (activeContestContext?.contestProblem
        ? `${contestSolutionTypeMeta[solutionForm.contestSolutionType].label}：${activeContestContext.contestProblem.title}`
        : `${contestSolutionTypeMeta[solutionForm.contestSolutionType].label}投稿`);
    const normalizedForm = { ...solutionForm, title: normalizedTitle };
    const markdown = buildSolutionMarkdown(normalizedForm, selectedProblem, activeContestContext);
    const isPostContest = activeContestContext ? contestSubmissionState.isPostContest : false;
    return supabase.from('submissions').insert({
      submission_type: 'solution',
      problem_id: solutionForm.problemId,
      problem_source: selectedProblem?.source,
      user_id: user?.id,
      kind: normalizedForm.kind,
      title: normalizedTitle,
      contest_slug: activeContestContext?.contest.slug,
      contest_problem_key: activeContestContext?.contestProblem?.id,
      contest_solution_type: activeContestContext ? solutionForm.contestSolutionType : null,
      is_post_contest: isPostContest,
      content: {
        markdown,
        contest: activeContestContext
          ? {
              slug: activeContestContext.contest.slug,
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

    const { error: submitError } = mode === 'problem' ? await submitProblem() : await submitSolution();

    setSubmitting(false);
    if (submitError) {
      setError(submitError.message || '提交失败，请稍后再试。');
      return;
    }

    setDone(mode);
    if (mode === 'problem') {
      setProblemForm(initialProblemForm);
    } else {
      setSolutionForm({
        ...initialSolutionForm,
        problemId: initialSelectedProblemId,
      });
    }
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
    <form onSubmit={handleSubmit} className="space-y-5">
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
          <p className="text-sm leading-6 text-zinc-300">
            已提交{done === 'problem' ? '题目' : '解法'}，感谢贡献。管理员审核后会进入正式题库。
          </p>
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
          <label className="grid gap-2 text-sm">
            <span className="font-bold text-white">选择对应题目</span>
            <select
              required
              value={solutionForm.problemId}
              onChange={(event) => setSolutionForm({ ...solutionForm, problemId: event.target.value })}
              className="h-11 rounded border border-white/10 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-cyan-400/50"
            >
              {availableProblems.map((problem) => (
                <option key={problem.id} value={problem.id}>{problem.source} · {problem.title}</option>
              ))}
            </select>
            {isContestMode && (
              <span className="text-xs leading-5 text-zinc-600">比赛投稿只能选择本场比赛关联的题目。</span>
            )}
          </label>

          <div className="grid gap-4 xl:grid-cols-2">
            <TextField
              required={!isContestMode}
              label={isContestMode ? "标题（可选）" : "解法标题"}
              value={solutionForm.title}
              onChange={(title) => setSolutionForm({ ...solutionForm, title })}
              placeholder={isContestMode ? "不填也可以，系统会按类型生成标题" : "例如：差函数导数法"}
            />
            {contestContext ? (
              <label className="grid gap-2 text-sm">
                <span className="font-bold text-white">参赛解法类型</span>
                <select
                  value={solutionForm.contestSolutionType}
                  onChange={(event) => {
                    const contestSolutionType = event.target.value as ContestSolutionType;
                    setSolutionForm({
                      ...solutionForm,
                      contestSolutionType,
                      kind: mapContestTypeToKind(contestSolutionType),
                    });
                  }}
                  className="h-11 rounded border border-white/10 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-cyan-400/50"
                >
                  {contestSolutionTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="grid gap-2 text-sm">
                <span className="font-bold text-white">解法类型</span>
                <select
                  value={solutionForm.kind}
                  onChange={(event) => setSolutionForm({ ...solutionForm, kind: event.target.value as SolutionKind })}
                  className="h-11 rounded border border-white/10 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-cyan-400/50"
                >
                  {KINDS.map((kind) => <option key={kind.value} value={kind.value}>{kind.label}</option>)}
                </select>
              </label>
            )}
          </div>
          <TextArea
            required
            label={isContestMode ? "你的思路 / 感觉" : "思路来源"}
            value={solutionForm.approach}
            onChange={(approach) => setSolutionForm({ ...solutionForm, approach })}
            rows={isContestMode ? 6 : 4}
            placeholder={isContestMode ? "可以很粗糙：我觉得这里像对称、像换元、像某个边界条件在起作用..." : "为什么会想到这条路线？"}
          />
          <TextArea
            label={isContestMode ? "关键观察（可选）" : "关键转化"}
            value={solutionForm.keyTransform}
            onChange={(keyTransform) => setSolutionForm({ ...solutionForm, keyTransform })}
            rows={3}
            placeholder={isContestMode ? "一句话写出最想让别人看到的点" : "真正改变问题形态的一步"}
          />
          <TextArea
            required={!isContestMode}
            label={isContestMode ? "推理草稿（可选）" : "完整步骤"}
            value={solutionForm.steps}
            onChange={(steps) => setSolutionForm({ ...solutionForm, steps })}
            rows={isContestMode ? 5 : 8}
            placeholder={isContestMode ? "还没想完整也没关系，可以先写片段、试算或卡住的位置。" : "写出能独立复算的推理链"}
          />
          <div className="grid gap-4 xl:grid-cols-2">
            <TextArea label={isContestMode ? "想让别人接着看的地方（可选）" : "最值得学的地方"} value={solutionForm.insight} onChange={(insight) => setSolutionForm({ ...solutionForm, insight })} rows={4} />
            <TextArea label={isContestMode ? "你不确定的地方（可选）" : "可验证位置"} value={solutionForm.verification} onChange={(verification) => setSolutionForm({ ...solutionForm, verification })} rows={4} />
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 xl:grid-cols-2">
            <TextField required label="题目来源" value={problemForm.source} onChange={(source) => setProblemForm({ ...problemForm, source })} placeholder="例如：2026 天津卷第 20 题" />
            <TextField required label="题目标题" value={problemForm.title} onChange={(title) => setProblemForm({ ...problemForm, title })} placeholder="用一句话概括题目主题" />
          </div>
          <TextArea required label="完整题干" value={problemForm.statement} onChange={(statement) => setProblemForm({ ...problemForm, statement })} rows={8} placeholder="支持 Markdown / LaTeX" />
          <div className="grid gap-4 xl:grid-cols-2">
            <TextArea label="标准答案" value={problemForm.answer} onChange={(answer) => setProblemForm({ ...problemForm, answer })} rows={4} />
            <TextArea label="标签" value={problemForm.tags} onChange={(tags) => setProblemForm({ ...problemForm, tags })} rows={4} placeholder="导数、圆锥曲线、数列" />
          </div>
          <TextArea label="补充说明" value={problemForm.note} onChange={(note) => setProblemForm({ ...problemForm, note })} rows={3} placeholder="来源链接、图片说明、你希望补充的审核信息" />
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
            ? '提交中...'
            : mode === 'problem'
              ? '提交题目'
              : contestContext
                ? contestSubmissionState.isPostContest ? '提交赛后补充' : '提交参赛解法'
                : '提交解法'}
        </button>
        <p className="text-xs leading-5 text-zinc-600">
          {mode === 'problem'
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
    <label className="grid gap-2 text-sm">
      <span className="font-bold text-white">{label} {required && <span className="text-red-400">*</span>}</span>
      <input
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 rounded border border-white/10 bg-white/5 px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-400/50"
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
    <label className="grid gap-2 text-sm">
      <span className="font-bold text-white">{label} {required && <span className="text-red-400">*</span>}</span>
      <textarea
        required={required}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="resize-y rounded border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-400/50"
      />
    </label>
  );
}
