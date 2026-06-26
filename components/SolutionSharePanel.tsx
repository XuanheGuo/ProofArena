"use client";

import { Camera, ChevronDown, ChevronUp, Lightbulb, ListChecks, MoveRight, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import type { Problem } from "@/lib/types";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { getDefaultShareSolution, ShareCard, type ShareCardMode } from "@/components/ShareCard";
import { getSolutionKindMeta } from "@/lib/solution-kinds";

export function SolutionSharePanel({ problem }: { problem: Problem }) {
  const defaultSolution = useMemo(() => getDefaultShareSolution(problem), [problem]);
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState(defaultSolution?.id ?? problem.solutions[0]?.id ?? "");
  const [shareMode, setShareMode] = useState<ShareCardMode>("idea");
  const selectedSolution = problem.solutions.find((solution) => solution.id === selectedId) ?? defaultSolution ?? problem.solutions[0];

  if (!selectedSolution) return null;

  const selectedMeta = getSolutionKindMeta(selectedSolution.kind);

  return (
    <section className="mt-8 border border-white/10 bg-zinc-950">
      <button
        type="button"
        data-testid="solution-share-toggle"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-white/[0.03] md:p-8"
      >
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-cyan-300">
            <Sparkles className="size-4" />
            分享这份解法
          </div>
          <h2 className="mt-3 text-2xl font-black text-white md:text-3xl">生成解法分享卡</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400">
            默认折叠，需要传播时再展开。比起分享整道题，更适合截取某个解法的启发点、关键转化和适用场景。
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className={`border px-2.5 py-1.5 font-bold ${selectedMeta.className}`}>{selectedMeta.label}</span>
            <span className="border border-white/10 px-2.5 py-1.5 text-zinc-400">{selectedSolution.title}</span>
          </div>
        </div>
        <span className="grid size-10 shrink-0 place-items-center border border-white/15 text-zinc-300">
          {expanded ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-white/10 p-5 md:p-8">
          <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
            {problem.solutions.map((solution) => {
              const meta = getSolutionKindMeta(solution.kind);
              const active = solution.id === selectedSolution.id;
              return (
                <button
                  key={solution.id}
                  type="button"
                  onClick={() => setSelectedId(solution.id)}
                  className={`shrink-0 border px-3 py-2 text-left text-xs transition ${
                    active
                      ? "border-cyan-400 bg-cyan-400 text-zinc-950"
                      : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-white"
                  }`}
                >
                  <span className="font-bold">{meta.label}</span>
                  <span className="ml-2">{solution.title}</span>
                </button>
              );
            })}
          </div>

          <div className="mb-6">
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-500">截图内容</p>
            <div className="inline-flex max-w-full overflow-x-auto border border-white/10 bg-black/20 p-1">
              {[
                { id: "idea" as const, label: "只看思路", icon: Lightbulb },
                { id: "transform" as const, label: "关键转化", icon: MoveRight },
                { id: "full" as const, label: "完整过程", icon: ListChecks },
              ].map((option) => {
                const active = shareMode === option.id;
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    type="button"
                    data-testid={`share-mode-${option.id}`}
                    aria-pressed={active}
                    onClick={() => setShareMode(option.id)}
                    className={`inline-flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs font-bold transition ${
                      active ? "bg-cyan-400 text-zinc-950" : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-8 xl:grid-cols-[22rem_minmax(0,1fr)] xl:items-center">
            <div>
              <h3 className="text-xl font-black text-white">截图这张解法卡</h3>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                先选你想传播的内容：一句思路、关键转化，或带步骤的完整过程。展开后直接截右侧卡片外框，不需要截整个页面。
              </p>
              <div className="mt-4 border border-cyan-400/20 bg-cyan-400/[0.06] p-3 text-xs leading-6 text-cyan-100">
                <div className="flex items-center gap-2 font-bold">
                  <Camera className="size-4" />
                  截图建议
                </div>
                <p className="mt-2 text-zinc-400">
                  手机端保留竖版卡；宽屏桌面会自动切换为横版卡，直接截卡片边界即可。完整过程仍会按内容自然延展，不会裁步骤。
                </p>
              </div>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <CopyLinkButton path={`/problems/${problem.id}`} problem={problem} solution={selectedSolution} />
              </div>
            </div>
            <div className="mx-auto w-full max-w-[520px] border border-white/10 bg-black/20 p-2 sm:p-3 xl:max-w-[940px]">
              <div className="mb-2 flex items-center justify-between gap-3 px-1 text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                <span>截图区域</span>
                <span>{shareMode === "full" ? "完整过程" : shareMode === "transform" ? "关键转化" : "只看思路"}</span>
              </div>
              <ShareCard problem={problem} solution={selectedSolution} mode={shareMode} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
