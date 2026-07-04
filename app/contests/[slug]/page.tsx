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
import { contestStatusMeta, contestSolutionTypeMeta } from "@/lib/contest-meta";
import { getContest, getContestLeaderboard, getContestSubmissionStats, getContestUserRankings } from "@/lib/contests";
import { getProblems, getSolutionAverage } from "@/lib/db";
import { difficultyBadgeClass } from "@/lib/problem-presentation";
import { getEffectiveProblemStatus } from "@/lib/types";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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

  const [problems, leaderboard, contestStats, userRankings] = await Promise.all([
    getProblems(),
    getContestLeaderboard(slug),
    getContestSubmissionStats(slug),
    getContestUserRankings(slug, contest.awards),
  ]);
  const problemMap = new Map(problems.map((problem) => [problem.id, problem]));
  const linkedContestProblems = contest.problems.map((contestProblem) => ({
    contestProblem,
    problem: contestProblem.problemId ? problemMap.get(contestProblem.problemId) : undefined,
  }));
  const solutionCount = linkedContestProblems.reduce((sum, item) => sum + (item.problem?.solutions.length ?? 0), 0);
  const bestSolutions = linkedContestProblems
    .flatMap(({ contestProblem, problem }) => {
      if (!problem) return [];
      return problem.solutions.map((solution) => ({
        contestProblem,
        problem,
        solution,
        average: getSolutionAverage(solution),
      }));
    })
    .sort((a, b) => b.average - a.average)
    .slice(0, 5);
  const now = new Date();
  const status = contestStatusMeta[contest.status];
  const linkedWithStatus = linkedContestProblems.map((item) => ({
    ...item,
    effectiveStatus: getEffectiveProblemStatus(item.contestProblem, now),
  }));
  const todayProblem = linkedWithStatus.find(({ effectiveStatus }) => effectiveStatus === "open")?.contestProblem;
  const hideLeaderboard = contest.status === "active";
  const useDbLeaderboard = leaderboard.solutions.length > 0;

  return (
    <main className="grid-surface min-h-screen">
      <section className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
          <Link href="/contests" className="inline-flex items-center gap-2 text-sm text-zinc-500 transition hover:text-white">
            <ArrowLeft className="size-4" />
            返回比赛列表
          </Link>
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className={`border px-2.5 py-1 font-bold ${status.className}`}>{status.label}</span>
                <span className="border border-white/10 px-2.5 py-1 text-zinc-500">
                  {formatDateTime(contest.startAt)} - {formatDateTime(contest.endAt)}
                </span>
              </div>
              <h1 className="mt-5 text-3xl font-black leading-tight text-white sm:text-4xl md:text-5xl">{contest.title}</h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-zinc-300">{contest.tagline}</p>
              <p className="mt-2 text-sm leading-7 text-zinc-500">{contest.description}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {todayProblem?.problemId && (
                  <Link
                    href={`/problems/${todayProblem.problemId}?contest=${contest.slug}`}
                    className="inline-flex h-10 items-center gap-2 bg-cyan-400 px-5 text-sm font-bold text-zinc-950 transition hover:bg-cyan-300"
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
            <div className="grid grid-cols-3 divide-x divide-white/10 border border-white/10 bg-black/30">
              <div className="p-4 text-center">
                <strong className="font-display block text-2xl text-cyan-300">{contest.problems.length}</strong>
                <span className="mt-1 block text-[11px] text-zinc-500">赛题</span>
              </div>
              <div className="p-4 text-center">
                <strong className="font-display block text-2xl text-emerald-300">
                  {contestStats.participantCount > 0 ? contestStats.participantCount : (solutionCount > 0 ? solutionCount : "—")}
                </strong>
                <span className="mt-1 block text-[11px] text-zinc-500">
                  {contestStats.participantCount > 0 ? "参与者" : "现有解法"}
                </span>
              </div>
              <div className="p-4 text-center">
                <strong className="font-display block text-2xl text-amber-300">
                  {contestStats.submissionCount > 0 ? contestStats.submissionCount : contest.awards.length}
                </strong>
                <span className="mt-1 block text-[11px] text-zinc-500">
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
                <p className="mt-1 text-sm text-zinc-500">第一期题目可以继续通过 seed 或后台调整，不影响活动页面结构。</p>
              </div>
            </div>
            <div className="grid gap-3">
              {linkedWithStatus.map(({ contestProblem, problem, effectiveStatus }) => {
                const isLocked = effectiveStatus === "locked";
                return (
                  <article key={contestProblem.id} className={`border bg-zinc-950 transition ${isLocked ? "border-white/[0.06] opacity-50" : "border-white/10 hover:border-white/20"}`}>
                    <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="bg-cyan-400 px-2 py-0.5 font-bold text-zinc-950">Day {contestProblem.dayIndex}</span>
                          <span className="border border-white/15 px-2 py-0.5 text-zinc-400">{contestProblem.title}</span>
                          {problem && !isLocked && <span className={`border px-2 py-0.5 ${difficultyBadgeClass[problem.difficulty]}`}>{problem.difficulty}</span>}
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
                          {isLocked ? contestProblem.theme : (problem?.title ?? "题目待关联")}
                        </h3>
                        <p className="mt-1.5 text-sm leading-6 text-zinc-500">{contestProblem.theme}</p>
                      </div>
                      {!isLocked && (
                        <div className="flex shrink-0 divide-x divide-white/10 border border-white/10 text-center sm:w-40">
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
                        {formatDateTime(contestProblem.openAt)} — {formatDateTime(contestProblem.closeAt)}
                      </span>
                      {isLocked ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                          <Lock className="size-3.5" />
                          {contestProblem.unlockMode === "auto_time" ? `${formatDateTime(contestProblem.openAt)} 自动解锁` : "等待管理员解锁"}
                        </span>
                      ) : problem ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/problems/${problem.id}?contest=${contest.slug}`}
                            className="inline-flex h-8 items-center gap-1.5 border border-white/15 px-3 text-xs font-bold text-zinc-200 transition hover:border-cyan-400/40 hover:text-cyan-300"
                          >
                            进入题目
                            <ArrowUpRight className="size-3.5" />
                          </Link>
                          {(contest.status === "active" || contest.status === "judging") && (
                            <Link
                              href={`/submit?contest=${contest.slug}&problem=${problem.id}`}
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

          <section id="leaderboard" className="scroll-mt-24 border border-white/10 bg-zinc-950 p-5 md:p-6">
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
                <p className="mt-3 text-sm font-bold text-white">比赛进行中，榜单暂不展示</p>
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
                          <span className="font-mono text-lg font-bold text-amber-300">{entry.avgTotal.toFixed(1)}</span>
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
                    href={`/problems/${problem.id}?contest=${contest.slug}#${solution.id}`}
                    className="grid gap-3 bg-black/15 p-4 transition hover:bg-cyan-400/[0.04] sm:grid-cols-[3rem_minmax(0,1fr)_5rem]"
                  >
                    <span className="font-mono text-sm text-cyan-300">#{index + 1}</span>
                    <span className="min-w-0">
                      <span className="block font-bold text-white">{solution.title}</span>
                      <span className="mt-1 block text-xs text-zinc-500">
                        Day {contestProblem.dayIndex} · {problem.title} · {solution.author}
                      </span>
                    </span>
                    <span className="font-display text-xl text-amber-300">{average.toFixed(1)}</span>
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
                    <span className="text-right font-mono text-base font-bold text-amber-300">
                      {entry.grandTotal.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
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
                          href={`/problems/${award.problemId}?contest=${contest.slug}#${award.solutionId}`}
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
                                href={`/problems/${problem.id}?contest=${contest.slug}#${award.solutionId}`}
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
