import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Crown,
  Flame,
  ListChecks,
  Lock,
  Plus,
  Shield,
  Swords,
  Sparkles,
  Trophy,
} from "lucide-react";
import { MathBlock } from "@/components/MathBlock";
import { contestStatusMeta, contestSolutionTypeMeta, contestProblemPhaseMeta } from "@/lib/contest-meta";
import { ContestThoughtArena } from "@/components/ContestThoughtArena";
import { ContestMyPanel } from "@/components/ContestMyPanel";
import { ContestCountdown } from "@/components/ContestCountdown";
import { getContest, getContestLeaderboard, getContestScoreboard, getContestSubmissionStats, getContests, getContestThoughts, getContestUserRankings } from "@/lib/contests";
import { getProblems, getSolutionAverage } from "@/lib/db";
import { getProblemDraftTitles } from "@/lib/problem-drafts";
import { difficultyBadgeClass } from "@/lib/problem-presentation";
import { getEffectiveProblemStatus, isContestProblemLocked } from "@/lib/types";
import { formatContestDateTime } from "@/lib/format-contest-time";

type PageProps = {
  params: Promise<{ slug: string }>;
};

// 60s (not 300s): contest problems unlock on exact Beijing-time boundaries
// (10:00 open / 17:00 close), and ContestCountdown only triggers a
// router.refresh() at those moments — a 5-minute ISR window would keep
// serving the stale locked/draft page right when everyone is waiting.
export const revalidate = 60;

