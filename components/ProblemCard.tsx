import Link from "next/link";
import {
  ArrowUpRight,
  BookOpenCheck,
  Compass,
  Flame,
  Layers3,
  NetworkIcon,
  Sparkles,
  TimerReset,
} from "lucide-react";
import type { ProblemSummary } from "@/lib/types";
import { getBestSolution, getLearningIndex } from "@/lib/db";
import { MathBlock } from "@/components/MathBlock";
import { difficultyBadgeClass } from "@/lib/problem-presentation";
import { VerificationBadge } from "@/components/VerificationPanel";

// Reads [data-theme] CSS variables directly (app/globals.css) rather than
// hardcoded Tailwind color literals, so it can't silently fall out of the
// light/dark override whitelist — see docs/UI_UX_AUDIT.md A2.
const typeStyles = {
  单选: "border-[var(--accent-border)] text-[var(--accent)]",
  多选: "border-[var(--danger-border)] text-[var(--danger)]",
  填空: "border-[var(--contest-border)] text-[var(--contest)]",
  解答: "border-[var(--verified-border)] text-[var(--verified)]",
};

export function ProblemCard({
  problem,
  rank,
  compact = false,
}: {
  problem: ProblemSummary;
  rank?: number;
  compact?: boolean;
}) {
  const examSolution = getBestSolution(problem, "examReady");
  const eleganceRanking = [...problem.solutions].sort(
    (a, b) => b.scores.elegance - a.scores.elegance,
  );
  const elegantSolution =
    eleganceRanking.find((solution) => solution.id !== examSolution.id) ??
    eleganceRanking[0];

  return (
    <Link
      href={`/problems/${problem.id}`}
      className={`interactive-lift surface-panel group grid ${compact ? "" : "min-h-72"} overflow-hidden hover:border-cyan-400/45 md:grid-cols-[5.25rem_minmax(0,1fr)]`}
    >
      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-5 py-4 md:flex-col md:border-r md:border-b-0 md:px-3">
        <span className="font-mono text-xs uppercase text-zinc-500">题目</span>
        <span className="font-display text-4xl font-black text-zinc-100">
          {String(rank ?? 1).padStart(2, "0")}
        </span>
        <span className="grid size-8 place-items-center border border-white/10 text-zinc-600 transition group-hover:border-cyan-400/35 group-hover:bg-cyan-400/10 group-hover:text-cyan-300">
          <ArrowUpRight className="size-4" />
        </span>
      </div>
      <div className="flex flex-col p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="pill-button bg-cyan-400 px-2 py-1 font-bold text-zinc-950">
            {problem.region}
          </span>
          <span className="font-mono text-zinc-500">
            {problem.year} · {problem.number}
          </span>
          <span
            className={`border px-2 py-1 ${typeStyles[problem.questionType]}`}
          >
            {problem.questionType}
          </span>
          <span
            className={`border px-2 py-1 ${difficultyBadgeClass[problem.difficulty]}`}
          >
            {problem.difficulty}
          </span>
          {problem.hasProofGraph && (
            <span className="inline-flex items-center gap-1 border border-violet-400/30 bg-violet-400/[0.06] px-2 py-1 text-[10px] font-bold text-violet-300">
              <NetworkIcon className="size-3" />
              推理图谱
            </span>
          )}
        </div>
        <h2 className="mt-5 text-xl font-bold leading-8 text-white transition group-hover:text-cyan-200 sm:text-2xl">
          {problem.title}
        </h2>
        <p className="mt-3 line-clamp-2 text-sm leading-7 text-zinc-400">
          <MathBlock>{problem.excerpt}</MathBlock>
        </p>
        <div
          className={`surface-panel-subtle mt-6 ${compact ? "hidden" : "hidden md:block"} overflow-hidden`}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2.5">
            <span className="flex items-center gap-2 text-xs font-bold text-white">
              <Compass className="size-3.5 text-cyan-300" />
              解法速览
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              选择解法
            </span>
          </div>
          <div className="grid items-stretch gap-px bg-white/10 sm:grid-cols-[1fr_1fr_7rem]">
            <div className="min-w-0 bg-zinc-950 p-3">
              <span className="flex items-center justify-between gap-1.5 text-[11px] text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <TimerReset className="size-3.5 text-red-400" />
                  标准解
                </span>
                <VerificationBadge status={examSolution.verificationStatus} />
              </span>
              <strong className="mt-1.5 block truncate text-xs text-zinc-200">
                <MathBlock>{examSolution.title}</MathBlock>
              </strong>
              <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-zinc-500">
                <MathBlock>{examSolution.inspiration}</MathBlock>
              </p>
            </div>
            <div className="min-w-0 bg-zinc-950 p-3">
              <span className="flex items-center justify-between gap-1.5 text-[11px] text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-amber-300" />
                  启发解
                </span>
                <VerificationBadge
                  status={elegantSolution.verificationStatus}
                />
              </span>
              <strong className="mt-1.5 block truncate text-xs text-zinc-200">
                <MathBlock>{elegantSolution.title}</MathBlock>
              </strong>
              <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-zinc-500">
                <MathBlock>{elegantSolution.inspiration}</MathBlock>
              </p>
            </div>
            <div className="bg-zinc-950 p-3">
              <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <BookOpenCheck className="size-3.5 text-cyan-300" />
                学习指数
              </span>
              <strong className="mt-1 block font-display text-xl tabular-nums text-cyan-300">
                {getLearningIndex(problem)}
              </strong>
            </div>
          </div>
        </div>
        <div
          className={`mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 ${compact ? "" : "md:hidden"}`}
        >
          <span className="text-xs text-zinc-500">
            {problem.solutions.length} 条解法
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-300">
            进入详情
            <ArrowUpRight className="size-3.5" />
          </span>
        </div>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-8">
          <div className="flex flex-wrap gap-2">
            {problem.tags.map((tag) => (
              <span
                key={tag}
                className="border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-zinc-400"
              >
                #{tag}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-zinc-400">
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
