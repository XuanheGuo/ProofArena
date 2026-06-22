"use client";

import { useState } from "react";
import { BookOpen, Clock3, Crown, Focus, Lightbulb, MessageSquareQuote, MoveRight, Trophy } from "lucide-react";
import type { Solution } from "@/lib/types";
import { MathBlock } from "@/components/MathBlock";
import { ScoreBar } from "@/components/ScoreBar";
import { VerificationPanel } from "@/components/VerificationPanel";
import { getSolutionAverage } from "@/data/problems";

const scoreLabels: Array<[keyof Solution["scores"], string]> = [
  ["correctness", "正确性"],
  ["examReady", "考场性"],
  ["elegance", "优雅度"],
  ["calculation", "计算量"],
  ["explanation", "讲解友好"],
];

export function SolutionCard({ solution, rank }: { solution: Solution; rank: number }) {
  const [view, setView] = useState<"idea" | "transform" | "full">("transform");

  return (
    <article id={solution.id} className="scroll-mt-24 border border-white/10 bg-zinc-950">
      <header className="grid border-b border-white/10 lg:grid-cols-[7rem_1fr_auto]">
        <div className="flex items-center gap-3 border-b border-white/10 p-5 lg:flex-col lg:justify-center lg:border-r lg:border-b-0">
          {rank === 1 ? <Crown className="size-5 text-amber-300" /> : <Trophy className="size-5 text-zinc-500" />}
          <span className="font-display text-4xl font-black text-white">#{rank}</span>
        </div>
        <div className="p-5 lg:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-red-500 px-2 py-1 text-xs font-bold text-white">{solution.badge}</span>
            {solution.tags.map((tag) => (
              <span key={tag} className="border border-white/10 px-2 py-1 text-xs text-zinc-400">
                {tag}
              </span>
            ))}
          </div>
          <h2 className="mt-4 text-2xl font-bold text-white md:text-3xl">{solution.title}</h2>
          <p className="mt-2 text-sm text-zinc-500">
            {solution.author} <span className="mx-2 text-zinc-700">/</span> {solution.authorRole}
          </p>
        </div>
        <div className="flex items-center justify-between border-t border-white/10 px-5 py-4 lg:min-w-44 lg:flex-col lg:justify-center lg:border-t-0 lg:border-l">
          <span className="font-mono text-xs uppercase text-zinc-500">Arena score</span>
          <strong className="font-display text-4xl font-black text-cyan-300">
            {getSolutionAverage(solution).toFixed(1)}
          </strong>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-white/10 bg-black/20 p-3 md:px-7">
        {[
          ["idea", Lightbulb, "只看思路"],
          ["transform", Focus, "查看关键转化"],
          ["full", BookOpen, "展开完整解法"],
        ].map(([value, Icon, label]) => {
          const ViewIcon = Icon as typeof Lightbulb;
          const active = view === value;
          return (
            <button
              key={value as string}
              type="button"
              onClick={() => setView(value as typeof view)}
              aria-pressed={active}
              className={`inline-flex h-9 items-center gap-2 border px-3 text-xs font-semibold transition ${
                active
                  ? "border-cyan-400 bg-cyan-400 text-zinc-950"
                  : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-white"
              }`}
            >
              <ViewIcon className="size-3.5" />
              {label as string}
            </button>
          );
        })}
      </div>

      <div className={view === "full" ? "grid lg:grid-cols-[1fr_21rem]" : "block"}>
        <div className={`p-5 md:p-7 ${view === "full" ? "lg:border-r lg:border-white/10" : ""}`}>
          <div className={`grid gap-4 ${view !== "idea" ? "md:grid-cols-2" : ""}`}>
            {(view === "idea" || view === "transform" || view === "full") && (
            <div className="border-l-2 border-cyan-400 bg-cyan-400/5 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300">
                <Lightbulb className="size-4" />
                思路来源
              </div>
              <p className="mt-3 text-sm leading-7 text-zinc-300">
                <MathBlock>{solution.origin}</MathBlock>
              </p>
            </div>
            )}
            {(view === "transform" || view === "full") && (
            <div className="border-l-2 border-red-500 bg-red-500/5 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-300">
                <MoveRight className="size-4" />
                关键转化
              </div>
              <p className="mt-3 text-sm leading-7 text-zinc-300">
                <MathBlock>{solution.keyTransform}</MathBlock>
              </p>
            </div>
            )}
          </div>

          {view === "full" && <div className="mt-8">
            <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-white">完整解法摘要</h3>
              <span className="flex items-center gap-1.5 font-mono text-xs text-zinc-500">
                <Clock3 className="size-3.5" />
                约 {solution.estimatedMinutes} 分钟
              </span>
            </div>
            <ol className="space-y-5">
              {solution.summary.map((step, index) => (
                <li key={step} className="grid grid-cols-[2rem_1fr] gap-3 text-sm leading-7 text-zinc-300">
                  <span className="font-mono text-cyan-300">{String(index + 1).padStart(2, "0")}</span>
                  <p><MathBlock>{step}</MathBlock></p>
                </li>
              ))}
            </ol>
          </div>}
        </div>

        {view === "full" && <aside className="space-y-6 border-t border-white/10 p-5 md:p-7 lg:border-t-0">
          <div>
            <h3 className="mb-4 font-mono text-xs uppercase tracking-widest text-zinc-500">五维评分</h3>
            <div className="space-y-3.5">
              {scoreLabels.map(([key, label], index) => (
                <ScoreBar
                  key={key}
                  label={label}
                  value={solution.scores[key]}
                  tone={index === 1 ? "red" : index === 2 ? "amber" : "cyan"}
                />
              ))}
            </div>
          </div>
          <div className="border-l-2 border-amber-400 bg-amber-400/5 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <MessageSquareQuote className="size-4" />
              评分理由
            </div>
            <p className="mt-3 text-sm leading-7 text-zinc-300">{solution.scoringReason}</p>
          </div>
          <VerificationPanel verification={solution.verification} />
        </aside>}
      </div>
    </article>
  );
}
