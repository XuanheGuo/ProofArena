"use client";

import { MathBlock } from "@/components/MathBlock";
import { ScoreBar } from "@/components/ScoreBar";
import type { Problem, Solution } from "@/lib/types";

const SCORE_COLS = [
  { key: "correctness" as const, label: "正确性" },
  { key: "examReady" as const, label: "考场性" },
  { key: "elegance" as const, label: "结构美感" },
  { key: "calculation" as const, label: "计算量" },
  { key: "explanation" as const, label: "讲解友好" },
];

function scoreColor(v: number) {
  if (v >= 9) return "text-emerald-300";
  if (v >= 7.5) return "text-cyan-300";
  if (v >= 6) return "text-amber-300";
  return "text-red-300";
}

function kindBadgeClass(kind: Solution["kind"]) {
  const map: Record<Solution["kind"], string> = {
    standard: "border-cyan-400/40 text-cyan-200",
    insight: "border-amber-400/40 text-amber-200",
    robust: "border-emerald-400/40 text-emerald-200",
    teaching: "border-violet-400/40 text-violet-200",
  };
  return map[kind] ?? "border-white/20 text-zinc-300";
}

function kindLabel(kind: Solution["kind"]) {
  const map: Record<Solution["kind"], string> = {
    standard: "标准",
    insight: "启发",
    robust: "稳健",
    teaching: "教学",
  };
  return map[kind] ?? kind;
}

function KeyTransformCell({ solution, problem }: { solution: Solution; problem: Problem }) {
  // Prefer the first matching transformation from proofGraph
  const proofTransform = problem.proofGraph?.transformations.find(
    (t) => t.solutionId === solution.id,
  );
  const text = proofTransform ? proofTransform.title : solution.keyTransform;
  return (
    <p className="line-clamp-2 text-xs leading-5 text-zinc-400 [word-break:keep-all]">
      <MathBlock>{text}</MathBlock>
    </p>
  );
}

function RiskCell({ solution }: { solution: Solution }) {
  const items = [...solution.tradeoffs, ...solution.limitations].slice(0, 2);
  if (!items.length) return <span className="text-xs text-zinc-600">—</span>;
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item} className="line-clamp-2 border-l border-red-400/30 pl-2 text-xs leading-5 text-zinc-400 [word-break:keep-all]">
          <MathBlock>{item}</MathBlock>
        </li>
      ))}
    </ul>
  );
}

function SuitableForCell({ solution }: { solution: Solution }) {
  return (
    <div className="flex flex-wrap gap-1">
      {solution.suitableFor.slice(0, 3).map((item) => (
        <span
          key={item}
          className="whitespace-nowrap border border-emerald-400/20 bg-emerald-400/5 px-1.5 py-0.5 text-[10px] text-zinc-300"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

// ── Desktop: horizontally scrollable comparison table ─────────────────────────

function DesktopMatrix({ problem }: { problem: Problem }) {
  const { solutions } = problem;

  return (
    <div className="overflow-x-auto overscroll-x-contain pb-1">
      <table className="min-w-[1120px] table-fixed border-collapse text-left">
        <colgroup>
          <col className="w-48" />
          {SCORE_COLS.map((col) => (
            <col key={col.key} className="w-[4.5rem]" />
          ))}
          <col className="w-60" />
          <col className="w-52" />
          <col className="w-44" />
        </colgroup>
        <thead>
          <tr className="border-b border-white/10">
            <th className="whitespace-nowrap px-3 py-2 text-xs font-bold text-zinc-500">解法</th>
            {SCORE_COLS.map((col) => (
              <th key={col.key} className="whitespace-nowrap px-2 py-2 text-center text-xs font-bold text-zinc-500">
                {col.label}
              </th>
            ))}
            <th className="whitespace-nowrap px-3 py-2 text-xs font-bold text-zinc-500">关键转化</th>
            <th className="whitespace-nowrap px-3 py-2 text-xs font-bold text-zinc-500">代价 / 风险</th>
            <th className="whitespace-nowrap px-3 py-2 text-xs font-bold text-zinc-500">最适合</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {solutions.map((sol) => (
            <tr key={sol.id} className="group hover:bg-white/[0.02]">
              <td className="px-3 py-3 align-top">
                <span
                  className={`inline-block border px-1.5 py-0.5 text-[10px] font-bold ${kindBadgeClass(sol.kind)}`}
                >
                  {kindLabel(sol.kind)}
                </span>
                <a
                  href={`#${sol.id}`}
                  className="mt-1 line-clamp-2 text-xs font-bold leading-snug text-zinc-200 hover:text-cyan-300 [word-break:keep-all]"
                >
                  <MathBlock>{sol.title}</MathBlock>
                </a>
              </td>
              {SCORE_COLS.map((col) => (
                <td key={col.key} className="px-2 py-3 text-center align-top">
                  <span className={`text-sm font-bold tabular-nums ${scoreColor(sol.scores[col.key])}`}>
                    {sol.scores[col.key].toFixed(1)}
                  </span>
                </td>
              ))}
              <td className="px-3 py-3 align-top">
                <KeyTransformCell solution={sol} problem={problem} />
              </td>
              <td className="px-3 py-3 align-top">
                <RiskCell solution={sol} />
              </td>
              <td className="px-3 py-3 align-top">
                <SuitableForCell solution={sol} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Mobile: card per solution ─────────────────────────────────────────────────

function MobileCard({ solution, problem }: { solution: Solution; problem: Problem }) {
  return (
    <div className="border border-white/10 bg-zinc-950 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className={`border px-2 py-0.5 text-[10px] font-bold ${kindBadgeClass(solution.kind)}`}>
          {kindLabel(solution.kind)}
        </span>
        <a href={`#${solution.id}`} className="text-sm font-bold text-zinc-200 hover:text-cyan-300">
          <MathBlock>{solution.title}</MathBlock>
        </a>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        {SCORE_COLS.map((col) => (
          <ScoreBar key={col.key} label={col.label} value={solution.scores[col.key]} tone="cyan" />
        ))}
      </div>
      <div className="space-y-2 border-t border-white/5 pt-2">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wide text-cyan-400/70">关键转化</span>
          <div className="mt-1">
            <KeyTransformCell solution={solution} problem={problem} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-red-400/70">风险</span>
            <div className="mt-1">
              <RiskCell solution={solution} />
            </div>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400/70">最适合</span>
            <div className="mt-1">
              <SuitableForCell solution={solution} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export function ProofGraphMatrix({ problem }: { problem: Problem }) {
  const { solutions } = problem;
  if (!solutions.length) return null;

  return (
    <section className="border border-white/10 bg-black/20">
      <div className="border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-bold text-white">解法比较</h3>
        <p className="mt-0.5 text-[11px] text-zinc-600">
          数值越高越好（1–10）；关键转化来自每条解法最核心的一步。
        </p>
      </div>

      {/* Desktop table */}
      <div className="hidden p-4 lg:block">
        <DesktopMatrix problem={problem} />
      </div>

      {/* Mobile cards */}
      <div className="space-y-px lg:hidden">
        {solutions.map((sol) => (
          <MobileCard key={sol.id} solution={sol} problem={problem} />
        ))}
      </div>
    </section>
  );
}
