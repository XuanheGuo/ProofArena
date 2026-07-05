"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, GitBranch, GitCompare } from "lucide-react";
import { MathBlock } from "@/components/MathBlock";
import { stripMathDelimiters } from "@/lib/math-normalizer";
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
          <p className="mb-1 text-[10px] font-bold text-zinc-500"><MathBlock>{solA.title}</MathBlock></p>
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
          <p className="mb-1 text-[10px] font-bold text-zinc-500"><MathBlock>{solB.title}</MathBlock></p>
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
      <div className="rounded border border-white/5 bg-black/20 p-3">
        <div className="mb-2 grid grid-cols-[4rem_minmax(0,1fr)_minmax(0,1fr)] gap-2 text-[10px] font-bold text-zinc-600">
          <span>维度</span>
          <span className="truncate text-cyan-300"><MathBlock>{solA.title}</MathBlock></span>
          <span className="truncate text-amber-300"><MathBlock>{solB.title}</MathBlock></span>
        </div>
        <div className="space-y-1.5">
          {SCORE_ROWS.map((row) => {
            const a = solA.scores[row.key] ?? 0;
            const b = solB.scores[row.key] ?? 0;
            return (
              <div key={row.key} className="grid grid-cols-[4rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 text-[11px]">
                <span className="text-zinc-500">{row.label}</span>
                <div className="min-w-0">
                  <div className="mb-0.5 flex items-center justify-between gap-1">
                    <span className="truncate text-zinc-500">A</span>
                    <span className="font-bold text-cyan-300">{a.toFixed(1)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-cyan-300" style={{ width: `${Math.max(0, Math.min(100, a * 10))}%` }} />
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="mb-0.5 flex items-center justify-between gap-1">
                    <span className="truncate text-zinc-500">B</span>
                    <span className="font-bold text-amber-300">{b.toFixed(1)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-amber-300" style={{ width: `${Math.max(0, Math.min(100, b * 10))}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
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
          <p className="mb-2 text-[10px] font-bold text-zinc-500"><MathBlock>{solA.title}</MathBlock></p>
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
          <p className="mb-2 text-[10px] font-bold text-zinc-500"><MathBlock>{solB.title}</MathBlock></p>
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

function DetailSummary({ children }: { children: ReactNode }) {
  return (
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 border-b border-white/10 bg-black/20 px-3 py-2 text-xs font-bold text-zinc-300 marker:hidden transition hover:text-white">
      {children}
      <ChevronDown className="size-3.5 shrink-0 text-zinc-500 transition group-open:rotate-180" />
    </summary>
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
          <div className="grid min-w-0 gap-1 text-xs">
            <span className="font-bold text-cyan-300">路线 A</span>
            <select
              value={aId}
              onChange={(e) => setAId(e.target.value)}
              className="h-9 w-full min-w-0 rounded border border-white/10 bg-zinc-900 px-2 text-xs text-white outline-none focus:border-cyan-400/50"
            >
              {solutions.filter((s) => s.id !== bId).map((s) => (
                <option key={s.id} value={s.id}>
                  [{kindLabel[s.kind] ?? s.kind}] {stripMathDelimiters(s.title)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid min-w-0 gap-1 text-xs">
            <span className="font-bold text-amber-300">路线 B</span>
            <select
              value={bId}
              onChange={(e) => setBId(e.target.value)}
              className="h-9 w-full min-w-0 rounded border border-white/10 bg-zinc-900 px-2 text-xs text-white outline-none focus:border-amber-400/50"
            >
              {solutions.filter((s) => s.id !== aId).map((s) => (
                <option key={s.id} value={s.id}>
                  [{kindLabel[s.kind] ?? s.kind}] {stripMathDelimiters(s.title)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-4">
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

          {/* Scores */}
          <ScoresSection solA={solA} solB={solB} />

          <details className="group border border-white/10">
            <DetailSummary>展开关键转化与代价</DetailSummary>
            <div className="space-y-4 p-3">
              <KeyTransformSection solA={solA} solB={solB} transforms={transforms} />
              <TradeoffsSection solA={solA} solB={solB} />
            </div>
          </details>

          {edge && (
            <details className="group border border-amber-400/20 bg-amber-400/[0.03]">
              <DetailSummary>
                <span>展开已记录的挑战关系</span>
              </DetailSummary>
              <div className="space-y-2 p-3">
                <SectionHeader title="已记录的挑战关系" source="graph" />
                <div className="rounded border border-amber-400/20 bg-amber-400/[0.04] p-3">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="border border-cyan-400/30 px-1.5 py-0.5 font-bold text-cyan-200">
                      <MathBlock>{solutions.find((s) => s.id === edge.challengerSolutionId)?.title ?? edge.challengerSolutionId}</MathBlock>
                    </span>
                    <span className="text-zinc-600">挑战</span>
                    <span className="border border-white/10 px-1.5 py-0.5 text-zinc-400">
                      <MathBlock>{solutions.find((s) => s.id === edge.targetSolutionId)?.title ?? edge.targetSolutionId}</MathBlock>
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
            </details>
          )}

          <div className="grid gap-2 border-t border-white/10 pt-4 sm:grid-cols-2">
            <Link
              href={`/submit?problem=${problem.id}&fork=${solA.id}`}
              className="inline-flex h-9 items-center justify-center gap-1.5 border border-cyan-400/25 px-3 text-xs font-bold text-cyan-300 transition hover:bg-cyan-400/10"
            >
              <GitBranch className="size-3.5" />
              基于路线 A 改写
            </Link>
            <Link
              href={`/submit?problem=${problem.id}&fork=${solB.id}`}
              className="inline-flex h-9 items-center justify-center gap-1.5 border border-amber-400/25 px-3 text-xs font-bold text-amber-300 transition hover:bg-amber-400/10"
            >
              <GitBranch className="size-3.5" />
              基于路线 B 改写
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
