"use client";

import Link from "next/link";
import { useState } from "react";
import {
  BookOpen,
  Clock3,
  Compass,
  Focus,
  Lightbulb,
  MessageSquareQuote,
  MoveRight,
  Repeat2,
  RouteOff,
  Scale,
  Tags,
} from "lucide-react";
import type { Solution } from "@/lib/types";
import { MathBlock } from "@/components/MathBlock";
import { ScoreBar } from "@/components/ScoreBar";
import { VerificationPanel } from "@/components/VerificationPanel";
import { getSolutionAverage } from "@/data/problems";
import { getInsightNode } from "@/data/insights";
import { getKnowledgeNode } from "@/data/knowledge";
import { getSolutionKindMeta } from "@/lib/solution-kinds";

const scoreLabels: Array<[keyof Solution["scores"], string]> = [
  ["correctness", "正确性"],
  ["examReady", "考场性"],
  ["elegance", "结构美感"],
  ["calculation", "计算量"],
  ["explanation", "讲解友好"],
];

function ThinkingCuesPanel({ solution }: { solution: Solution }) {
  const { thinkingCues } = solution;

  return (
    <section className="border border-amber-300/20 bg-amber-300/[0.035]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="size-4 text-amber-300" />
          <h3 className="text-sm font-bold text-white">💡 思维线索</h3>
        </div>
        {typeof thinkingCues.confidence === "number" && (
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            confidence {(thinkingCues.confidence * 100).toFixed(0)}%
          </span>
        )}
      </div>

      <div className="grid gap-px bg-white/10 lg:grid-cols-[1.05fr_1fr]">
        <div className="bg-zinc-950 p-4">
          <h4 className="text-xs font-bold text-zinc-500">首先观察</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {thinkingCues.observations.map((item) => (
              <span key={item} className="border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-zinc-300">
                <MathBlock>{item}</MathBlock>
              </span>
            ))}
          </div>
        </div>

        <div className="bg-zinc-950 p-4">
          <h4 className="text-xs font-bold text-amber-300">关键线索</h4>
          <div className="mt-3 flex flex-wrap gap-2">
            {thinkingCues.keySignals.map((item) => (
              <span key={item} className="border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-xs font-bold text-amber-100">
                <MathBlock>{item}</MathBlock>
              </span>
            ))}
          </div>
        </div>

        <div className="bg-zinc-950 p-4 lg:col-span-2">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-start">
            <div>
              <h4 className="text-xs font-bold text-zinc-500">为什么想到这种方法</h4>
              <p className="mt-2 text-sm leading-7 text-zinc-300">
                <MathBlock>{thinkingCues.reasoning}</MathBlock>
              </p>
            </div>
            <div className="md:min-w-56">
              <h4 className="text-xs font-bold text-zinc-500">还可能想到</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {thinkingCues.suggestedMethods.map((method) => (
                  <span key={method} className="border border-cyan-400/20 bg-cyan-400/5 px-2.5 py-1 text-xs text-cyan-100">
                    <MathBlock>{method}</MathBlock>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SolutionCard({ solution, rank }: { solution: Solution; rank: number }) {
  const [view, setView] = useState<"idea" | "transform" | "full">("transform");
  const kindMeta = getSolutionKindMeta(solution.kind);
  const knowledgeNodes = (solution.knowledgeIds ?? [])
    .map(getKnowledgeNode)
    .filter((node): node is NonNullable<ReturnType<typeof getKnowledgeNode>> => Boolean(node));
  const insightNodes = (solution.insightIds ?? [])
    .map(getInsightNode)
    .filter((node): node is NonNullable<ReturnType<typeof getInsightNode>> => Boolean(node));

  return (
    <article id={solution.id} className="scroll-mt-24 border border-white/10 bg-zinc-950">
      <header className="grid border-b border-white/10 lg:grid-cols-[7rem_1fr_auto]">
        <div className="flex items-center gap-3 border-b border-white/10 p-5 lg:flex-col lg:justify-center lg:border-r lg:border-b-0">
          <Compass className="size-5 text-cyan-300" />
          <span className="font-mono text-xs uppercase tracking-widest text-zinc-500">方案</span>
          <span className="font-display text-3xl font-black text-white">{String(rank).padStart(2, "0")}</span>
        </div>
        <div className="p-5 lg:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`border px-2 py-1 text-xs font-bold ${kindMeta.className}`}>{kindMeta.label}</span>
            <span className="border border-white/10 px-2 py-1 text-xs text-zinc-500">{kindMeta.description}</span>
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
          <span className="font-mono text-xs uppercase text-zinc-500">参考均分</span>
          <strong className="font-display text-2xl font-black text-zinc-300">
            {getSolutionAverage(solution).toFixed(1)}
          </strong>
          <span className="hidden text-center text-[11px] leading-5 text-zinc-600 lg:block">用于辅助比较，不代表唯一价值</span>
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
              data-testid={`solution-view-${value}`}
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
          <ThinkingCuesPanel solution={solution} />

          {view !== "idea" && <section className="mt-6 border border-cyan-400/20 bg-cyan-400/[0.04]">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
              <Compass className="size-4 text-cyan-300" />
              <h3 className="text-sm font-bold text-white">解法画像</h3>
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">为什么值得学</span>
            </div>
            <div className="grid gap-px bg-white/10 md:grid-cols-2">
              <div className="bg-zinc-950 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                  <Lightbulb className="size-4" />
                  启发点
                </div>
                <p className="mt-3 text-sm leading-7 text-zinc-300">
                  <MathBlock>{solution.inspiration}</MathBlock>
                </p>
              </div>
              <div className="bg-zinc-950 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <Repeat2 className="size-4" />
                  迁移价值
                </div>
                <p className="mt-3 text-sm leading-7 text-zinc-300">
                  <MathBlock>{solution.transferValue}</MathBlock>
                </p>
              </div>
              <div className="bg-zinc-950 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                  <Tags className="size-4" />
                  适合场景
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {solution.suitableFor.map((item) => (
                    <span key={item} className="border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-1.5 text-xs text-zinc-300">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="bg-zinc-950 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-red-300">
                  <Scale className="size-4" />
                  代价与局限
                </div>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-300">
                  {[...solution.tradeoffs, ...solution.limitations].map((item) => (
                    <li key={item} className="border-l border-red-400/35 pl-3">
                      <MathBlock>{item}</MathBlock>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>}

          {view !== "idea" && (knowledgeNodes.length > 0 || insightNodes.length > 0) && (
            <section className="mt-6 border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
                <Compass className="size-4 text-amber-300" />
                本解法用到的思路
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div>
                  <h4 className="text-xs font-bold text-cyan-300">知识点</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {knowledgeNodes.map((node) => (
                      <Link
                        key={node.id}
                        href={`/library/${node.id}`}
                        className="border border-cyan-400/20 bg-cyan-400/5 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-cyan-400/50 hover:text-cyan-200"
                      >
                        {node.title}
                      </Link>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-300">思路触发</h4>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {insightNodes.map((node) => (
                      <Link
                        key={node.id}
                        href={`/library/${node.id}`}
                        className="border border-amber-400/20 bg-amber-400/5 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:border-amber-400/50 hover:text-amber-200"
                      >
                        {node.title}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {view !== "idea" && solution.whyNotMethods && solution.whyNotMethods.length > 0 && (
            <section className="mt-6 border border-red-400/20 bg-red-500/[0.04] p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-300">
                <RouteOff className="size-4" />
                方法边界
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {solution.whyNotMethods.map((method) => (
                  <div key={method.methodName} className="border border-white/10 bg-black/20 p-3">
                    <h4 className="text-sm font-bold text-white">{method.methodName}</h4>
                    <p className="mt-2 text-sm leading-6 text-zinc-300">
                      <MathBlock>{method.reason}</MathBlock>
                    </p>
                    <p className="mt-3 text-xs leading-5 text-emerald-300">
                      可用边界：<MathBlock>{method.whenItWouldWork}</MathBlock>
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className={`mt-6 grid gap-4 ${view !== "idea" ? "md:grid-cols-2" : ""}`}>
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
            <h3 className="mb-1 font-mono text-xs uppercase tracking-widest text-zinc-500">五维参考</h3>
            <p className="mb-4 text-xs leading-5 text-zinc-600">分数用于辅助比较，重点仍是画像、场景和局限。</p>
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
            <p className="mt-3 text-sm leading-7 text-zinc-300">
              <MathBlock>{solution.scoringReason}</MathBlock>
            </p>
          </div>
          <VerificationPanel verification={solution.verification} />
        </aside>}
      </div>
    </article>
  );
}
