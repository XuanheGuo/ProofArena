"use client";

import { useState } from "react";
import { GitCompare } from "lucide-react";
import { MathBlock } from "@/components/MathBlock";
import { ScoreBar } from "@/components/ScoreBar";
import type { Problem, ProofChallengeEdge, ProofObservation, ProofStrategyBranch, ProofTransformation, Solution } from "@/lib/types";

// ── score config ──────────────────────────────────────────────────────────────

const SCORE_ROWS: Array<{ key: keyof Solution["scores"]; label: string }> = [
  { key: "examReady", label: "考场性" },
  { key: "explanation", label: "讲解友好" },
  { key: "elegance", label: "结构美感" },
  { key: "calculation", label: "计算量" },
  { key: "correctness", label: "正确性" },
];

// ── derivation helpers ────────────────────────────────────────────────────────

function sharedObservations(
  observations: ProofObservation[],
  aId: string,
  bId: string,
): ProofObservation[] {
  return observations.filter(
    (o) => o.relatedSolutionIds.includes(aId) && o.relatedSolutionIds.includes(bId),
  );
}

function firstFork(
  branches: ProofStrategyBranch[],
  aId: string,
  bId: string,
): { branchA: ProofStrategyBranch | null; branchB: ProofStrategyBranch | null } {
  const aOnly = branches.filter(
    (b) => b.solutionIds.includes(aId) && !b.solutionIds.includes(bId),
  );
  const bOnly = branches.filter(
    (b) => b.solutionIds.includes(bId) && !b.solutionIds.includes(aId),
  );
  return { branchA: aOnly[0] ?? null, branchB: bOnly[0] ?? null };
}

function transformsFor(
  transformations: ProofTransformation[],
  solutionId: string,
): ProofTransformation[] {
  return transformations.filter((t) => t.solutionId === solutionId);
}

function challengeEdgeBetween(
  edges: ProofChallengeEdge[],
  aId: string,
  bId: string,
): ProofChallengeEdge | null {
  return (
    edges.find(
      (e) =>
        (e.challengerSolutionId === aId && e.targetSolutionId === bId) ||
        (e.challengerSolutionId === bId && e.targetSolutionId === aId),
    ) ?? null
  );
}

// ── sub-components ────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: "graph" | "field" }) {
  return source === "graph" ? (
    <span className="rounded border border-violet-400/30 bg-violet-400/[0.06] px-1.5 py-0.5 text-[9px] font-bold text-violet-300">
      来自推理图谱
    </span>
  ) : (
    <span className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-zinc-600">
      来自解法字段
    </span>
  );
}

function SectionHeader({ title, source }: { title: string; source: "graph" | "field" }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-2">
      <h4 className="text-xs font-bold text-zinc-300">{title}</h4>
      <SourceBadge source={source} />
    </div>
  );
}

