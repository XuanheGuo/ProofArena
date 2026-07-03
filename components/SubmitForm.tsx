'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, FilePlus2, Lightbulb, LogIn, Send } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-client';

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
  approach: '',
  keyTransform: '',
  steps: '',
  insight: '',
  verification: '',
};

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

function buildSolutionMarkdown(form: typeof initialSolutionForm, problem?: ProblemOption) {
  return `# 解法投稿：${form.title}

## 对应题目
${problem ? `${problem.source} · ${problem.title}` : form.problemId}

## 类型
${KINDS.find((kind) => kind.value === form.kind)?.label ?? form.kind}

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

export function SubmitForm({ problems }: { problems: ProblemOption[] }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<SubmitMode>('solution');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<SubmitMode | null>(null);
  const [error, setError] = useState('');
  const [problemForm, setProblemForm] = useState(initialProblemForm);
  const [solutionForm, setSolutionForm] = useState({
    ...initialSolutionForm,
    problemId: problems[0]?.id ?? '',
  });
  const supabase = createClient();

  const selectedProblem = useMemo(
    () => problems.find((problem) => problem.id === solutionForm.problemId),
    [problems, solutionForm.problemId]
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });
  }, [supabase]);

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
    const markdown = buildSolutionMarkdown(solutionForm, selectedProblem);
    return supabase.from('submissions').insert({
      submission_type: 'solution',
      problem_id: solutionForm.problemId,
      problem_source: selectedProblem?.source,
      user_id: user?.id,
      kind: solutionForm.kind,
      title: solutionForm.title,
      content: {
        markdown,
        approach: solutionForm.approach,
        keyTransform: solutionForm.keyTransform,
        steps: solutionForm.steps,
        insight: solutionForm.insight,
        verification: solutionForm.verification,
      },
      status: 'pending',
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;

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
      setSolutionForm({ ...initialSolutionForm, problemId: problems[0]?.id ?? '' });
    }
  }

  if (loading) {
    return <div className="h-56 animate-pulse rounded bg-white/5" />;
  }

  if (!user) {
    return (
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
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      {done && (
        <div className="rounded border border-emerald-400/30 bg-emerald-400/[0.06] p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
            <p className="text-sm leading-6 text-zinc-300">
              已提交{done === 'problem' ? '题目' : '解法'}，感谢你的贡献。管理员审核后会整理到正式题库。
            </p>
          </div>
        </div>
      )}

      {mode === 'solution' ? (
        <div className="space-y-5">
          <label className="grid gap-2 text-sm">
            <span className="font-bold text-white">选择对应题目</span>
            <select
              required
              value={solutionForm.problemId}
              onChange={(event) => setSolutionForm({ ...solutionForm, problemId: event.target.value })}
              className="h-11 rounded border border-white/10 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-cyan-400/50"
            >
              {problems.map((problem) => (
                <option key={problem.id} value={problem.id}>{problem.source} · {problem.title}</option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 xl:grid-cols-2">
            <TextField required label="解法标题" value={solutionForm.title} onChange={(title) => setSolutionForm({ ...solutionForm, title })} placeholder="例如：差函数导数法" />
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
          </div>
          <TextArea required label="思路来源" value={solutionForm.approach} onChange={(approach) => setSolutionForm({ ...solutionForm, approach })} rows={4} placeholder="为什么会想到这条路线？" />
          <TextArea label="关键转化" value={solutionForm.keyTransform} onChange={(keyTransform) => setSolutionForm({ ...solutionForm, keyTransform })} rows={3} placeholder="真正改变问题形态的一步" />
          <TextArea required label="完整步骤" value={solutionForm.steps} onChange={(steps) => setSolutionForm({ ...solutionForm, steps })} rows={8} placeholder="写出能独立复算的推理链" />
          <div className="grid gap-4 xl:grid-cols-2">
            <TextArea label="最值得学的地方" value={solutionForm.insight} onChange={(insight) => setSolutionForm({ ...solutionForm, insight })} rows={4} />
            <TextArea label="可验证位置" value={solutionForm.verification} onChange={(verification) => setSolutionForm({ ...solutionForm, verification })} rows={4} />
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
          disabled={submitting || (mode === 'solution' && problems.length === 0)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded bg-cyan-400 px-8 text-sm font-bold text-zinc-950 transition hover:bg-cyan-300 disabled:opacity-50"
        >
          <Send className="size-4" />
          {submitting ? '提交中...' : mode === 'problem' ? '提交题目' : '提交解法'}
        </button>
        <p className="text-xs leading-5 text-zinc-600">
          {mode === 'problem' ? '题目审核通过后会进入题库，再继续收集多种解法。' : '解法会绑定到所选题目，审核通过后进入对比视图。'}
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
