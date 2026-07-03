'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-client';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { Calendar, CheckCircle2, Clock, Mail, User as UserIcon, XCircle, AlertCircle } from 'lucide-react';

type Submission = {
  id: string;
  title: string;
  submission_type?: 'problem' | 'solution';
  problem_id?: string | null;
  problem_source?: string;
  kind: string;
  status: 'pending' | 'approved' | 'rejected' | 'needs_revision';
  created_at: string;
  updated_at: string;
  moderator_notes?: string;
};

function SubmissionProgress({ submission }: { submission: Submission }) {
  const { status, moderator_notes } = submission;

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
  const [user, setUser] = useState<User | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.push('/auth/login');
        return;
      }
      setUser(data.user);

      const { data: subs } = await supabase
        .from('submissions')
        .select('id, title, submission_type, problem_id, problem_source, kind, status, created_at, updated_at, moderator_notes')
        .eq('user_id', data.user.id)
        .order('created_at', { ascending: false });

      setSubmissions((subs as Submission[]) ?? []);
      setLoading(false);
    });
  }, [supabase, router]);

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

  const username = user.user_metadata?.username || '匿名用户';
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

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-16">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center bg-cyan-400 text-zinc-950">
            <UserIcon className="size-8" />
          </span>
          <div>
            <h1 className="text-2xl font-black text-white">{username}</h1>
            <p className="text-sm text-zinc-500">ProofArena 用户</p>
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
                    </div>
                    <span className="shrink-0 text-xs text-zinc-600">
                      {new Date(sub.created_at).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  <SubmissionProgress submission={sub} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
