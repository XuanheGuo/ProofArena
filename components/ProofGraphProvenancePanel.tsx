"use client";

import { useState } from "react";
import { ChevronDown, GitBranch, GitCommitHorizontal, Link2, Swords, Users } from "lucide-react";
import { MathBlock } from "@/components/MathBlock";
import type { Problem, ProofChallengeEdge, ProofMethodBoundary, ProofObservation, ProofTransformation, Solution } from "@/lib/types";

function solutionTitle(solutions: Solution[], id: string) {
  return solutions.find((s) => s.id === id)?.title ?? id;
}

// ── section shell ─────────────────────────────────────────────────────────────

function SectionBlock({
  icon: Icon,
  title,
  note,
  children,
}: {
  icon: React.ElementType;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300">
          <Icon className="size-3.5 text-zinc-500" />
          {title}
        </div>
        {note && <span className="text-[10px] text-zinc-600">{note}</span>}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

// ── 观察 · 关联解法 ──────────────────────────────────────────────────────────

function ObservationProvenance({ observations, solutions }: { observations: ProofObservation[]; solutions: Solution[] }) {
  return (
    <>
      {observations.map((obs) => (
        <div key={obs.id} className="rounded border border-white/10 bg-zinc-950 p-3">
          <p className="text-sm font-bold text-zinc-200">
            <MathBlock>{obs.title}</MathBlock>
          </p>
          <p className="mt-0.5 text-xs leading-5 text-zinc-500">
            <MathBlock>{obs.signal}</MathBlock>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-zinc-600">关联解法：</span>
            {obs.relatedSolutionIds.length > 0 ? (
              obs.relatedSolutionIds.map((id) => (
                <span
                  key={id}
                  className="border border-cyan-400/25 bg-cyan-400/[0.06] px-1.5 py-0.5 text-[10px] text-cyan-300"
                >
                  {solutionTitle(solutions, id)}
                </span>
              ))
            ) : (
              <span className="text-[10px] text-zinc-600">暂无关联解法</span>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

// ── 转化 · 来自路线 ──────────────────────────────────────────────────────────

function TransformationProvenance({ transformations, solutions }: { transformations: ProofTransformation[]; solutions: Solution[] }) {
  return (
    <>
      {transformations.map((t) => (
        <div key={t.id} className="flex flex-wrap items-start justify-between gap-2 rounded border border-white/10 bg-zinc-950 p-3">
          <p className="min-w-0 flex-1 text-xs leading-5 text-zinc-300">
            <MathBlock>{t.title}</MathBlock>
          </p>
          <span className="shrink-0 border border-emerald-400/25 bg-emerald-400/[0.06] px-1.5 py-0.5 text-[10px] text-emerald-300">
            {solutionTitle(solutions, t.solutionId)}
          </span>
        </div>
      ))}
    </>
  );
}

// ── 挑战关系 ─────────────────────────────────────────────────────────────────

function ChallengeProvenance({ edges, solutions }: { edges: ProofChallengeEdge[]; solutions: Solution[] }) {
  return (
    <>
      {edges.map((e) => (
        <div key={e.id} className="rounded border border-white/10 bg-zinc-950 p-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="border border-cyan-400/30 bg-cyan-400/[0.06] px-1.5 py-0.5 font-bold text-cyan-200">
              {solutionTitle(solutions, e.challengerSolutionId)}
            </span>
            <span className="text-zinc-600">→</span>
            <span className="border border-white/10 px-1.5 py-0.5 text-zinc-400">
              {solutionTitle(solutions, e.targetSolutionId)}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-5 text-zinc-400">
            <MathBlock>{e.claim}</MathBlock>
          </p>
        </div>
      ))}
    </>
  );
}

// ── 编辑沉淀 ─────────────────────────────────────────────────────────────────

function MethodBoundaryProvenance({ boundaries }: { boundaries: ProofMethodBoundary[] }) {
  return (
    <>
      {boundaries.map((b) => (
        <div key={b.id} className="rounded border border-amber-400/20 bg-amber-400/[0.04] p-3">
          <p className="text-sm font-bold text-zinc-200">{b.methodName}</p>
          <p className="mt-0.5 text-xs leading-5 text-zinc-400">
            <MathBlock>{b.whyNotPriority}</MathBlock>
          </p>
        </div>
      ))}
    </>
  );
}

// ── Fork 链接 ────────────────────────────────────────────────────────────────

function ForkProvenance({ solutions }: { solutions: Solution[] }) {
  const forked = solutions.filter((s) => s.thinkingCues?.forkOf);
  return (
    <>
      {forked.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-2 rounded border border-white/10 bg-zinc-950 p-3 text-xs">
          <a href={`#${s.id}`} className="border border-violet-400/30 bg-violet-400/[0.06] px-1.5 py-0.5 text-violet-300 hover:bg-violet-400/10">
            <MathBlock>{s.title}</MathBlock>
          </a>
          <span className="text-zinc-600">← fork 自</span>
          <a
            href={`#${s.thinkingCues.forkOf!.solutionId}`}
            className="border border-white/10 px-1.5 py-0.5 text-zinc-400 hover:border-violet-400/30 hover:text-violet-300"
          >
            <MathBlock>{s.thinkingCues.forkOf!.solutionTitle}</MathBlock>
          </a>
        </div>
      ))}
    </>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export function ProofGraphProvenancePanel({ problem }: { problem: Problem }) {
  const pg = problem.proofGraph;
  const [open, setOpen] = useState(false);

  if (!pg) return null;

  const forkedSolutions = problem.solutions.filter((s) => s.thinkingCues?.forkOf);

  const hasContent =
    pg.observations.length > 0 ||
    pg.transformations.length > 0 ||
    pg.challengeEdges.length > 0 ||
    pg.methodBoundaries.length > 0 ||
    forkedSolutions.length > 0;

  if (!hasContent) return null;

  return (
    <section className="border border-white/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 bg-black/20 px-4 py-3 text-left"
      >
        <div>
          <h3 className="text-sm font-bold text-white">图谱来源</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            这些关系来自已发布解法、挑战关系和编辑沉淀。
          </p>
        </div>
        <ChevronDown
          className={`size-4 shrink-0 text-zinc-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="space-y-5 border-t border-white/10 p-4 md:p-6">
          {pg.observations.length > 0 && (
            <SectionBlock icon={Users} title="观察 · 关联解法">
              <ObservationProvenance observations={pg.observations} solutions={problem.solutions} />
            </SectionBlock>
          )}

          {pg.transformations.length > 0 && (
            <SectionBlock icon={GitCommitHorizontal} title="转化 · 来自路线">
              <TransformationProvenance transformations={pg.transformations} solutions={problem.solutions} />
            </SectionBlock>
          )}

          {pg.challengeEdges.length > 0 && (
            <SectionBlock icon={Swords} title="挑战关系">
              <ChallengeProvenance edges={pg.challengeEdges} solutions={problem.solutions} />
            </SectionBlock>
          )}

          {pg.methodBoundaries.length > 0 && (
            <SectionBlock icon={Link2} title="编辑沉淀" note="非解法关联，由编辑整理">
              <MethodBoundaryProvenance boundaries={pg.methodBoundaries} />
            </SectionBlock>
          )}

          {forkedSolutions.length > 0 && (
            <SectionBlock icon={GitBranch} title="Fork 链接">
              <ForkProvenance solutions={problem.solutions} />
            </SectionBlock>
          )}
        </div>
      )}
    </section>
  );
}
