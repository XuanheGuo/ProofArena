'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { hasSupabasePublicEnv } from '@/lib/supabase-env';
import { MathBlock } from '@/components/MathBlock';
import {
  Award,
  BarChart3,
  Calendar,
  Crown,
  Flame,
  Medal,
  Route,
  Sparkles,
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
  contest_slug?: string | null;
  contest_solution_type?: string | null;
  author_role: string;
  tags?: string[] | null;
  scores?: Record<string, number>;
  challenge_target_solution_id?: string | null;
  challenge_target_solution_title?: string | null;
  challenge_target_solution_author?: string | null;
  challenge_claim?: string | null;
  created_at: string;
};

type ContestAward = {
  id: string;
  contest_id: string;
  type: string;
  title: string;
  reason: string;
  points: number;
  created_at: string;
  contests?: { slug: string; title: string } | Array<{ slug: string; title: string }> | null;
};

type ContestParticipantProfile = {
  id: string;
  contest_slug: string;
  challenge_score: number;
  challenge_multiplier: number;
  multiplier_reason: string;
  penalty_points: number;
};

type ContestScore = {
  id: string;
  contest_id: string;
  problem_phase: string;
  raw_score: number;
  score_max: number;
};

type SubmissionSummary = {
  id: string;
  status: string;
  created_at: string;
};

type RadarMetric = {
  key: string;
  label: string;
  value: number;
  detail: string;
};

const kindLabel: Record<string, string> = {
  standard: '标准解',
  insight: '启发解',
  robust: '稳健解',
  teaching: '教学解',
};

const contestSolutionTypeLabel: Record<string, string> = {
  standard: '标准路线',
  clever: '巧解',
  teaching: '讲解型',
  geometry: '几何路线',
  algebra: '代数路线',
  construction: '构造型',
  wrong_analysis: '错解分析',
  variant: '变式推广',
  supplement: '补充观察',
};

const awardTypeLabel: Record<string, string> = {
  fastest: '最快突破',
  best_standard: '最佳标准解',
  best_clever: '最佳巧解',
  best_teaching: '最佳讲解',
  best_wrong_analysis: '最佳错解分析',
  best_comment: '最佳讨论',
  best_overall: '综合最佳',
  best_variant: '最佳变式',
  best_contributor: '最佳贡献者',
};

function avgScore(scores?: Record<string, number>): number {
  if (!scores) return 0;
  const vals = Object.values(scores).filter((v): v is number => typeof v === 'number');
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
}

function firstContest(contest: ContestAward['contests']) {
  return Array.isArray(contest) ? contest[0] : contest;
}

