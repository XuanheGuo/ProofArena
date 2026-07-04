import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, ClipboardList, Swords, Trophy, UsersRound } from "lucide-react";
import { getProblems } from "@/lib/db";
import { contestStatusMeta } from "@/lib/contest-meta";
import { getContests, getContestSubmissionStats } from "@/lib/contests";

export const metadata: Metadata = {
  title: "比赛活动 | ProofArena",
  description: "ProofArena 思路擂台：围绕同一道题比较不同解法的活动与比赛。",
};

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function ContestsPage() {
  const [problems, contests] = await Promise.all([getProblems(), getContests()]);
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
                <strong className="font-display block text-2xl text-white">{contests.length}</strong>
                <span className="text-[11px] text-zinc-600">活动</span>
              </div>
              <div className="border-r border-white/10 p-3">
                <strong className="font-display block text-2xl text-cyan-300">
                  {contests.reduce((sum, contest) => sum + contest.problems.length, 0)}
                </strong>
                <span className="text-[11px] text-zinc-600">赛题</span>
              </div>
              <div className="p-3">
                <strong className="font-display block text-2xl text-amber-300">
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
              <article key={contest.id} className="border border-white/10 bg-zinc-950">
                <div className="border-b border-white/10 p-5 md:p-6">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`border px-2.5 py-1 font-bold ${status.className}`}>{status.label}</span>
                    <span className="border border-white/10 px-2.5 py-1 text-zinc-500">
                      {formatDate(contest.startAt)} - {formatDate(contest.endAt)}
                    </span>
                  </div>
                  <h2 className="mt-4 text-2xl font-black text-white">{contest.title}</h2>
                  <p className="mt-3 text-sm leading-7 text-zinc-400">{contest.description}</p>
                  <p className="mt-3 text-sm leading-7 text-zinc-300">{contest.tagline}</p>
                </div>
                <div className="grid grid-cols-3 border-b border-white/10 text-center">
                  <div className="border-r border-white/10 p-4">
                    <ClipboardList className="mx-auto size-4 text-cyan-300" />
                    <strong className="mt-2 block text-xl text-white">{linkedProblems.length}</strong>
                    <span className="text-[11px] text-zinc-600">题目</span>
                  </div>
                  <div className="border-r border-white/10 p-4">
                    <UsersRound className="mx-auto size-4 text-emerald-300" />
                    <strong className="mt-2 block text-xl text-white">
                      {(statsMap.get(contest.slug)?.participantCount ?? 0) > 0
                        ? statsMap.get(contest.slug)!.participantCount
                        : "—"}
                    </strong>
                    <span className="text-[11px] text-zinc-600">参与者</span>
                  </div>
                  <div className="p-4">
                    <Trophy className="mx-auto size-4 text-amber-300" />
                    <strong className="mt-2 block text-xl text-white">
                      {(statsMap.get(contest.slug)?.submissionCount ?? 0) > 0
                        ? statsMap.get(contest.slug)!.submissionCount
                        : (solutionCount > 0 ? solutionCount : "—")}
                    </strong>
                    <span className="text-[11px] text-zinc-600">
                      {(statsMap.get(contest.slug)?.submissionCount ?? 0) > 0 ? "参赛解法" : "可比较解法"}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between md:p-6">
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <CalendarDays className="size-4" />
                    7 天 / 6 道题 / 1 天评审总结
                  </div>
                  <Link
                    href={`/contests/${contest.slug}`}
                    className="inline-flex h-10 items-center justify-center gap-2 bg-cyan-400 px-4 text-sm font-bold text-zinc-950 transition hover:bg-cyan-300"
                  >
                    进入比赛
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
