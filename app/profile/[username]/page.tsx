'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import {
  Award,
  Calendar,
  Swords,
  Trophy,
  User as UserIcon,
} from 'lucide-react';

type UserProfile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  role: string;
  created_at: string;
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
  created_at: string;
};

const kindLabel: Record<string, string> = {
  standard: '标准解',
  insight: '启发解',
  robust: '稳健解',
  teaching: '教学解',
};

function avgScore(scores?: Record<string, number>): number {
  if (!scores) return 0;
  const vals = Object.values(scores).filter((v): v is number => typeof v === 'number');
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
}

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [solutions, setSolutions] = useState<PublishedSolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) return;
    const supabase = createClient();

    (async () => {
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('id, username, display_name, bio, role, created_at')
        .eq('username', username)
        .single();

      if (!profileData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProfile(profileData as UserProfile);

      const { data: solutionData } = await supabase
        .from('solutions')
        .select('id, problem_id, title, kind, author_role, scores, challenge_target_solution_id, challenge_target_solution_title, challenge_target_solution_author, challenge_claim, created_at')
        .eq('author_id', profileData.id)
        .order('created_at', { ascending: false });

      setSolutions((solutionData as PublishedSolution[]) ?? []);
      setLoading(false);
    })();
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-16">
        <div className="mx-auto max-w-3xl animate-pulse space-y-4">
          <div className="h-16 rounded bg-white/5" />
          <div className="h-32 rounded bg-white/5" />
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-16 text-center">
        <p className="text-zinc-500">找不到用户 <span className="text-white">@{username}</span></p>
        <a href="/problems" className="mt-6 inline-block text-sm text-cyan-400 hover:text-cyan-300">
          返回题库
        </a>
      </div>
    );
  }

  const displayName = profile.display_name || profile.username;
  const joinedAt = new Date(profile.created_at).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const challenges = solutions.filter((s) => Boolean(s.challenge_target_solution_id));
  const overallAvg = solutions.length
    ? solutions
        .map((s) => avgScore(s.scores))
        .filter(Boolean)
        .reduce((sum, v, _, all) => sum + v / all.length, 0)
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
    solutions.forEach((s) => {
      Object.entries(s.scores ?? {}).forEach(([key, value]) => {
        if (typeof value !== 'number') return;
        const cur = totals.get(key) ?? { sum: 0, count: 0 };
        totals.set(key, { sum: cur.sum + value, count: cur.count + 1 });
      });
    });
    const best = [...totals.entries()]
      .map(([key, val]) => ({ key, avg: val.sum / val.count }))
      .sort((a, b) => b.avg - a.avg)[0];
    return best ? (labels[best.key] ?? best.key) : null;
  })();

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-16">
      <div className="mx-auto max-w-3xl space-y-8">

        {/* Header */}
        <div className="flex items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center bg-cyan-400 text-zinc-950">
            <UserIcon className="size-8" />
          </span>
          <div>
            <h1 className="text-2xl font-black text-white">{displayName}</h1>
            <p className="text-sm text-zinc-500">@{profile.username}</p>
            {profile.bio && <p className="mt-1 text-sm text-zinc-400">{profile.bio}</p>}
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <Calendar className="size-4" />
          <span>加入于 {joinedAt}</span>
        </div>

        {/* Stats */}
        <section className="grid gap-3 sm:grid-cols-3">
          {[
            ['已发布解法', solutions.length, Trophy, 'text-emerald-300'],
            ['擂台挑战', challenges.length, Swords, 'text-amber-300'],
            ['作品均分', overallAvg ? overallAvg.toFixed(1) : '—', Award, 'text-cyan-300'],
          ].map(([label, value, Icon, color]) => {
            const StatIcon = Icon as typeof Trophy;
            return (
              <div key={label as string} className="rounded border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-zinc-500">{label as string}</span>
                  <StatIcon className={`size-4 ${color as string}`} />
                </div>
                <strong className="mt-3 block font-display text-3xl font-black text-white">
                  {value as string | number}
                </strong>
              </div>
            );
          })}
        </section>

        {/* Archive */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">解法档案</h2>
            {strongestDimension && (
              <span className="text-xs text-zinc-500">
                代表优势：<span className="text-cyan-300">{strongestDimension}</span>
              </span>
            )}
          </div>

          {solutions.length === 0 ? (
            <div className="rounded border border-white/10 bg-white/[0.02] p-8 text-center">
              <p className="text-sm text-zinc-500">暂无已发布解法</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {solutions.map((s) => {
                const score = avgScore(s.scores);
                return (
                  <a
                    key={s.id}
                    href={`/problems/${s.problem_id}#${s.id}`}
                    className="rounded border border-white/10 bg-white/[0.02] p-5 transition hover:border-cyan-400/35 hover:bg-cyan-400/[0.04]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="border border-white/10 px-2 py-1 text-xs text-zinc-400">
                        {kindLabel[s.kind] ?? s.kind}
                      </span>
                      <span className="font-display text-lg font-black text-cyan-300">
                        {score ? score.toFixed(1) : '—'}
                      </span>
                    </div>
                    <h3 className="mt-4 line-clamp-2 font-bold text-white">{s.title}</h3>
                    <p className="mt-1 text-xs text-zinc-600">{s.problem_id}</p>
                    {s.challenge_target_solution_id && (
                      <p className="mt-3 inline-flex items-center gap-1.5 rounded border border-amber-400/20 bg-amber-400/[0.05] px-2.5 py-1 text-xs text-amber-200">
                        <Swords className="size-3" />
                        挑战 {s.challenge_target_solution_title ?? s.challenge_target_solution_id}
                      </p>
                    )}
                    <p className="mt-3 text-xs text-zinc-700">
                      {new Date(s.created_at).toLocaleDateString('zh-CN')}
                    </p>
                  </a>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
