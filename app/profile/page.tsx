'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { hasSupabasePublicEnv } from '@/lib/supabase-env';
import { MathBlock } from '@/components/MathBlock';
import { EditSubmissionForm, type EditableSubmission } from '@/components/EditSubmissionForm';
import { ProfileSettingsPanel } from '@/components/ProfileSettingsPanel';
import { getSubmissionFailureReasonLabel } from '@/lib/submission-meta';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Mail,
  Pencil,
  Swords,
  Trophy,
  User as UserIcon,
  XCircle,
} from 'lucide-react';

const SUBMISSIONS_SELECT = 'id, title, submission_type, problem_id, problem_source, kind, status, failure_reason, created_at, updated_at, moderator_notes, content, contest_id, contest_slug, attachment_urls, challenge_target_solution_id, challenge_claim, challenge_advantages, challenge_risk';

type Submission = EditableSubmission & {
  status: 'pending' | 'approved' | 'rejected' | 'needs_revision' | 'precheck_failed';
  created_at: string;
  updated_at: string;
  moderator_notes?: string | null;
  contest_id?: string | null;
  contest_slug?: string | null;
  failure_reason?: string | null;
};

type PublishedSolution = {
  id: string;
  problem_id: string;
  title: string;
  kind: string;
  author_role: string;
  scores?: Record<string, number>;
  challenge_target_solution_id?: string | null;
  challenge_target_solution_title?: string | null;
  challenge_target_solution_author?: string | null;
  challenge_claim?: string | null;
  challenge_advantages?: string[] | null;
  challenge_risk?: string | null;
  created_at: string;
  source_submission_id?: string | null;
};

type AppProfile = {
  username: string;
  display_name: string | null;
  bio: string | null;
};