export async function generateStaticParams() {
  const contests = await getContests();
  return contests.map((contest) => ({ slug: contest.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const contest = await getContest(slug);
  if (!contest) return {};

  return {
    title: `${contest.title} | ProofArena`,
    description: contest.tagline,
  };
}

function getProblemStatusLabel(effectiveStatus: string, contest: { status: string }) {
  if (effectiveStatus === "locked") return null;
  if (effectiveStatus === "closed" || contest.status === "finished") return { label: "已结束", className: "border-zinc-500/50 bg-zinc-800 text-zinc-300" };
  if (effectiveStatus === "reviewing" || contest.status === "judging") return { label: "互评中", className: "border-amber-500/50 bg-amber-500/15 text-amber-300" };
  if (effectiveStatus === "open" && contest.status === "active") return { label: "提交中", className: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" };
  return null;
}



export default async function ContestDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const contest = await getContest(slug);
  if (!contest) notFound();

  const [problems, leaderboard, contestStats, userRankings, scoreboard] = await Promise.all([
    getProblems(),
    getContestLeaderboard(slug),
    getContestSubmissionStats(slug),
    getContestUserRankings(slug, contest.awards),
    getContestScoreboard(slug),
  ]);
  const contestThoughts = await getContestThoughts(slug, contest);
  const problemMap = new Map(problems.map((problem) => [problem.id, problem]));
  const now = new Date();
  const status = contestStatusMeta[contest.status];
  const linkedWithStatus = contest.problems.map((contestProblem) => ({
    contestProblem,
    problem: contestProblem.problemId ? problemMap.get(contestProblem.problemId) : undefined,
    effectiveStatus: getEffectiveProblemStatus(contestProblem, now),
    // A contest problem is "enterable" the moment it has a route target —
    // whether that target lives in the public catalog or is still a
    // Problem Vault draft — as long as it isn't locked.
    isLocked: isContestProblemLocked(contest, contestProblem, now),
    routeId: contestProblem.problemId ?? contestProblem.draftProblemId ?? null,
  }));
  const solutionCount = linkedWithStatus.reduce((sum, item) => sum + (item.problem?.solutions.length ?? 0), 0);

  // Once unlocked, a draft-backed contest problem's title has to come from a
  // trusted server read — RLS on problem_drafts denies regular visitors.
  // Never fetch (let alone render) a title for one that's still locked.
  const unlockedDraftIds = linkedWithStatus
    .filter((item) => !item.isLocked && item.contestProblem.draftProblemId)
    .map((item) => item.contestProblem.draftProblemId as string);
  const draftTitleMap = await getProblemDraftTitles(unlockedDraftIds);

  // Only ever surface a best-solution fallback entry for a contest problem
  // that has actually unlocked — otherwise this "best solution" fallback
  // would announce a locked day's title, author, and link before it should
  // be visible at all.
  const bestSolutions = linkedWithStatus
    .flatMap(({ contestProblem, problem, isLocked }) => {
      if (!problem || isLocked) return [];
      return problem.solutions.map((solution) => ({
        contestProblem,
        problem,
        solution,
        average: getSolutionAverage(solution),
      }));
    })
    .sort((a, b) => b.average - a.average)
    .slice(0, 5);
  const todayProblem = linkedWithStatus.find((item) => !item.isLocked && item.effectiveStatus === "open")?.contestProblem;
  const todayRouteId = todayProblem?.problemId ?? todayProblem?.draftProblemId;
  // Hide the leaderboard for the whole draft period too, not just while
  // active: pre-launch, any fallback ranking would just be leftover static
  // solution data for problems that haven't been revealed yet.
  const hideLeaderboard = contest.status === "active" || contest.status === "draft";
  const useDbLeaderboard = leaderboard.solutions.length > 0;
  const problemTitles = {
    ...Object.fromEntries(problems.map((problem) => [problem.id, problem.title])),
    ...draftTitleMap,
  };

  return (
    <main className="grid-surface min-h-screen">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className={`border-b ${contest.status === "active" ? "border-emerald-500/20 bg-zinc-950" : "border-white/10 bg-zinc-950/90"}`}>
        {contest.status === "active" && (
          <div className="h-0.5 bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
        )}
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
          <Link href="/contests" className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white">
            <ArrowLeft className="size-4" />
            返回比赛列表
          </Link>
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`border px-2.5 py-1 font-bold ${status.className}`}>{status.label}</span>
                <span className="flex items-center gap-1.5 border border-white/10 px-2.5 py-1 text-zinc-500">
                  <CalendarDays className="size-3" />
                  {formatContestDateTime(contest.startAt)} – {formatContestDateTime(contest.endAt)}（北京时间）
                </span>
              </div>
              <h1 className="mt-5 text-3xl font-black leading-tight text-white sm:text-4xl md:text-5xl">{contest.title}</h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-zinc-300">{contest.tagline}</p>
              <p className="mt-1.5 text-sm leading-6 text-zinc-500">{contest.description}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {todayRouteId && (
                  <Link
                    href={`/contests/${contest.slug}/problems/${todayRouteId}`}
                    className="inline-flex h-10 items-center gap-2 bg-emerald-400 px-5 text-sm font-bold text-zinc-950 transition hover:bg-emerald-300"
                  >
                    <Flame className="size-4" />
                    今日题目
                  </Link>
                )}
                {(contest.status === "active" || contest.status === "judging") && (
                  <Link
                    href={`/submit?contest=${contest.slug}`}
                    className="inline-flex h-10 items-center gap-2 border border-cyan-400/40 bg-cyan-400/[0.08] px-5 text-sm font-bold text-cyan-300 transition hover:bg-cyan-400/15"
                  >
                    <Plus className="size-4" />
                    提交解法
                  </Link>
                )}
                <a
                  href="#leaderboard"
                  className="inline-flex h-10 items-center gap-2 border border-white/15 px-5 text-sm font-bold text-zinc-300 transition hover:border-white/25 hover:text-white"
                >
                  <Trophy className="size-4" />
                  榜单
                </a>
              </div>
            </div>
            {/* Stats summary */}
            <div className="grid grid-cols-3 divide-x divide-white/[0.07] border border-white/[0.09] bg-black/30">
              <div className="flex flex-col items-center gap-0.5 p-4 text-center">
                <strong className="font-mono text-2xl font-black tabular-nums text-cyan-300">{contest.problems.length}</strong>
                <span className="text-[11px] text-zinc-600">赛题</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 p-4 text-center">
                <strong className="font-mono text-2xl font-black tabular-nums text-emerald-300">
                  {contestStats.participantCount > 0 ? contestStats.participantCount : (solutionCount > 0 ? solutionCount : "—")}
                </strong>
                <span className="text-[11px] text-zinc-600">
                  {contestStats.participantCount > 0 ? "参与者" : "现有解法"}
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5 p-4 text-center">
                <strong className="font-mono text-2xl font-black tabular-nums text-amber-300">
                  {contestStats.submissionCount > 0 ? contestStats.submissionCount : contest.awards.length}
                </strong>
                <span className="text-[11px] text-zinc-600">
                  {contestStats.submissionCount > 0 ? "参赛投稿" : "奖项"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 md:px-6 md:py-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <section className="border border-white/10 bg-zinc-950 p-5 md:p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
              <ListChecks className="size-4 text-cyan-400" />
              比赛规则
            </div>
            <ol className="space-y-3">
              {contest.rules.map((rule, i) => (
                <li key={rule} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 text-sm leading-7 text-zinc-400">
                  <span className="mt-0.5 font-mono text-[11px] font-bold text-zinc-600">{String(i + 1).padStart(2, "0")}</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="grid gap-2 md:grid-cols-3">
            {[
              { label: "参赛内容", text: "标准解、巧解、教学解、错解分析、变式都可以。不要求完整，有价值的思路火花优先。" },
              { label: "互评维度", text: "正确性、清晰度、优雅度、启发性、考试可用性，总分 25 分。" },
              { label: "赛后沉淀", text: "获奖解法按题目整理成合集，回流到题目详情页，长期保留。" },
            ].map(({ label, text }) => (
              <article key={label} className="border border-white/10 bg-zinc-950 p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-cyan-400">{label}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
              </article>
            ))}
          </section>

          {contest.status === "active" && (
            <section className="flex items-start gap-3 border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3">
              <Shield className="mt-0.5 size-4 shrink-0 text-amber-400" />
              <p className="text-sm leading-6 text-zinc-300">
                <strong className="text-amber-300">进行中保护：</strong>
                从比赛入口进入题目页时，已有题解和解法树暂时隐藏，评审或结束后恢复。
              </p>
            </section>
          )}

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-black text-white">题目安排</h2>
              </div>
            </div>
            <div className="grid gap-3">
              {linkedWithStatus.map(({ contestProblem, problem, effectiveStatus, isLocked, routeId }) => {
                const draftTitle = contestProblem.draftProblemId ? draftTitleMap[contestProblem.draftProblemId] : undefined;
                const displayTitle = problem?.title ?? draftTitle;
                const phase = contestProblem.problemPhase ?? "daily";
                const phaseMeta = contestProblemPhaseMeta[phase];
                // Phase-colored left accent stripe on unlocked cards.
                const phaseStripe = {
                  daily: "border-l-cyan-400/50",
                  challenge: "border-l-red-400/50",
                  sprint: "border-l-amber-400/50",
                  major: "border-l-violet-400/50",
                  discussion: "border-l-zinc-500/50",
                }[phase] ?? "border-l-white/10";

                return (
                  <article
                    key={contestProblem.id}
                    className={`border bg-zinc-950 transition ${
                      isLocked
                        ? "border-white/[0.06] opacity-50"
                        : `border-l-2 ${phaseStripe} border-t border-r border-b border-white/10 hover:border-white/20 hover:bg-zinc-900/50`
                    }`}
                  >
                    <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="bg-cyan-400 px-2 py-0.5 font-bold text-zinc-950">Day {contestProblem.dayIndex}</span>
                          <span className={`border px-2 py-0.5 font-bold ${phaseMeta.className}`}>
                            {phaseMeta.label}
                          </span>
                          <span className="border border-white/15 px-2 py-0.5 text-zinc-400">{contestProblem.title}</span>
                          {problem && !isLocked && <span className={`border px-2 py-0.5 ${difficultyBadgeClass[problem.difficulty]}`}>{problem.difficulty}</span>}
                          {!isLocked && !problem && draftTitle && (
                            <span className="border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-violet-300">未公开新题</span>
                          )}
                          {(() => {
                            const statusLabel = getProblemStatusLabel(effectiveStatus, contest);
                            return statusLabel ? (
                              <span className={`border px-2 py-0.5 font-bold ${statusLabel.className}`}>{statusLabel.label}</span>
                            ) : null;
                          })()}
                          {isLocked && (
                            <span className="inline-flex items-center gap-1 border border-white/10 px-2 py-0.5 text-zinc-500">
                              <Lock className="size-3" />
                              未解锁
                            </span>
                          )}
                        </div>
                        <h3 className="mt-3 font-bold text-white">
                          {isLocked ? contestProblem.theme : (displayTitle ?? "题目待关联")}
                        </h3>
                        {!isLocked && <p className="mt-1.5 text-sm leading-6 text-zinc-500">{contestProblem.theme}</p>}
                      </div>
                      {!isLocked && (
                        <div className="flex shrink-0 divide-x divide-white/10 border border-white/10 text-center sm:w-36">
                          <div className="flex-1 px-3 py-2.5">
                            <strong className="block text-base font-bold text-white">{problem?.solutions.length ?? 0}</strong>
                            <span className="text-[10px] text-zinc-500">解法</span>
                          </div>
                          <div className="flex-1 px-3 py-2.5">
                            <strong className="block text-base font-bold text-amber-300">
                              {contest.awards.filter((a) => a.problemId === contestProblem.problemId).length}
                            </strong>
                            <span className="text-[10px] text-zinc-500">获奖</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 border-t border-white/[0.07] px-4 pb-4 pt-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                        <CalendarDays className="size-3.5 shrink-0" />
                        {formatContestDateTime(contestProblem.openAt)} — {formatContestDateTime(contestProblem.closeAt)}（北京时间）
                      </span>
                      {isLocked ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                          <Lock className="size-3.5" />
                          {contestProblem.unlockMode === "auto_time" ? `${formatContestDateTime(contestProblem.openAt)}（北京时间）自动解锁` : "等待管理员解锁"}
                        </span>
                      ) : routeId ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/contests/${contest.slug}/problems/${routeId}`}
                            className="inline-flex h-8 items-center gap-1.5 border border-white/15 px-3 text-xs font-bold text-zinc-200 transition hover:border-cyan-400/40 hover:text-cyan-300"
                          >
                            进入题目
                            <ArrowUpRight className="size-3.5" />
                          </Link>
                          {contestProblem.problemPhase !== "sprint" && (contest.status === "active" || contest.status === "judging") && (
                            <Link
                              href={`/submit?contest=${contest.slug}&problem=${routeId}`}
                              className="inline-flex h-8 items-center gap-1.5 border border-amber-400/40 bg-amber-400/10 px-3 text-xs font-bold text-amber-300 transition hover:bg-amber-400/15"
                            >
                              提交解法
                            </Link>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-600">等待管理员关联题目</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <ContestThoughtArena
            contest={contest}
            thoughts={contestThoughts}
            problemTitles={problemTitles}
          />

          <ContestMyPanel
            contest={contest}
            problemTitles={problemTitles}
          />

          <section id="leaderboard" className="scroll-mt-24 border border-white/10 bg-zinc-950 p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Trophy className="size-4 text-amber-300" />
                实时积分榜
              </div>
              {scoreboard.length > 0 && (
                <span className="text-xs text-zinc-500">{scoreboard.length} 位参赛者 · 比赛总分</span>
              )}
            </div>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              普通题原始分 × 挑战倍率 + 计时题分 + 解答题分 + 奖励分 − 扣分。比赛进行中实时公开，不做延迟隐藏。
            </p>

            {scoreboard.length === 0 ? (
              <div className="mt-5 border border-white/10 bg-black/20 p-8 text-center">
                <Trophy className="mx-auto size-6 text-zinc-600" />
                <p className="mt-3 text-sm text-zinc-500">暂无评分数据。</p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[46rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-zinc-500">
                      <th className="py-2 pr-2 font-bold">排名</th>
                      <th className="py-2 pr-2 font-bold">用户</th>
                      <th className="py-2 pr-2 text-right font-bold">普通题原始分</th>
                      <th className="py-2 pr-2 text-right font-bold">挑战倍率</th>
                      <th className="py-2 pr-2 text-right font-bold">普通题结算分</th>
                      <th className="py-2 pr-2 text-right font-bold">计时题分</th>
                      <th className="py-2 pr-2 text-right font-bold">解答题分</th>
                      <th className="py-2 pr-2 text-right font-bold">奖励分</th>
                      <th className="py-2 pr-2 text-right font-bold">扣分</th>
                      <th className="py-2 pr-0 text-right font-bold">总分</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {scoreboard.map((row, index) => (
                      <tr key={row.userId} className={index < 3 ? "bg-amber-400/[0.03]" : undefined}>
                        <td className={`py-2 pr-2 font-mono font-bold ${index === 0 ? "text-amber-300" : index === 1 ? "text-zinc-300" : index === 2 ? "text-amber-700" : "text-zinc-600"}`}>
                          {index + 1}
                        </td>
                        <td className="py-2 pr-2 font-bold text-white">{row.displayName}</td>
                        <td className="py-2 pr-2 text-right tabular-nums text-zinc-300">{row.dailyRawScore.toFixed(1)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums text-cyan-300">{row.challengeMultiplier.toFixed(2)}x</td>
                        <td className="py-2 pr-2 text-right tabular-nums font-bold text-white">{row.dailyFinalScore.toFixed(1)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums text-zinc-300">{row.sprintScore.toFixed(1)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums text-zinc-300">{row.majorScore.toFixed(1)}</td>
                        <td className="py-2 pr-2 text-right tabular-nums text-emerald-300">
                          {row.awardPoints > 0 ? `+${row.awardPoints.toFixed(1)}` : "0"}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums text-red-300">
                          {row.penaltyPoints > 0 ? `-${row.penaltyPoints.toFixed(1)}` : "0"}
                        </td>
                        <td className="py-2 pr-0 text-right font-mono text-base font-bold tabular-nums text-amber-300">
                          {row.totalScore.toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="border border-white/10 bg-zinc-950 p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Trophy className="size-4 text-amber-300" />
                最佳解法榜
              </div>
              {useDbLeaderboard && (
                <span className="text-xs text-zinc-500">基于社区五维评分 · {leaderboard.solutions.length} 个参赛解法</span>
              )}
            </div>
            {!useDbLeaderboard && (
              <p className="mt-2 text-sm leading-6 text-zinc-500">
                参赛解法评分后显示在此处。比赛进行中展示专家评分作为参考。
              </p>
            )}
            {hideLeaderboard ? (
              <div className="mt-5 border border-amber-500/25 bg-amber-500/[0.08] p-8 text-center">
                <Trophy className="mx-auto size-6 text-amber-400" />
                <p className="mt-3 text-sm font-bold text-white">
                  {contest.status === "draft" ? "比赛尚未开始，榜单暂不展示" : "比赛进行中，榜单暂不展示"}
                </p>
                <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-zinc-500">
                  等进入评审阶段后再公开候选榜，避免参赛时被已有高分路线带偏。
                </p>
              </div>
            ) : useDbLeaderboard ? (
              <div className="mt-4 divide-y divide-white/[0.07] border border-white/10">
                {leaderboard.solutions.slice(0, 10).map((entry, index) => {
                  const problem = entry.problemId ? problemMap.get(entry.problemId) : undefined;
                  const contestProblem = contest.problems.find(
                    (cp) => cp.id === entry.contestProblemId || cp.problemId === entry.problemId
                  );
                  const typeLabel = entry.contestSolutionType
                    ? (contestSolutionTypeMeta[entry.contestSolutionType as keyof typeof contestSolutionTypeMeta]?.shortLabel ?? entry.contestSolutionType)
                    : null;
                  return (
                    <div
                      key={entry.solutionId}
                      className="grid items-center gap-3 px-4 py-3 transition hover:bg-white/[0.02] sm:grid-cols-[2.5rem_minmax(0,1fr)_6rem]"
                    >
                      <span className={`font-mono text-sm font-bold ${index === 0 ? "text-amber-300" : index === 1 ? "text-zinc-300" : index === 2 ? "text-amber-700" : "text-zinc-600"}`}>
                        {index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-white">{entry.title}</span>
                          {typeLabel && (
                            <span className="border border-cyan-400/30 bg-cyan-400/[0.07] px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">{typeLabel}</span>
                          )}
                          {entry.isPostContest && (
                            <span className="border border-zinc-600 px-1.5 py-0.5 text-[10px] text-zinc-400">赛后</span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs text-zinc-500">
                          {contestProblem && `Day ${contestProblem.dayIndex} · `}{problem?.title ?? "—"} · {entry.author}
                          {entry.ratingCount > 0 && <span className="text-zinc-600"> · {entry.ratingCount} 人</span>}
                        </span>
                      </span>
                      <span className="text-right">
                        {entry.ratingCount > 0 ? (
                          <span className="font-mono text-lg font-bold tabular-nums text-amber-300">{entry.avgTotal.toFixed(1)}</span>
                        ) : (
                          <span className="text-xs text-zinc-600">待评分</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : bestSolutions.length ? (
              <div className="mt-5 divide-y divide-white/10 border border-white/10">
                {bestSolutions.map(({ contestProblem, problem, solution, average }, index) => (
                  <Link
                    key={`${contestProblem.id}-${solution.id}`}
                    href={`/contests/${contest.slug}/problems/${problem.id}#${solution.id}`}
                    className="grid gap-3 bg-black/15 p-4 transition hover:bg-cyan-400/[0.04] sm:grid-cols-[3rem_minmax(0,1fr)_5rem]"
                  >
                    <span className="font-mono text-sm text-cyan-300">#{index + 1}</span>
                    <span className="min-w-0">
                      <span className="block font-bold text-white"><MathBlock>{solution.title}</MathBlock></span>
                      <span className="mt-1 block text-xs text-zinc-500">
                        Day {contestProblem.dayIndex} · {problem.title} · {solution.author}
                      </span>
                    </span>
                    <span className="font-display text-xl tabular-nums text-amber-300">{average.toFixed(1)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-5 border border-white/10 bg-black/20 p-8 text-center">
                <BookOpen className="mx-auto size-6 text-zinc-600" />
                <p className="mt-3 text-sm text-zinc-500">还没有可排序的解法。</p>
              </div>
            )}
          </section>

          {!hideLeaderboard && userRankings.length > 0 && (
            <section className="border border-white/10 bg-zinc-950 p-5 md:p-6">
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                <Crown className="size-4 text-amber-300" />
                用户总榜
              </div>
              <p className="mt-1 text-xs text-zinc-500">最高分解法 + 奖项加分</p>
              <div className="mt-4 divide-y divide-white/[0.07] border border-white/10">
                {userRankings.slice(0, 10).map((entry, index) => (
                  <div key={entry.userId} className="grid items-center gap-3 px-3 py-2.5 sm:grid-cols-[2rem_minmax(0,1fr)_5rem]">
                    <span className={`font-mono text-sm font-bold ${index === 0 ? "text-amber-300" : index === 1 ? "text-zinc-300" : index === 2 ? "text-amber-700/80" : "text-zinc-600"}`}>
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-white">{entry.author}</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        {entry.solutionCount} 个解法
                        {entry.awardPoints > 0 && <span className="text-amber-400/70"> · +{entry.awardPoints}分</span>}
                      </span>
                    </span>
                    <span className="text-right font-mono text-base font-bold tabular-nums text-amber-300">
                      {entry.grandTotal.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <ContestCountdown contest={contest} />

          <section className="border border-cyan-400/25 bg-cyan-400/[0.04] p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Swords className="size-4 text-cyan-300" />
              活动定位
            </div>
            <p className="mt-3 text-sm leading-7 text-zinc-400">
              ProofArena 思路擂台不是传统刷题比赛。在这里，我们不只看谁最先做出答案，也看谁的思路更清晰，谁的解法更优雅。
            </p>
          </section>

          <section className="border border-white/10 bg-zinc-950 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Crown className="size-4 text-amber-300" />
              获奖解法
            </div>
            {contest.awards.length ? (
              <div className="mt-4 space-y-3">
                {contest.awards.map((award) => {
                  const awardProblem = award.problemId ? problemMap.get(award.problemId) : undefined;
                  const awardContestProblem = award.problemId
                    ? contest.problems.find((cp) => cp.problemId === award.problemId)
                    : undefined;
                  return (
                    <div key={award.id} className="border border-amber-400/25 bg-amber-400/[0.04] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-amber-200">{award.title}</p>
                        {award.points > 0 && (
                          <span className="shrink-0 font-mono text-xs text-amber-300">+{award.points}分</span>
                        )}
                      </div>
                      {awardContestProblem && (
                        <p className="mt-1 text-xs text-zinc-600">
                          Day {awardContestProblem.dayIndex} · {awardProblem?.title ?? awardContestProblem.title}
                        </p>
                      )}
                      {award.reason && (
                        <p className="mt-2 text-xs leading-5 text-zinc-500">{award.reason}</p>
                      )}
                      {award.solutionId && awardProblem && (
                        <Link
                          href={`/contests/${contest.slug}/problems/${award.problemId}#${award.solutionId}`}
                          className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-300 hover:underline"
                        >
                          查看解法
                          <ArrowUpRight className="size-3" />
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-zinc-500">
                {contest.status === "finished" || contest.status === "judging"
                  ? "管理员正在整理获奖解法，请稍候。"
                  : "评审结束后，管理员标记的优秀解法会集中展示在这里。"}
              </p>
            )}
          </section>

          <section className="border border-white/10 bg-zinc-950 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <ClipboardList className="size-4 text-cyan-300" />
              赛后合集
            </div>
            {contest.status === "finished" && contest.awards.length > 0 ? (
              <div className="mt-4 space-y-3">
                {contest.problems.map((contestProblem) => {
                  const problemAwards = contest.awards.filter((a) => a.problemId === contestProblem.problemId);
                  if (problemAwards.length === 0) return null;
                  const problem = contestProblem.problemId ? problemMap.get(contestProblem.problemId) : undefined;
                  return (
                    <div key={contestProblem.id}>
                      <p className="text-xs font-bold text-zinc-400">Day {contestProblem.dayIndex} · {contestProblem.title}</p>
                      <div className="mt-2 space-y-1">
                        {problemAwards.map((award) => (
                          <div key={award.id} className="flex items-center gap-2 text-xs">
                            <span className="text-amber-300">★</span>
                            {award.solutionId && problem ? (
                              <Link
                                href={`/contests/${contest.slug}/problems/${problem.id}#${award.solutionId}`}
                                className="text-zinc-300 hover:text-white hover:underline"
                              >
                                {award.title}
                              </Link>
                            ) : (
                              <span className="text-zinc-400">{award.title}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-zinc-500">
                {contest.status === "finished"
                  ? "暂无赛后合集，等待管理员整理。"
                  : "比赛结束后，优秀解法会按题目整理成合集，回流到这里。"}
              </p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}
