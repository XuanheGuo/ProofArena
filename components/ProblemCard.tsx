import Link from "next/link";
import { ArrowUpRight, BookOpenCheck, Compass, Flame, Layers3, Sparkles, TimerReset } from "lucide-react";
import type { Problem } from "@/lib/types";
import { getBestSolution, getLearningIndex } from "@/data/problems";
import { MathBlock } from "@/components/MathBlock";

const difficultyStyles = {
  基础: "text-emerald-300 border-emerald-400/30",
  中档: "text-amber-300 border-amber-400/30",
  压轴: "text-red-300 border-red-400/30",
};

const typeStyles = {
  单选: "border-cyan-400/30 text-cyan-300",
  多选: "border-red-400/30 text-red-300",
  填空: "border-amber-400/30 text-amber-300",
  解答: "border-emerald-400/30 text-emerald-300",
};

export function ProblemCard({ problem, rank }: { problem: Problem; rank?: number }) {
  const examSolution = getBestSolution(problem, "examReady");
  const eleganceRanking = [...problem.solutions].sort((a, b) => b.scores.elegance - a.scores.elegance);
  const elegantSolution = eleganceRanking.find((solution) => solution.id !== examSolution.id) ?? eleganceRanking[0];

  return (
    <Link
      href={`/problems/${problem.id}`}
      className="group grid min-h-72 border border-white/10 bg-zinc-950/75 transition hover:border-cyan-400/45 hover:bg-zinc-900 md:grid-cols-[5.25rem_1fr]"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 md:flex-col md:border-r md:border-b-0 md:px-3">
        <span className="font-mono text-xs uppercase text-zinc-500">Case</span>
        <span className="font-display text-4xl font-black text-zinc-100">
          {String(rank ?? 1).padStart(2, "0")}
        </span>
        <ArrowUpRight className="size-5 text-zinc-600 transition group-hover:text-cyan-300" />
      </div>
      <div className="flex flex-col p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="bg-cyan-400 px-2 py-1 font-bold text-zinc-950">{problem.region}</span>
          <span className="font-mono text-zinc-500">{problem.year} · {problem.number}</span>
          <span className={`border px-2 py-1 ${typeStyles[problem.questionType]}`}>
            {problem.questionType}
          </span>
          <span className={`border px-2 py-1 ${difficultyStyles[problem.difficulty]}`}>
            {problem.difficulty}
          </span>
        </div>
        <h2 className="mt-5 text-2xl font-bold text-white transition group-hover:text-cyan-200">
          {problem.title}
        </h2>
        <p className="mt-3 line-clamp-2 text-sm leading-7 text-zinc-400">
          <MathBlock>{problem.statement[0]}</MathBlock>
        </p>
        <div className="mt-6 border border-white/10 bg-zinc-950/90">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
            <span className="flex items-center gap-2 text-xs font-bold text-white">
              <Compass className="size-3.5 text-cyan-300" />
              解法速览
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Choose a route</span>
          </div>
          <div className="grid items-stretch gap-px bg-white/10 sm:grid-cols-[1fr_1fr_7rem]">
            <div className="min-w-0 bg-zinc-950 p-3">
              <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <TimerReset className="size-3.5 text-red-400" />
                考场路线
              </span>
              <strong className="mt-1.5 block truncate text-xs text-zinc-200">{examSolution.title}</strong>
              <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-zinc-500">{examSolution.inspiration}</p>
            </div>
            <div className="min-w-0 bg-zinc-950 p-3">
              <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Sparkles className="size-3.5 text-amber-300" />
                启发路线
              </span>
              <strong className="mt-1.5 block truncate text-xs text-zinc-200">{elegantSolution.title}</strong>
              <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-zinc-500">{elegantSolution.inspiration}</p>
            </div>
            <div className="bg-zinc-950 p-3">
              <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <BookOpenCheck className="size-3.5 text-cyan-300" />
                学习指数
              </span>
              <strong className="mt-1 block font-display text-xl text-cyan-300">{getLearningIndex(problem)}</strong>
            </div>
          </div>
        </div>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-8">
          <div className="flex flex-wrap gap-2">
            {problem.tags.map((tag) => (
              <span key={tag} className="border border-white/10 px-2 py-1 text-xs text-zinc-400">
                #{tag}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-4 font-mono text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Layers3 className="size-3.5 text-cyan-300" />
              {problem.solutions.length} 解法
            </span>
            <span className="flex items-center gap-1.5">
              <Flame className="size-3.5 text-red-400" />
              {problem.heat}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
