import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, ClipboardList, Swords, Trophy, UsersRound } from "lucide-react";
import { getProblemSummaries } from "@/lib/db";
import { contestStatusMeta } from "@/lib/contest-meta";
import { getContests, getContestSubmissionStats } from "@/lib/contests";
import { formatContestDateTime } from "@/lib/format-contest-time";

export const metadata: Metadata = {
  title: "比赛活动 | ProofArena",
  description: "ProofArena 思路擂台：围绕同一道题比较不同解法的活动与比赛。",
};

// Keep in step with the contest detail page's 60s window so the list's
// status chips don't lag noticeably behind an opening/closing contest.
export const revalidate = 60;

export default async function ContestsPage() {
  const [problems, contests] = await Promise.all([getProblemSummaries(), getContests()]);
  const problemMap = new Map(problems.map((problem) => [problem.id, problem]));

  const statsPerContest = await Promise.all(
    contests.map((contest) => getContestSubmissionStats(contest.slug))
  );
  const statsMap = new Map(contests.map((contest, index) => [contest.slug, statsPerContest[index]]));

  return (
    <main className="grid-surface min-h-screen">
      <section className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-cyan-300">
            <Swords className="size-4" />
            ProofArena contests
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
            <div>
              <h1 className="text-3xl font-black text-white sm:text-4xl md:text-5xl">比赛活动</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
                这里不是刷题计时器，而是把同一道题的不同理解放到同一个场域里比较、评分、讨论和沉淀。
              </p>
            </div>
            <div className="grid grid-cols-3 border border-white/10 bg-zinc-950 text-center">
              <div className="border-r border-white/10 p-3">
                <strong className="font-display block text-2xl tabular-nums text-white">{contests.length}</strong>
                <span className="text-[11px] text-zinc-600">活动</span>
              </div>
              <div className="border-r border-white/10 p-3">
                <strong className="font-display block text-2xl tabular-nums text-cyan-300">
                  {contests.reduce((sum, contest) => sum + contest.problems.length, 0)}
                </strong>
                <span className="text-[11px] text-zinc-600">赛题</span>
              </div>
              <div className="p-3">
                <strong className="font-display block text-2xl tabular-nums text-amber-300">
                  {contests.reduce(
                    (sum, contest) =>
                      sum +
                      contest.problems.reduce((inner, contestProblem) => {
                        const problem = contestProblem.problemId ? problemMap.get(contestProblem.problemId) : null;
                        return inner + (problem?.solutions.length ?? 0);
                      }, 0),
                    0,
                  )}
                </strong>
                <span className="text-[11px] text-zinc-600">现有解法</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
        {contests.length === 0 ? (
          <div className="border border-white/10 bg-zinc-950 px-6 py-16 text-center">
            <Swords className="mx-auto size-8 text-zinc-600" />
            <h2 className="mt-4 text-lg font-bold text-white">暂时还没有比赛</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
              第一届思路擂台即将开始。届时可以从这里进入比赛，围绕同一道题提交和评比解法。
            </p>
          </div>
        ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {contests.map((contest) => {
            const status = contestStatusMeta[contest.status];
            const linkedProblems = contest.problems.filter((cp) => cp.problemId || cp.draftProblemId);
            const stats = statsMap.get(contest.slug);
            const solutionCount = linkedProblems.reduce((sum, cp) => {
              const p = cp.problemId ? problemMap.get(cp.problemId) : null;
              return sum + (p?.solutions.length ?? 0);
            }, 0);
            const isActive = contest.status === "active";
            const isDraft = contest.status === "draft";

            return (
              <article
                key={contest.id}
                className={`group relative flex flex-col overflow-hidden border bg-zinc-950 transition hover:border-white/25 ${
                  isActive ? "border-emerald-500/30" : "border-white/10"
                }`}
              >
                {/* Active pulse stripe */}
                {isActive && (
                  <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />
                )}

                <div className="flex-1 px-5 pt-5 pb-4 md:px-6 md:pt-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`border px-2.5 py-0.5 text-[11px] font-bold ${status.className}`}>
                      {status.label}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                      <CalendarDays className="size-3" />
                      {formatContestDateTime(contest.startAt)} – {formatContestDateTime(contest.endAt)}（北京时间）
                    </span>
                  </div>

                  <h2 className="mt-4 text-xl font-black leading-snug text-white group-hover:text-cyan-50 sm:text-2xl">
                    {contest.title}
                  </h2>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-400">{contest.tagline}</p>
                  {contest.description && (
                    <p className="mt-1.5 text-xs text-zinc-600">{contest.description}</p>
                  )}
                </div>

                {/* Stats bar */}
                <div className="grid grid-cols-3 divide-x divide-white/[0.06] border-t border-white/[0.06] bg-black/20">
                  <div className="flex flex-col items-center gap-0.5 px-3 py-3">
                    <ClipboardList className="size-3.5 text-cyan-400/70" />
                    <strong className="font-mono text-base font-bold tabular-nums text-white">
                      {linkedProblems.length}
                    </strong>
                    <span className="text-[10px] text-zinc-600">赛题</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 px-3 py-3">
                    <UsersRound className="size-3.5 text-emerald-400/70" />
                    <strong className="font-mono text-base font-bold tabular-nums text-white">
                      {stats?.participantCount ?? 0}
                    </strong>
                    <span className="text-[10px] text-zinc-600">参与者</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 px-3 py-3">
                    <Trophy className="size-3.5 text-amber-400/70" />
                    <strong className="font-mono text-base font-bold tabular-nums text-white">
                      {(stats?.submissionCount ?? 0) > 0 ? stats!.submissionCount : solutionCount > 0 ? solutionCount : "—"}
                    </strong>
                    <span className="text-[10px] text-zinc-600">
                      {(stats?.submissionCount ?? 0) > 0 ? "投稿" : "解法"}
                    </span>
                  </div>
                </div>

                {/* Footer CTA */}
                <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3 md:px-6">
                  {isDraft ? (
                    <span className="text-xs text-zinc-600">比赛尚未开始，敬请期待</span>
                  ) : (
                    <span className="text-xs text-zinc-600">{contest.awards.length} 个奖项</span>
                  )}
                  <Link
                    href={`/contests/${contest.slug}`}
                    className={`inline-flex shrink-0 items-center gap-1.5 px-4 py-2 text-sm font-bold transition ${
                      isActive
                        ? "bg-emerald-400 text-zinc-950 hover:bg-emerald-300"
                        : "bg-cyan-400 text-zinc-950 hover:bg-cyan-300"
                    }`}
                  >
                    {isActive ? "进入比赛" : "查看详情"}
                    <ArrowUpRight className="size-3.5" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
        )}
      </section>
    </main>
  );
}
