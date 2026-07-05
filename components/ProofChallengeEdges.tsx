"use client";

import { useState } from "react";
import { ChevronDown, Swords } from "lucide-react";
import { MathBlock } from "@/components/MathBlock";
import type { Problem, ProofChallengeEdge, Solution } from "@/lib/types";

function solutionTitle(solutions: Solution[], id: string) {
  return solutions.find((s) => s.id === id)?.title ?? id;
}

function ChallengeCard({
  edge,
  solutions,
}: {
  edge: ProofChallengeEdge;
  solutions: Solution[];
}) {
  const challengerTitle = solutionTitle(solutions, edge.challengerSolutionId);
  const targetTitle = solutionTitle(solutions, edge.targetSolutionId);

  return (
    <div className="rounded border border-amber-400/20 bg-amber-400/[0.04] p-4">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="border border-cyan-400/30 bg-cyan-400/[0.06] px-2 py-1 font-bold text-cyan-200">
          {challengerTitle}
        </span>
        <Swords className="size-3.5 shrink-0 text-amber-400" />
        <span className="border border-white/10 px-2 py-1 text-zinc-400">{targetTitle}</span>
      </div>

      {/* Claim */}
      <p className="text-sm leading-6 text-zinc-200">
        <MathBlock>{edge.claim}</MathBlock>
      </p>

      {/* Advantages + Risk */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400/70">
            优势
          </span>
          <ul className="mt-1.5 space-y-1">
            {edge.advantages.map((adv) => (
              <li key={adv} className="border-l-2 border-emerald-400/40 pl-2 text-xs leading-5 text-zinc-400">
                <MathBlock>{adv}</MathBlock>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wide text-red-400/70">
            风险 / 代价
          </span>
          <p className="mt-1.5 border-l-2 border-red-400/40 pl-2 text-xs leading-5 text-zinc-400">
            <MathBlock>{edge.risk}</MathBlock>
          </p>
        </div>
      </div>

      {/* Reviewer note */}
      {edge.reviewerNote && (
        <p className="mt-3 border-t border-amber-400/10 pt-3 text-xs leading-5 text-zinc-500">
          <span className="font-bold text-zinc-400">编辑按：</span>
          <MathBlock>{edge.reviewerNote}</MathBlock>
        </p>
      )}
    </div>
  );
}

export function ProofChallengeEdges({ problem }: { problem: Problem }) {
  const [open, setOpen] = useState(false);
  const edges = problem.proofGraph?.challengeEdges ?? [];
  if (!edges.length) return null;

  return (
    <section className="border border-white/10">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 bg-black/20 px-4 py-3 text-left transition hover:bg-white/[0.03]"
      >
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <Swords className="size-4 text-amber-300" />
            解法挑战
            <span className="border border-amber-400/25 px-1.5 py-0.5 text-[10px] text-amber-200">
              {edges.length} 条
            </span>
          </h3>
          <p className="mt-0.5 text-xs text-zinc-600">
            哪条路线在特定维度上优于另一条，以及它的代价是什么。
          </p>
        </div>
        <ChevronDown className={`size-4 shrink-0 text-zinc-500 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="space-y-px border-t border-white/10 p-4">
          {edges.map((edge) => (
            <ChallengeCard key={edge.id} edge={edge} solutions={problem.solutions} />
          ))}
        </div>
      )}
    </section>
  );
}