function SubmissionProgress({ submission }: { submission: Submission }) {
  const { status, moderator_notes, failure_reason } = submission;

  // precheck_failed never enters human review — it was auto-flagged at
  // submit time (enforce_submission_screening,
  // 023_submission_rate_limit_enforcement.sql), so the normal
  // submitted -> reviewing -> result progress doesn't apply. Show a
  // distinct 2-step state with the failure reason instead.
  if (status === 'precheck_failed') {
    return (
      <div className="mt-4">
        <div className="flex items-center gap-0">
          <div className="flex items-center">
            <div className="flex flex-col items-center">
              <div className="flex size-7 items-center justify-center rounded-full border-2 border-cyan-400 bg-cyan-400 text-xs font-bold text-zinc-950">
                <CheckCircle2 className="size-4" />
              </div>
              <span className="mt-1.5 text-[10px] font-medium text-white whitespace-nowrap">已提交</span>
            </div>
            <div className="mb-5 h-px w-12 bg-cyan-400 sm:w-20" />
          </div>
          <div className="flex items-center">
            <div className="flex flex-col items-center">
              <div className="flex size-7 items-center justify-center rounded-full border-2 border-current text-amber-400">
                <AlertCircle className="size-4" />
              </div>
              <span className="mt-1.5 text-[10px] font-medium text-amber-400 whitespace-nowrap">预筛未通过</span>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3">
          <p className="text-xs font-bold text-amber-300">未进入人工审核</p>
          <p className="mt-1 text-sm text-zinc-300">{getSubmissionFailureReasonLabel(failure_reason)}，请修改后重新提交。</p>
        </div>
      </div>
    );
  }

  const steps = [
    { key: 'submitted', label: '已提交', done: true },
    {
      key: 'reviewing',
      label: status === 'pending' ? '等待审核' : '已审核',
      done: status !== 'pending',
      active: status === 'pending',
    },
    {
      key: 'result',
      label:
        status === 'approved'
          ? '审核通过'
          : status === 'rejected'
            ? '未通过'
            : status === 'needs_revision'
              ? '需要修改'
              : '结果',
      done: status !== 'pending',
    },
  ];

  const resultColor =
    status === 'approved'
      ? 'text-emerald-400'
      : status === 'rejected'
        ? 'text-red-400'
        : status === 'needs_revision'
          ? 'text-amber-400'
          : 'text-zinc-600';

  return (
    <div className="mt-4">
      <div className="flex items-center gap-0">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex size-7 items-center justify-center rounded-full border-2 text-xs font-bold transition
                  ${step.done && i === steps.length - 1
                    ? `border-current ${resultColor}`
                    : step.done
                      ? 'border-cyan-400 bg-cyan-400 text-zinc-950'
                      : step.active
                        ? 'border-amber-400 text-amber-400'
                        : 'border-white/20 text-zinc-600'
                  }`}
              >
                {step.done && i < steps.length - 1 ? (
                  <CheckCircle2 className="size-4" />
                ) : step.active ? (
                  <Clock className="size-3.5 animate-pulse" />
                ) : i === steps.length - 1 && status === 'approved' ? (
                  <CheckCircle2 className="size-4" />
                ) : i === steps.length - 1 && status === 'rejected' ? (
                  <XCircle className="size-4" />
                ) : i === steps.length - 1 && status === 'needs_revision' ? (
                  <AlertCircle className="size-4" />
                ) : (
                  String(i + 1)
                )}
              </div>
              <span className={`mt-1.5 text-[10px] font-medium whitespace-nowrap
                ${step.active ? 'text-amber-400' : step.done ? (i === steps.length - 1 ? resultColor : 'text-white') : 'text-zinc-600'}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`mb-5 h-px w-12 sm:w-20 ${step.done ? 'bg-cyan-400' : 'bg-white/10'}`} />
            )}
          </div>
        ))}
      </div>

      {moderator_notes && (
        <div className="mt-4 rounded border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3">
          <p className="text-xs font-bold text-amber-300">管理员反馈</p>
          <p className="mt-1 text-sm text-zinc-300">{moderator_notes}</p>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const communityEnabled = hasSupabasePublicEnv();
  const [user, setUser] = useState<User | null>(null);
  const [appProfile, setAppProfile] = useState<AppProfile | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [publishedSolutions, setPublishedSolutions] = useState<PublishedSolution[]>([]);
  const [loading, setLoading] = useState(communityEnabled);
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = communityEnabled ? createClient() : null;

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const client = supabase;

    client.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push('/auth/login');
        return;
      }
      setUser(data.user);

      const { data: profileData } = await client
        .from('user_profiles')
        .select('username, display_name, bio')
        .eq('id', data.user.id)
        .single();

      const { data: subs } = await client
        .from('submissions')
        .select(SUBMISSIONS_SELECT)
        .eq('user_id', data.user.id)
        .order('created_at', { ascending: false });

      const { data: solutions } = await client
        .from('solutions')
        .select('id, problem_id, title, kind, author_role, scores, challenge_target_solution_id, challenge_target_solution_title, challenge_target_solution_author, challenge_claim, challenge_advantages, challenge_risk, created_at, source_submission_id')
        .eq('author_id', data.user.id)
        .order('created_at', { ascending: false });

      setAppProfile((profileData as AppProfile) ?? null);
      setSubmissions((subs as Submission[]) ?? []);
      setPublishedSolutions((solutions as PublishedSolution[]) ?? []);
      setLoading(false);
    });
  }, [supabase, router]);

  function handleSubmissionRevised(updated: EditableSubmission) {
    setSubmissions((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
    setEditingSubmissionId(null);
  }

  if (!communityEnabled) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-16">
        <div className="mx-auto max-w-2xl border border-amber-400/25 bg-amber-400/[0.06] p-6 text-center">
          <h1 className="text-xl font-black text-white">社区数据库暂不可用</h1>
          <p className="mt-3 text-sm leading-6 text-amber-100">
            个人主页、投稿记录和公开作品集需要 Supabase。当前仍可浏览静态题库和解法。
          </p>
          <a href="/problems" className="mt-5 inline-block text-sm font-bold text-cyan-300 hover:text-cyan-200">
            返回题库
          </a>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-16">
        <div className="mx-auto max-w-2xl animate-pulse space-y-4">
          <div className="h-16 bg-white/5 rounded" />
          <div className="h-32 bg-white/5 rounded" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  const username = appProfile?.display_name || appProfile?.username || user.user_metadata?.username || '匿名用户';
  const publicUsername = appProfile?.username;
  const joinedAt = new Date(user.created_at).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const kindLabel: Record<string, string> = {
    standard: '标准解',
    insight: '启发解',
    robust: '稳健解',
    teaching: '教学解',
  };

  const getSubmissionMeta = (sub: Submission) => {
    const type = sub.submission_type === 'problem' ? '题目投稿' : '解法投稿';
    const target = sub.submission_type === 'problem'
      ? sub.problem_source
      : sub.problem_source || sub.problem_id;
    return [type, target, kindLabel[sub.kind] ?? sub.kind].filter(Boolean).join(' · ');
  };

  const solutionSubmissions = submissions.filter((sub) => sub.submission_type !== 'problem');
  const approvedSubmissions = submissions.filter((sub) => sub.status === 'approved');
  const pendingSubmissions = submissions.filter((sub) => sub.status === 'pending');
  const challengeSubmissions = solutionSubmissions.filter((sub) => Boolean(sub.challenge_target_solution_id || sub.content?.json?.solution?.challenge?.targetSolutionId));
  const publishedChallenges = publishedSolutions.filter((solution) => Boolean(solution.challenge_target_solution_id));
  const averageScore = publishedSolutions.length
    ? publishedSolutions
      .map((solution) => {
        const values = Object.values(solution.scores ?? {}).filter((value): value is number => typeof value === 'number');
        return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
      })
      .filter(Boolean)
      .reduce((sum, value, _, all) => sum + value / all.length, 0)
    : 0;
  const strongestDimension = (() => {
    const labels: Record<string, string> = {
      correctness: '正确性',
      examReady: '考场性',
      elegance: '结构美感',
      calculation: '计算量',
      explanation: '讲解友好',
    };
    const totals = new Map<string, { sum: number; count: number }>();
    publishedSolutions.forEach((solution) => {
      Object.entries(solution.scores ?? {}).forEach(([key, value]) => {
        if (typeof value !== 'number') return;
        const current = totals.get(key) ?? { sum: 0, count: 0 };
        totals.set(key, { sum: current.sum + value, count: current.count + 1 });
      });
    });
    const best = [...totals.entries()]
      .map(([key, value]) => ({ key, average: value.sum / value.count }))
      .sort((a, b) => b.average - a.average)[0];
    return best ? labels[best.key] ?? best.key : '等待发布作品';
  })();

  const representativeSolutions = [...publishedSolutions].slice(0, 3);

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-16">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center bg-cyan-400 text-zinc-950">
            <UserIcon className="size-8" />
          </span>
          <div>
            <h1 className="text-2xl font-black text-white">{username}</h1>
            <p className="text-sm text-zinc-500">ProofArena 用户</p>
            {publicUsername && (
              <a
                href={`/profile/${encodeURIComponent(publicUsername)}`}
                className="mt-1 inline-block text-xs text-cyan-400 hover:text-cyan-300"
              >
                查看公开主页 →
              </a>
            )}
          </div>
        </div>

        <div className="space-y-3 rounded border border-white/10 bg-white/[0.02] p-6">
          <div className="flex items-center gap-3 text-zinc-400">
            <Mail className="size-4" />
            <span className="text-sm">{user.email}</span>
          </div>
          <div className="flex items-center gap-3 text-zinc-400">
            <Calendar className="size-4" />
            <span className="text-sm">加入于 {joinedAt}</span>
          </div>
        </div>

        <ProfileSettingsPanel
          user={user}
          username={appProfile?.username ?? ''}
          onUsernameUpdated={(next) => setAppProfile((current) => (current ? { ...current, username: next } : current))}
        />

        <section className="grid gap-3 md:grid-cols-4">
          {[
            ['已发布解法', publishedSolutions.length, Trophy, 'text-emerald-300'],
            ['挑战记录', challengeSubmissions.length + publishedChallenges.length, Swords, 'text-amber-300'],
            ['审核通过', approvedSubmissions.length, CheckCircle2, 'text-cyan-300'],
            ['等待审核', pendingSubmissions.length, Clock, 'text-zinc-300'],
          ].map(([label, value, Icon, color]) => {
            const StatIcon = Icon as typeof Trophy;
            return (
              <div key={label as string} className="rounded border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-zinc-500">{label as string}</span>
                  <StatIcon className={`size-4 ${color as string}`} />
                </div>
                <strong className="mt-3 block font-display text-3xl font-black text-white">{value as number}</strong>
              </div>
            );
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded border border-cyan-400/20 bg-cyan-400/[0.035] p-5">
            <div className="flex items-center gap-2">
              <Award className="size-4 text-cyan-300" />
              <h2 className="text-sm font-bold text-white">解法档案</h2>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs text-zinc-500">作品均分</p>
                <p className="mt-1 font-display text-2xl font-black text-white">{averageScore ? averageScore.toFixed(1) : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">代表优势</p>
                <p className="mt-1 text-sm font-bold text-cyan-200">{strongestDimension}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">贡献路线</p>
                <p className="mt-1 text-sm font-bold text-white">
                  {publishedChallenges.length > 0 ? '擂台挑战型' : publishedSolutions.length > 0 ? '稳定贡献型' : '正在建立'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded border border-amber-400/20 bg-amber-400/[0.04] p-5">
            <div className="flex items-center gap-2">
              <Swords className="size-4 text-amber-300" />
              <h2 className="text-sm font-bold text-white">擂台状态</h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-400">
              {challengeSubmissions.length + publishedChallenges.length > 0
                ? `你已经发起 ${challengeSubmissions.length + publishedChallenges.length} 次解法挑战。通过审核后，它们会沉淀成公开作品。`
                : '还没有发起解法挑战。选择一道题，挑战一个已有解法，会更容易被读者记住。'}
            </p>
            <a href="/submit" className="mt-4 inline-flex h-9 items-center justify-center rounded bg-amber-300 px-4 text-xs font-bold text-zinc-950 transition hover:bg-amber-200">
              发起解法挑战
            </a>
          </div>
        </section>

        {representativeSolutions.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">代表解法</h2>
              <span className="text-xs text-zinc-600">已发布到题库的作品</span>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {representativeSolutions.map((solution) => {
                const scores = Object.values(solution.scores ?? {}).filter((value): value is number => typeof value === 'number');
                const score = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
                return (
                  <a key={solution.id} href={`/problems/${solution.problem_id}#${solution.id}`} className="rounded border border-white/10 bg-white/[0.02] p-5 transition hover:border-cyan-400/35 hover:bg-cyan-400/[0.04]">
                    <div className="flex items-center justify-between gap-3">
                      <span className="border border-white/10 px-2 py-1 text-xs text-zinc-400">{kindLabel[solution.kind] ?? solution.kind}</span>
                      <span className="font-display text-lg font-black text-cyan-300">{score ? score.toFixed(1) : '—'}</span>
                    </div>
                    <h3 className="mt-4 line-clamp-2 font-bold text-white"><MathBlock>{solution.title}</MathBlock></h3>
                    <p className="mt-2 text-xs text-zinc-600">{solution.problem_id}</p>
                    {solution.challenge_target_solution_id && (
                      <p className="mt-4 rounded border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2 text-xs leading-5 text-amber-100">
                        挑战 <MathBlock>{solution.challenge_target_solution_title ?? solution.challenge_target_solution_id}</MathBlock>
                      </p>
                    )}
                  </a>
                );
              })}
            </div>
          </section>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">我的投稿</h2>
            <a href="/submit" className="text-sm text-cyan-400 hover:text-cyan-300">+ 新增投稿</a>
          </div>

          {submissions.length === 0 ? (
            <div className="rounded border border-white/10 bg-white/[0.02] p-8 text-center">
              <p className="text-sm text-zinc-500">暂无投稿记录</p>
              <a
                href="/submit"
                className="mt-4 inline-block rounded bg-cyan-400 px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-cyan-300"
              >
                提交第一份解法
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((sub) => (
                <div key={sub.id} className="rounded border border-white/10 bg-white/[0.02] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-white truncate">{sub.title}</h3>
                      <p className="mt-1 text-xs text-zinc-500">
                        {getSubmissionMeta(sub)}
                      </p>
                      {(sub.challenge_target_solution_id || sub.content?.json?.solution?.challenge?.targetSolutionId) && (
                        <p className="mt-2 inline-flex items-center gap-1.5 rounded border border-amber-400/25 bg-amber-400/[0.06] px-2.5 py-1 text-xs text-amber-200">
                          <Swords className="size-3" />
                          挑战 {sub.content?.json?.solution?.challenge?.targetSolutionTitle ?? sub.challenge_target_solution_id}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs text-zinc-600">
                      {new Date(sub.created_at).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  <SubmissionProgress submission={sub} />
                  {sub.status === 'needs_revision' && (
                    sub.contest_id || sub.contest_slug ? (
                      <p className="mt-4 text-xs leading-5 text-zinc-500">
                        这是比赛投稿，暂不支持在原投稿上修改重投——请参考上方管理员反馈，在比赛页面重新提交一份参赛思路。
                      </p>
                    ) : editingSubmissionId === sub.id ? (
                      <EditSubmissionForm
                        submission={sub}
                        onCancel={() => setEditingSubmissionId(null)}
                        onSaved={handleSubmissionRevised}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingSubmissionId(sub.id)}
                        className="mt-4 inline-flex h-9 items-center gap-1.5 border border-cyan-400/30 px-3 text-xs font-bold text-cyan-300 transition hover:bg-cyan-400/10"
                      >
                        <Pencil className="size-3.5" />
                        修改并重新提交
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
