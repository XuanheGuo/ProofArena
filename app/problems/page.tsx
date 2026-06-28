import { Target } from "lucide-react";
import { ProblemExplorer } from "@/components/ProblemExplorer";
import { problems } from "@/data/problems";

export default function ProblemsPage() {
  const solutionCount = problems.reduce((sum, problem) => sum + problem.solutions.length, 0);
  const regionCount = new Set(problems.map((problem) => problem.region)).size;

  return (
    <main className="grid-surface min-h-screen">
      <section className="border-b border-white/10 bg-zinc-950/80">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-cyan-300">
            <Target className="size-4" />
            2026 赛季
          </div>
          <div className="mt-4 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <h1 className="text-4xl font-black text-white md:text-5xl">题目擂台</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
                2026 高考数学真题精编专场。每题保留经过校订、复核与独立评分的一题多解。
              </p>
            </div>
            <div className="grid grid-cols-3 border border-white/10 bg-zinc-950">
              <div className="border-r border-white/10 px-4 py-3 text-center">
                <strong className="font-display block text-xl text-white">{String(problems.length).padStart(2, "0")}</strong>
                <span className="text-[10px] text-zinc-600">真题</span>
              </div>
              <div className="border-r border-white/10 px-4 py-3 text-center">
                <strong className="font-display block text-xl text-cyan-300">{String(regionCount).padStart(2, "0")}</strong>
                <span className="text-[10px] text-zinc-600">卷别</span>
              </div>
              <div className="px-4 py-3 text-center">
                <strong className="font-display block text-xl text-red-400">{String(solutionCount).padStart(2, "0")}</strong>
                <span className="text-[10px] text-zinc-600">解法</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ProblemExplorer problems={problems} />
    </main>
  );
}