function KeyTransformSection({
  solA, solB, transforms,
}: {
  solA: Solution;
  solB: Solution;
  transforms: ProofTransformation[];
}) {
  const tA = transformsFor(transforms, solA.id);
  const tB = transformsFor(transforms, solB.id);
  const source = tA.length > 0 || tB.length > 0 ? "graph" : "field";

  return (
    <div className="space-y-2">
      <SectionHeader title="关键转化" source={source} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-white/5 bg-black/20 p-3">
          <p className="mb-1 text-[10px] font-bold text-zinc-500">{solA.title}</p>
          {tA.length > 0 ? (
            <ul className="space-y-1">
              {tA.map((t) => (
                <li key={t.id} className="text-xs leading-5 text-zinc-300">
                  <MathBlock>{t.title}</MathBlock>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs leading-5 text-zinc-400">
              <MathBlock>{solA.keyTransform}</MathBlock>
            </p>
          )}
        </div>
        <div className="rounded border border-white/5 bg-black/20 p-3">
          <p className="mb-1 text-[10px] font-bold text-zinc-500">{solB.title}</p>
          {tB.length > 0 ? (
            <ul className="space-y-1">
              {tB.map((t) => (
                <li key={t.id} className="text-xs leading-5 text-zinc-300">
                  <MathBlock>{t.title}</MathBlock>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs leading-5 text-zinc-400">
              <MathBlock>{solB.keyTransform}</MathBlock>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoresSection({ solA, solB }: { solA: Solution; solB: Solution }) {
  return (
    <div className="space-y-2">
      <SectionHeader title="五维评分对比" source="field" />
      <div className="grid gap-1 sm:grid-cols-2">
        <div className="space-y-1.5 rounded border border-white/5 bg-black/20 p-3">
          <p className="mb-2 text-[10px] font-bold text-zinc-500">{solA.title}</p>
          {SCORE_ROWS.map((row) => (
            <ScoreBar key={row.key} label={row.label} value={solA.scores[row.key]} tone="cyan" />
          ))}
        </div>
        <div className="space-y-1.5 rounded border border-white/5 bg-black/20 p-3">
          <p className="mb-2 text-[10px] font-bold text-zinc-500">{solB.title}</p>
          {SCORE_ROWS.map((row) => (
            <ScoreBar key={row.key} label={row.label} value={solB.scores[row.key]} tone="amber" />
          ))}
        </div>
      </div>
    </div>
  );
}

function TradeoffsSection({ solA, solB }: { solA: Solution; solB: Solution }) {
  const itemsA = [...solA.tradeoffs, ...solA.limitations];
  const itemsB = [...solB.tradeoffs, ...solB.limitations];
  if (!itemsA.length && !itemsB.length) return null;

  return (
    <div className="space-y-2">
      <SectionHeader title="代价与局限" source="field" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-white/5 bg-black/20 p-3">
          <p className="mb-2 text-[10px] font-bold text-zinc-500">{solA.title}</p>
          {itemsA.length ? (
            <ul className="space-y-1">
              {itemsA.slice(0, 4).map((item) => (
                <li key={item} className="border-l border-red-400/30 pl-2 text-xs leading-5 text-zinc-400">
                  <MathBlock>{item}</MathBlock>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-zinc-600">—</p>}
        </div>
        <div className="rounded border border-white/5 bg-black/20 p-3">
          <p className="mb-2 text-[10px] font-bold text-zinc-500">{solB.title}</p>
          {itemsB.length ? (
            <ul className="space-y-1">
              {itemsB.slice(0, 4).map((item) => (
                <li key={item} className="border-l border-red-400/30 pl-2 text-xs leading-5 text-zinc-400">
                  <MathBlock>{item}</MathBlock>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-zinc-600">—</p>}
        </div>
      </div>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export function SolutionDiffPanel({ problem }: { problem: Problem }) {
  const { solutions } = problem;
  const [aId, setAId] = useState(solutions[0]?.id ?? "");
  const [bId, setBId] = useState(solutions[1]?.id ?? "");

  if (solutions.length < 2) return null;

  const solA = solutions.find((s) => s.id === aId) ?? solutions[0];
  const solB = solutions.find((s) => s.id === bId) ?? solutions[1];
  const pg = problem.proofGraph;

  const shared = pg ? sharedObservations(pg.observations, solA.id, solB.id) : [];
  const { branchA, branchB } = pg
    ? firstFork(pg.branches, solA.id, solB.id)
    : { branchA: null, branchB: null };
  const transforms = pg?.transformations ?? [];
  const edge = pg ? challengeEdgeBetween(pg.challengeEdges, solA.id, solB.id) : null;

  const kindLabel: Record<string, string> = {
    standard: "标准", insight: "启发", robust: "稳健", teaching: "教学",
  };

  return (
    <section className="border border-white/10">
      <div className="border-b border-white/10 bg-black/20 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
          <GitCompare className="size-4 text-zinc-400" />
          解法 Diff
        </h3>
        <p className="mt-0.5 text-[11px] text-zinc-600">选择两条解法，比较路线差异。</p>
      </div>

      <div className="p-4">
        {/* Solution selectors */}
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1 text-xs">
            <span className="font-bold text-cyan-300">路线 A</span>
            <select
              value={aId}
              onChange={(e) => setAId(e.target.value)}
              className="h-9 rounded border border-white/10 bg-zinc-900 px-2 text-xs text-white outline-none focus:border-cyan-400/50"
            >
              {solutions.filter((s) => s.id !== bId).map((s) => (
                <option key={s.id} value={s.id}>
                  [{kindLabel[s.kind] ?? s.kind}] {s.title}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            <span className="font-bold text-amber-300">路线 B</span>
            <select
              value={bId}
              onChange={(e) => setBId(e.target.value)}
              className="h-9 rounded border border-white/10 bg-zinc-900 px-2 text-xs text-white outline-none focus:border-amber-400/50"
            >
              {solutions.filter((s) => s.id !== aId).map((s) => (
                <option key={s.id} value={s.id}>
                  [{kindLabel[s.kind] ?? s.kind}] {s.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-5">
          {/* Shared observations */}
          {shared.length > 0 && (
            <div className="space-y-2">
              <SectionHeader title="共同观察" source="graph" />
              <ul className="space-y-1">
                {shared.map((o) => (
                  <li key={o.id} className="rounded border border-cyan-400/10 bg-cyan-400/[0.04] px-3 py-2 text-xs leading-5 text-zinc-300">
                    <MathBlock>{o.title}</MathBlock>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* First fork */}
          {(branchA || branchB) && (
            <div className="space-y-2">
              <SectionHeader title="第一个分叉点" source="graph" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded border border-cyan-400/10 bg-black/20 p-3">
                  <p className="mb-1 text-[10px] font-bold text-cyan-400/70">路线 A 选择</p>
                  {branchA ? (
                    <>
                      <p className="text-xs font-bold text-zinc-300"><MathBlock>{branchA.title}</MathBlock></p>
                      <p className="mt-1 text-[11px] leading-5 text-zinc-500"><MathBlock>{branchA.promise}</MathBlock></p>
                    </>
                  ) : <p className="text-xs text-zinc-600">与路线 B 共享此分支</p>}
                </div>
                <div className="rounded border border-amber-400/10 bg-black/20 p-3">
                  <p className="mb-1 text-[10px] font-bold text-amber-400/70">路线 B 选择</p>
                  {branchB ? (
                    <>
                      <p className="text-xs font-bold text-zinc-300"><MathBlock>{branchB.title}</MathBlock></p>
                      <p className="mt-1 text-[11px] leading-5 text-zinc-500"><MathBlock>{branchB.promise}</MathBlock></p>
                    </>
                  ) : <p className="text-xs text-zinc-600">与路线 A 共享此分支</p>}
                </div>
              </div>
            </div>
          )}

          {/* Key transforms */}
          <KeyTransformSection solA={solA} solB={solB} transforms={transforms} />

          {/* Scores */}
          <ScoresSection solA={solA} solB={solB} />

          {/* Tradeoffs */}
          <TradeoffsSection solA={solA} solB={solB} />

          {/* Challenge edge */}
          {edge && (
            <div className="space-y-2">
              <SectionHeader title="已记录的挑战关系" source="graph" />
              <div className="rounded border border-amber-400/20 bg-amber-400/[0.04] p-3">
                <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="border border-cyan-400/30 px-1.5 py-0.5 font-bold text-cyan-200">
                    {solutions.find((s) => s.id === edge.challengerSolutionId)?.title ?? edge.challengerSolutionId}
                  </span>
                  <span className="text-zinc-600">挑战</span>
                  <span className="border border-white/10 px-1.5 py-0.5 text-zinc-400">
                    {solutions.find((s) => s.id === edge.targetSolutionId)?.title ?? edge.targetSolutionId}
                  </span>
                </div>
                <p className="text-xs leading-5 text-zinc-300"><MathBlock>{edge.claim}</MathBlock></p>
                {edge.advantages.length > 0 && (
                  <ul className="mt-2 space-y-0.5">
                    {edge.advantages.map((adv) => (
                      <li key={adv} className="border-l border-emerald-400/30 pl-2 text-[11px] leading-5 text-zinc-400">
                        <MathBlock>{adv}</MathBlock>
                      </li>
                    ))}
                  </ul>
                )}
                {edge.risk && (
                  <p className="mt-2 border-l border-red-400/30 pl-2 text-[11px] leading-5 text-zinc-500">
                    <MathBlock>{edge.risk}</MathBlock>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