function topEntries<T extends string>(items: T[], fallback: string) {
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return rows.length ? rows : [[fallback as T, 0] as [T, number]];
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function daysSince(dateString: string) {
  const time = new Date(dateString).getTime();
  if (!Number.isFinite(time)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (Date.now() - time) / 86_400_000);
}

function Pill({
  children,
  tone = 'zinc',
}: {
  children: React.ReactNode;
  tone?: 'zinc' | 'cyan' | 'amber' | 'emerald' | 'violet';
}) {
  const cls = {
    zinc: 'border-white/10 text-zinc-400',
    cyan: 'border-cyan-400/25 bg-cyan-400/[0.06] text-cyan-200',
    amber: 'border-amber-400/25 bg-amber-400/[0.06] text-amber-200',
    emerald: 'border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-200',
    violet: 'border-violet-400/25 bg-violet-400/[0.06] text-violet-200',
  }[tone];
  return <span className={`inline-flex items-center border px-2.5 py-1 text-xs font-bold ${cls}`}>{children}</span>;
}

function RadarChart({ metrics }: { metrics: RadarMetric[] }) {
  const size = 260;
  const center = size / 2;
  const radius = 92;
  const rings = [0.25, 0.5, 0.75, 1];

  const point = (index: number, scale: number) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / metrics.length;
    return {
      x: center + Math.cos(angle) * radius * scale,
      y: center + Math.sin(angle) * radius * scale,
    };
  };

  const polygon = (scale: number) =>
    metrics.map((_, index) => {
      const p = point(index, scale);
      return `${p.x},${p.y}`;
    }).join(' ');

  const valuePolygon = metrics.map((metric, index) => {
    const p = point(index, metric.value / 100);
    return `${p.x},${p.y}`;
  }).join(' ');

  return (
    <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-center">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="公开主页能力雷达图" className="mx-auto h-72 w-full max-w-72">
        {rings.map((ring) => (
          <polygon key={ring} points={polygon(ring)} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
        ))}
        {metrics.map((metric, index) => {
          const end = point(index, 1);
          const label = point(index, 1.18);
          return (
            <g key={metric.key}>
              <line x1={center} y1={center} x2={end.x} y2={end.y} stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
              <text
                x={label.x}
                y={label.y}
                textAnchor={Math.abs(label.x - center) < 10 ? 'middle' : label.x > center ? 'start' : 'end'}
                dominantBaseline="middle"
                fill="rgb(212 212 216)"
                fontSize="11"
                fontWeight="700"
              >
                {metric.label}
              </text>
            </g>
          );
        })}
        <polygon points={valuePolygon} fill="rgba(34,211,238,0.20)" stroke="rgb(34,211,238)" strokeWidth="2" />
        {metrics.map((metric, index) => {
          const p = point(index, metric.value / 100);
          return <circle key={metric.key} cx={p.x} cy={p.y} r="3.5" fill="rgb(34,211,238)" />;
        })}
      </svg>
      <div className="grid gap-2 sm:grid-cols-2">
        {metrics.map((metric) => (
          <div key={metric.key} className="border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-zinc-300">{metric.label}</span>
              <span className="font-mono text-sm font-bold text-cyan-200">{metric.value}</span>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-zinc-500">{metric.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PublicProfilePage() {
  const { username } = useParams<{ username: string }>();
  const communityEnabled = hasSupabasePublicEnv();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [solutions, setSolutions] = useState<PublishedSolution[]>([]);
  const [awards, setAwards] = useState<ContestAward[]>([]);
  const [participantProfiles, setParticipantProfiles] = useState<ContestParticipantProfile[]>([]);
  const [contestScores, setContestScores] = useState<ContestScore[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [loading, setLoading] = useState(communityEnabled);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!communityEnabled) {
      setLoading(false);
      return;
    }
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

      const [solutionRes, awardRes, participantRes, scoreRes, submissionRes] = await Promise.all([
        supabase
          .from('solutions')
          .select('id, problem_id, title, kind, contest_slug, contest_solution_type, author_role, tags, scores, challenge_target_solution_id, challenge_target_solution_title, challenge_target_solution_author, challenge_claim, created_at')
          .eq('author_id', profileData.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('awards')
          .select('id, contest_id, type, title, reason, points, created_at, contests(slug, title)')
          .eq('user_id', profileData.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('contest_participant_profiles')
          .select('id, contest_slug, challenge_score, challenge_multiplier, multiplier_reason, penalty_points')
          .eq('user_id', profileData.id),
        supabase
          .from('contest_submission_scores')
          .select('id, contest_id, problem_phase, raw_score, score_max')
          .eq('user_id', profileData.id),
        supabase
          .from('submissions')
          .select('id, status, created_at')
          .eq('user_id', profileData.id),
      ]);

      setSolutions((solutionRes.data as PublishedSolution[]) ?? []);
      setAwards((awardRes.data as ContestAward[]) ?? []);
      setParticipantProfiles((participantRes.data as ContestParticipantProfile[]) ?? []);
      setContestScores((scoreRes.data as ContestScore[]) ?? []);
      setSubmissions((submissionRes.data as SubmissionSummary[]) ?? []);
      setLoading(false);
    })();
  }, [communityEnabled, username]);

  if (!communityEnabled) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-16 text-center">
        <div className="mx-auto max-w-2xl border border-amber-400/25 bg-amber-400/[0.06] p-6">
          <h1 className="text-xl font-black text-white">社区数据库暂不可用</h1>
          <p className="mt-3 text-sm leading-6 text-amber-100">公开个人主页需要 Supabase。当前仍可浏览静态题库和解法。</p>
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
        <div className="mx-auto max-w-6xl animate-pulse space-y-4">
          <div className="h-16 bg-white/5" />
          <div className="h-32 bg-white/5" />
          <div className="h-48 bg-white/5" />
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
  const contestSolutions = solutions.filter((s) => Boolean(s.contest_slug));
  const contestSlugs = new Set([
    ...contestSolutions.map((s) => s.contest_slug).filter((slug): slug is string => Boolean(slug)),
    ...participantProfiles.map((p) => p.contest_slug).filter(Boolean),
  ]);
  const approvedSubmissions = submissions.filter((submission) => submission.status === 'approved');
  const awardPoints = awards.reduce((sum, award) => sum + (Number(award.points) || 0), 0);
  const officialScore = contestScores.reduce((sum, score) => sum + (Number(score.raw_score) || 0), 0);
  const bestMultiplier = participantProfiles.length
    ? Math.max(...participantProfiles.map((p) => Number(p.challenge_multiplier) || 1))
    : 1;
  const overallAvg = solutions.length
    ? solutions
        .map((s) => avgScore(s.scores))
        .filter(Boolean)
        .reduce((sum, v, _, all) => sum + v / all.length, 0)
    : 0;

  const latestActivityDays = Math.min(
    ...[
      ...solutions.map((solution) => daysSince(solution.created_at)),
      ...awards.map((award) => daysSince(award.created_at)),
      ...submissions.map((submission) => daysSince(submission.created_at)),
    ],
  );
  const submissionPassRate = submissions.length > 0 ? approvedSubmissions.length / submissions.length : null;
  const radarMetrics: RadarMetric[] = [
    {
      key: 'activity',
      label: '活跃度',
      value: clampPercent((submissions.length || solutions.length) * 14 + solutions.length * 8),
      detail: submissions.length > 0 ? `${submissions.length} 次投稿记录` : `${solutions.length} 个公开作品`,
    },
    {
      key: 'participation',
      label: '参与度',
      value: clampPercent(contestSlugs.size * 24 + contestScores.length * 6 + contestSolutions.length * 8),
      detail: `${contestSlugs.size} 场比赛 · ${contestScores.length} 项评分`,
    },
    {
      key: 'conversion',
      label: submissionPassRate === null ? '沉淀度' : '通过率',
      value: submissionPassRate === null
        ? clampPercent(solutions.length * 18 + Math.min(overallAvg, 10) * 4)
        : clampPercent(submissionPassRate * 100),
      detail: submissionPassRate === null
        ? `${solutions.length} 个已发布作品`
        : `${approvedSubmissions.length}/${submissions.length} 通过或发布`,
    },
    {
      key: 'challenge',
      label: '挑战性',
      value: clampPercent(challenges.length * 24 + Math.max(0, bestMultiplier - 1) * 240),
      detail: `${challenges.length} 次解法挑战 · 最高 ${bestMultiplier.toFixed(2)}x`,
    },
    {
      key: 'impact',
      label: '影响力',
      value: clampPercent(awards.length * 22 + awardPoints * 4),
      detail: `${awards.length} 个奖项 · ${awardPoints} 奖励分`,
    },
    {
      key: 'recent',
      label: '近期活跃',
      value: Number.isFinite(latestActivityDays)
        ? clampPercent(100 - Math.min(latestActivityDays, 90) / 90 * 100)
        : 0,
      detail: Number.isFinite(latestActivityDays)
        ? latestActivityDays < 1 ? '今天有动态' : `${Math.floor(latestActivityDays)} 天前有动态`
        : '暂无近期动态',
    },
  ];
  const strongestDimension = [...radarMetrics].sort((a, b) => b.value - a.value)[0]?.label ?? null;
  const kindStats = topEntries(solutions.map((s) => kindLabel[s.kind] ?? s.kind), '暂无作品');
  const styleStats = topEntries(
    solutions.map((s) => s.contest_solution_type ? contestSolutionTypeLabel[s.contest_solution_type] ?? s.contest_solution_type : kindLabel[s.kind] ?? s.kind),
    '正在建立',
  );
  const tagStats = topEntries(solutions.flatMap((s) => s.tags ?? []).filter(Boolean), '暂无标签').slice(0, 6);
  const representativeSolutions = [...solutions].sort((a, b) => avgScore(b.scores) - avgScore(a.scores)).slice(0, 4);

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-16">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-8 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center bg-cyan-400 text-zinc-950">
              <UserIcon className="size-8" />
            </span>
            <div>
              <h1 className="text-2xl font-black text-white">{displayName}</h1>
              <p className="text-sm text-zinc-500">@{profile.username}</p>
              {profile.bio && <p className="mt-1 max-w-2xl text-sm text-zinc-400">{profile.bio}</p>}
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-500">
            <Calendar className="size-4" />
            <span>加入于 {joinedAt}</span>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['已发布解法', solutions.length, Trophy, 'text-emerald-300'],
            ['参与比赛', contestSlugs.size, Flame, 'text-red-300'],
            ['获奖', awards.length, Medal, 'text-amber-300'],
            ['作品均分', overallAvg ? overallAvg.toFixed(1) : '—', Award, 'text-cyan-300'],
          ].map(([label, value, Icon, color]) => {
            const StatIcon = Icon as typeof Trophy;
            return (
              <div key={label as string} className="border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-zinc-500">{label as string}</span>
                  <StatIcon className={`size-4 ${color as string}`} />
                </div>
                <strong className="mt-3 block font-display text-3xl font-black text-white">{value as string | number}</strong>
              </div>
            );
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="border border-cyan-400/20 bg-cyan-400/[0.035] p-5">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 text-cyan-300" />
              <h2 className="text-sm font-bold text-white">能力画像</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              基于公开作品、比赛记录、奖项和可见审核记录综合估计，不直接等同于解法五维评分。
            </p>
            <div className="mt-5">
              <RadarChart metrics={radarMetrics} />
            </div>
          </div>

          <div className="border border-amber-400/20 bg-amber-400/[0.04] p-5">
            <div className="flex items-center gap-2">
              <Crown className="size-4 text-amber-300" />
              <h2 className="text-sm font-bold text-white">比赛履历</h2>
            </div>
            <div className="mt-5 grid grid-cols-3 divide-x divide-white/[0.08] border border-white/10 bg-black/20 text-center">
              <div className="p-3">
                <strong className="block font-display text-2xl text-white">{contestSlugs.size}</strong>
                <span className="text-[11px] text-zinc-500">场比赛</span>
              </div>
              <div className="p-3">
                <strong className="block font-display text-2xl text-amber-200">{awardPoints}</strong>
                <span className="text-[11px] text-zinc-500">奖励分</span>
              </div>
              <div className="p-3">
                <strong className="block font-display text-2xl text-cyan-200">{bestMultiplier.toFixed(2)}x</strong>
                <span className="text-[11px] text-zinc-500">最高倍率</span>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-400">
              {contestSlugs.size > 0
                ? `已沉淀 ${contestSolutions.length} 条比赛解法，官方评分累计 ${officialScore.toFixed(1)} 分。`
                : '还没有公开比赛记录。参与比赛后，这里会展示积分、倍率和获奖轨迹。'}
            </p>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-2">
              <Route className="size-4 text-emerald-300" />
              <h2 className="text-sm font-bold text-white">解法风格</h2>
            </div>
            <div className="mt-4 space-y-2">
              {styleStats.slice(0, 4).map(([label, count]) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">{label}</span>
                  <span className="font-mono text-zinc-200">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-violet-300" />
              <h2 className="text-sm font-bold text-white">作品类型</h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {kindStats.slice(0, 4).map(([label, count]) => (
                <Pill key={label} tone={count > 0 ? 'violet' : 'zinc'}>{label} · {count}</Pill>
              ))}
            </div>
          </div>

          <div className="border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center gap-2">
              <Swords className="size-4 text-amber-300" />
              <h2 className="text-sm font-bold text-white">擂台倾向</h2>
            </div>
            <p className="mt-4 text-sm leading-6 text-zinc-400">
              {challenges.length > 0
                ? `发起过 ${challenges.length} 次公开解法挑战，偏向在已有路线旁边提出替代方案。`
                : '目前以独立投稿为主，尚未形成公开挑战记录。'}
            </p>
          </div>
        </section>

        {awards.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">获奖墙</h2>
              <span className="text-xs text-zinc-600">{awardPoints} 奖励分</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {awards.slice(0, 6).map((award) => {
                const contest = firstContest(award.contests);
                return (
                  <article key={award.id} className="border border-amber-400/20 bg-amber-400/[0.04] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Pill tone="amber">{awardTypeLabel[award.type] ?? award.type}</Pill>
                        <h3 className="mt-3 font-bold text-white">{award.title}</h3>
                        {contest && (
                          <a href={`/contests/${contest.slug}`} className="mt-1 inline-block text-xs text-cyan-300 hover:text-cyan-200">
                            {contest.title}
                          </a>
                        )}
                      </div>
                      <strong className="font-display text-xl text-amber-200">+{award.points}</strong>
                    </div>
                    {award.reason && <p className="mt-3 text-sm leading-6 text-zinc-400">{award.reason}</p>}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {tagStats.some(([, count]) => count > 0) && (
          <section className="border border-white/10 bg-white/[0.02] p-5">
            <h2 className="text-sm font-bold text-white">常见能力标签</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {tagStats.map(([tag, count]) => (
                <Pill key={tag} tone="cyan">{tag} · {count}</Pill>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">代表作品</h2>
            {strongestDimension && (
              <span className="text-xs text-zinc-500">
                代表优势：<span className="text-cyan-300">{strongestDimension}</span>
              </span>
            )}
          </div>

          {solutions.length === 0 ? (
            <div className="border border-white/10 bg-white/[0.02] p-8 text-center">
              <p className="text-sm text-zinc-500">暂无已发布解法</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {representativeSolutions.map((s) => {
                const score = avgScore(s.scores);
                return (
                  <a
                    key={s.id}
                    href={`/problems/${s.problem_id}#${s.id}`}
                    className="border border-white/10 bg-white/[0.02] p-5 transition hover:border-cyan-400/35 hover:bg-cyan-400/[0.04]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="border border-white/10 px-2 py-1 text-xs text-zinc-400">{kindLabel[s.kind] ?? s.kind}</span>
                      <span className="font-display text-lg font-black text-cyan-300">{score ? score.toFixed(1) : '—'}</span>
                    </div>
                    <h3 className="mt-4 line-clamp-2 font-bold text-white"><MathBlock>{s.title}</MathBlock></h3>
                    <p className="mt-1 text-xs text-zinc-600">{s.problem_id}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {s.contest_solution_type && <Pill tone="emerald">{contestSolutionTypeLabel[s.contest_solution_type] ?? s.contest_solution_type}</Pill>}
                      {s.contest_slug && <Pill tone="amber">比赛作品</Pill>}
                    </div>
                    {s.challenge_target_solution_id && (
                      <p className="mt-3 inline-flex items-center gap-1.5 border border-amber-400/20 bg-amber-400/[0.05] px-2.5 py-1 text-xs text-amber-200">
                        <Swords className="size-3" />
                        挑战 <MathBlock>{s.challenge_target_solution_title ?? s.challenge_target_solution_id}</MathBlock>
                      </p>
                    )}
                    <p className="mt-3 text-xs text-zinc-700">{new Date(s.created_at).toLocaleDateString('zh-CN')}</p>
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
