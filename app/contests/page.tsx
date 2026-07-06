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

export const revalidate = 300;

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
        <div className="grid gap-4 lg:grid-cols-2">
          {contests.map((contest) => {
            const status = contestStatusMeta[contest.status];
            const linkedProblems = contest.problems.filter((contestProblem) => contestProblem.problemId);
            const solutionCount = linkedProblems.reduce((sum, contestProblem) => {
              const problem = contestProblem.problemId ? problemMap.get(contestProblem.problemId) : null;
              return sum + (problem?.solutions.length ?? 0);
            }, 0);

            return (
              <article key={contest.id} className="flex flex-col border border-white/10 bg-zinc-950 transition hover:border-white/20">
                <div className="flex-1 p-5 md:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`border px-2 py-0.5 text-[11px] font-bold ${status.className}`}>{status.label}</span>
                    <span className="text-[11px] text-zinc-500">
                      {formatContestDateTime(contest.startAt)} – {formatContestDateTime(contest.endAt)}（北京时间）
                    </span>
                  </div>
                  <h2 className="mt-4 text-xl font-black leading-snug text-white sm:text-2xl">{contest.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{contest.tagline}</p>
                </div>
                <div className="grid grid-cols-3 divide-x divide-white/[0.07] border-y border-white/[0.07]">
                  <div className="p-3 text-center">
                    <ClipboardList className="mx-auto size-4 text-cyan-400" />
                    <strong className="mt-1.5 block text-lg font-bold tabular-nums text-white">{linkedProblems.length}</strong>
                    <span className="text-[10px] text-zinc-500">题目</span>
                  </div>
                  <div className="p-3 text-center">
                    <UsersRound className="mx-auto size-4 text-emerald-400" />
                    <strong className="mt-1.5 block text-lg font-bold tabular-nums text-white">
                      {(statsMap.get(contest.slug)?.participantCount ?? 0) > 0
                        ? statsMap.get(contest.slug)!.participantCount
                        : "—"}
                    </strong>
                    <span className="text-[10px] text-zinc-500">参与者</span>
                  </div>
                  <div className="p-3 text-center">
                    <Trophy className="mx-auto size-4 text-amber-400" />
                    <strong className="mt-1.5 block text-lg font-bold tabular-nums text-white">
                      {(statsMap.get(contest.slug)?.submissionCount ?? 0) > 0
                        ? statsMap.get(contest.slug)!.submissionCount
                        : (solutionCount > 0 ? solutionCount : "—")}
                    </strong>
                    <span className="text-[10px] text-zinc-500">
                      {(statsMap.get(contest.slug)?.submissionCount ?? 0) > 0 ? "投稿" : "解法"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 p-4 md:px-5">
                  <span className="text-xs text-zinc-500">{contest.description}</span>
                  <Link
                    href={`/contests/${contest.slug}`}
                    className="inline-flex shrink-0 items-center gap-1.5 bg-cyan-400 px-4 py-2 text-sm font-bold text-zinc-950 transition hover:bg-cyan-300"
                  >
                    进入
                    <ArrowUpRight className="size-4" />
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
