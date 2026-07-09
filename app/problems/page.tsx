import { Suspense } from "react";
import { AlertTriangle, Target } from "lucide-react";
import { ProblemExplorer } from "@/components/ProblemExplorer";
import { ProblemExplorerSkeleton } from "@/components/ProblemCardSkeleton";
import { getProblemSummaries } from "@/lib/db";

export const revalidate = 3600;

export default async function ProblemsPage() {
  const problems = await getProblemSummaries();
  const solutionCount = problems.reduce(
    (sum, problem) => sum + problem.solutions.length,
    0,
  );
  const regionCount = new Set(problems.map((problem) => problem.region)).size;
  const dataNotice = problems.find((problem) => problem.dataNotice)?.dataNotice;

  return (
    <main className="grid-surface min-h-screen">
      <section className="border-b border-white/10 bg-zinc-950/80">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-cyan-300">
            <Target className="size-4" />
            2026 赛季
          </div>
          <div className="mt-4 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <h1 className="text-3xl font-black text-white sm:text-4xl md:text-5xl">
                题目擂台
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
                先按卷别或专题找到题，再进入详情比较不同解法。每题保留校订、复核与独立评分。
              </p>
            </div>
            <div className="grid w-full grid-cols-3 border border-white/10 bg-zinc-950 sm:w-auto">
              <div className="border-r border-white/10 px-4 py-3 text-center">
                <strong className="font-display block text-xl tabular-nums text-white">
                  {String(problems.length).padStart(2, "0")}
                </strong>
                <span className="text-[10px] text-zinc-600">真题</span>
              </div>
              <div className="border-r border-white/10 px-4 py-3 text-center">
                <strong className="font-display block text-xl tabular-nums text-cyan-300">
                  {String(regionCount).padStart(2, "0")}
                </strong>
                <span className="text-[10px] text-zinc-600">卷别</span>
              </div>
              <div className="px-4 py-3 text-center">
                <strong className="font-display block text-xl tabular-nums text-red-400">
                  {String(solutionCount).padStart(2, "0")}
                </strong>
                <span className="text-[10px] text-zinc-600">解法</span>
              </div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2 text-xs text-zinc-500">
            {["按卷别筛选", "按专题定位", "进入详情比较解法"].map((item) => (
              <span
                key={item}
                className="border border-white/10 bg-black/20 px-3 py-1.5"
              >
                {item}
              </span>
            ))}
          </div>
          {dataNotice && (
            <div className="mt-5 flex gap-3 border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3 text-sm leading-6 text-amber-100">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
              <span>{dataNotice}</span>
            </div>
          )}
        </div>
      </section>

      <Suspense fallback={<ProblemExplorerSkeleton />}>
        <ProblemExplorer problems={problems} />
      </Suspense>
    </main>
  );
}
