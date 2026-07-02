"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  FileText,
  Lightbulb,
  MessageSquareText,
  Plus,
  Send,
  Target,
} from "lucide-react";
import type { KnowledgeNode, Problem, Solution } from "@/lib/types";
import { MathBlock } from "@/components/MathBlock";
import { ScoreBar } from "@/components/ScoreBar";
import { VerificationPanel } from "@/components/VerificationPanel";
import { FunctionGraphPanel } from "@/components/FunctionGraphPanel";
import { SolutionTreePanel } from "@/components/SolutionTreePanel";
import { MathVisualization, mathVizProblemIds } from "@/components/MathVisualization";
import { graphSpecRegistry } from "@/data/graph-specs";
import { difficultyBadgeClass } from "@/lib/problem-presentation";
import { getSolutionKindMeta } from "@/lib/solution-kinds";

type DetailTab = "problem" | "solutions" | "knowledge" | "related" | "graph";

const allTabs: Array<{ id: DetailTab; label: string; requiresGraph?: boolean }> = [
  { id: "problem", label: "题目" },
  { id: "solutions", label: "解法" },
  { id: "knowledge", label: "知识点" },
  { id: "related", label: "相关题" },
  { id: "graph", label: "动态图像", requiresGraph: true },
];

const scoreRows: Array<[keyof Solution["scores"], string]> = [
  ["correctness", "正确性"],
  ["examReady", "考场性"],
  ["elegance", "结构美感"],
  ["calculation", "计算量"],
  ["explanation", "讲解友好"],
];

function scoreTone(index: number) {
  return index === 1 ? "red" : index === 2 ? "amber" : "cyan";
}

function SolutionCompareCard({ solution, rank }: { solution: Solution; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const meta = getSolutionKindMeta(solution.kind);

  return (
    <article id={solution.id} className="scroll-mt-32 border border-white/10 bg-zinc-950">
      <div className="grid gap-px bg-white/10 lg:grid-cols-[1fr_18rem]">
        <div className="bg-zinc-950 p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-zinc-600">{String(rank).padStart(2, "0")}</span>
            <span className={`border px-2.5 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span>
            <span className="text-xs text-zinc-600">{meta.description}</span>
            {solution.tags.map((tag) => (
              <span key={tag} className="border border-white/10 px-2 py-1 text-xs text-zinc-500">
                {tag}
              </span>
            ))}
          </div>
          <h3 className="mt-4 text-xl font-bold text-white">{solution.title}</h3>
          <p className="mt-3 text-sm leading-7 text-zinc-300">
            <MathBlock>{solution.inspiration}</MathBlock>
          </p>
        </div>
        <div className="flex flex-col justify-between bg-zinc-950 p-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
              <Lightbulb className="size-4" />
              核心转化
            </div>
            <p className="mt-3 line-clamp-4 text-sm leading-7 text-zinc-400">
              <MathBlock>{solution.keyTransform}</MathBlock>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 border border-cyan-400/35 bg-cyan-400/5 px-4 text-sm font-bold text-cyan-200 transition hover:bg-cyan-400/10"
          >
            {expanded ? "收起解析" : "展开查看"}
            <ChevronDown className={`size-4 transition ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/10 p-5 md:p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
            <div className="space-y-5">
              <section className="border border-cyan-400/20 bg-cyan-400/[0.04] p-4">
                <h4 className="flex items-center gap-2 text-sm font-bold text-white">
                  <Target className="size-4 text-cyan-300" />
                  为什么会想到
                </h4>
                <p className="mt-3 text-sm leading-7 text-zinc-300">
                  <MathBlock>{solution.origin}</MathBlock>
                </p>
              </section>
              <section className="border border-white/10 bg-black/20 p-4">
                <h4 className="text-sm font-bold text-white">完整解析摘要</h4>
                <ol className="mt-4 space-y-4">
                  {solution.summary.map((step, index) => (
                    <li key={step} className="grid grid-cols-[2rem_1fr] gap-3 text-sm leading-7 text-zinc-300">
                      <span className="font-mono text-cyan-300">{String(index + 1).padStart(2, "0")}</span>
                      <span><MathBlock>{step}</MathBlock></span>
                    </li>
                  ))}
                </ol>
              </section>
              <details className="border border-white/10 bg-black/20">
                <summary className="flex list-none items-center justify-between px-4 py-3 text-sm font-bold text-white marker:hidden">
                  上传者补充说明
                  <span className="text-xs font-normal text-zinc-600">适用场景 / 局限 / 验证</span>
                </summary>
                <div className="space-y-4 border-t border-white/10 p-4">
                  <p className="text-sm leading-7 text-zinc-300">
                    <MathBlock>{solution.transferValue}</MathBlock>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {solution.suitableFor.map((item) => (
                      <span key={item} className="border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-1.5 text-xs text-zinc-300">
                        {item}
                      </span>
                    ))}
                  </div>
                  <ul className="space-y-2 text-sm leading-6 text-zinc-400">
                    {[...solution.tradeoffs, ...solution.limitations].map((item) => (
                      <li key={item} className="border-l border-red-400/35 pl-3">
                        <MathBlock>{item}</MathBlock>
                      </li>
                    ))}
                  </ul>
                </div>
              </details>
            </div>
            <aside className="space-y-5">
              <details className="border border-white/10 bg-black/20">
                <summary className="flex list-none items-center justify-between px-4 py-3 text-sm font-bold text-white marker:hidden">
                  评分细节
                  <span className="text-xs font-normal text-zinc-600">默认折叠</span>
                </summary>
                <div className="space-y-3 border-t border-white/10 p-4">
                  {scoreRows.map(([key, label], index) => (
                    <ScoreBar key={key} label={label} value={solution.scores[key]} tone={scoreTone(index)} />
                  ))}
                  <p className="pt-2 text-xs leading-6 text-zinc-500">
                    <MathBlock>{solution.scoringReason}</MathBlock>
                  </p>
                </div>
              </details>
              <VerificationPanel verification={solution.verification} />
            </aside>
          </div>
        </div>
      )}
    </article>
  );
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="border border-white/10 bg-zinc-950 px-6 py-12 text-center">
      <MessageSquareText className="mx-auto size-7 text-zinc-600" />
      <h3 className="mt-4 font-bold text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ProblemDetailExperience({
  problem,
  knowledgeNodes,
  relatedProblems,
}: {
  problem: Problem;
  knowledgeNodes: KnowledgeNode[];
  relatedProblems: Problem[];
}) {
  const graphSpec = graphSpecRegistry[problem.id];
  const hasMathViz = mathVizProblemIds.has(problem.id);
  const tabs = allTabs.filter((tab) => !tab.requiresGraph || Boolean(graphSpec) || hasMathViz);
  const [activeTab, setActiveTab] = useState<DetailTab>("solutions");
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    try {
      const key = "proofarena-new-user-guide";
      if (!localStorage.getItem(key)) setShowGuide(true);
    } catch {
      setShowGuide(true);
    }
  }, []);

  function dismissGuide() {
    setShowGuide(false);
    try {
      localStorage.setItem("proofarena-new-user-guide", "seen");
    } catch {}
  }

  function showSolutions() {
    setActiveTab("solutions");
    requestAnimationFrame(() => {
      document.getElementById("solutions-panel")?.scrollIntoView({ block: "start" });
    });
  }

  const keyConditions = useMemo(
    () => [...problem.learningGuide.observation.slice(0, 2), ...problem.learningGuide.triggers.slice(0, 2)],
    [problem],
  );

  return (
    <main className="grid-surface min-h-screen">
      <section className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
          {showGuide && (
            <div className="mb-5 flex flex-col gap-3 border border-cyan-400/25 bg-cyan-400/[0.06] p-4 text-sm leading-6 text-zinc-200 sm:flex-row sm:items-center sm:justify-between">
              <span>新手可以按这个顺序看：先读题，再比较不同解法，最后把自己的思路整理成可复核的投稿。</span>
              <button type="button" onClick={dismissGuide} className="text-left text-xs font-bold text-cyan-300 sm:text-right">
                知道了
              </button>
            </div>
          )}

          <Link href="/problems" className="text-sm text-zinc-500 transition hover:text-white">
            返回题目列表
          </Link>
          <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="bg-cyan-400 px-2 py-1 font-bold text-zinc-950">{problem.region}</span>
                <span className="border border-white/10 px-2 py-1 text-zinc-400">
                  {problem.year} · {problem.paper} · {problem.number}
                </span>
                <span className={`border px-2 py-1 ${difficultyBadgeClass[problem.difficulty]}`}>{problem.difficulty}</span>
              </div>
              <h1 className="mt-4 text-3xl font-black leading-tight text-white md:text-5xl">{problem.title}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
                先看题目本体，再在解法 Tab 中比较不同路线。知识点和相关题放在辅助区，避免干扰主线阅读。
              </p>
            </div>
            <div className="grid grid-cols-3 border border-white/10 bg-black/20 text-center">
              <div className="border-r border-white/10 p-3">
                <strong className="font-display block text-2xl text-cyan-300">{problem.solutions.length}</strong>
                <span className="text-[11px] text-zinc-600">解法</span>
              </div>
              <div className="border-r border-white/10 p-3">
                <strong className="font-display block text-2xl text-red-300">{problem.tags.length}</strong>
                <span className="text-[11px] text-zinc-600">专题</span>
              </div>
              <div className="p-3">
                <strong className="font-display block text-2xl text-amber-300">{knowledgeNodes.length}</strong>
                <span className="text-[11px] text-zinc-600">知识点</span>
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-2 sm:hidden">
            <button
              type="button"
              onClick={showSolutions}
              className="inline-flex h-11 items-center justify-center gap-2 bg-cyan-400 px-4 text-sm font-bold text-zinc-950 transition hover:bg-cyan-300"
            >
              <BookOpen className="size-4" />
              直接看解法
            </button>
            <Link
              href="/submit"
              className="inline-flex h-11 items-center justify-center gap-2 border border-white/10 bg-black/20 px-4 text-sm font-bold text-zinc-200 transition hover:border-cyan-400/40 hover:text-cyan-200"
            >
              <Send className="size-4" />
              提交解法
            </Link>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_24rem]">
            <section className="border border-white/10 bg-zinc-950 p-5 md:p-6">
              <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
                <FileText className="size-4 text-cyan-300" />
                题目本体
              </div>
              <div className="space-y-4 text-base leading-8 text-zinc-200 md:text-lg">
                {problem.statement.map((paragraph) => (
                  <p key={paragraph}><MathBlock>{paragraph}</MathBlock></p>
                ))}
              </div>
            </section>
            <aside className="space-y-4">
              <section className="border border-white/10 bg-zinc-950 p-4">
                <h2 className="text-sm font-bold text-white">关键条件</h2>
                <ul className="mt-3 space-y-2">
                  {keyConditions.map((item) => (
                    <li key={item} className="border-l border-cyan-400/35 pl-3 text-sm leading-6 text-zinc-400">
                      <MathBlock>{item}</MathBlock>
                    </li>
                  ))}
                </ul>
              </section>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <button
                  type="button"
                  onClick={showSolutions}
                  className="inline-flex h-11 items-center justify-center gap-2 bg-cyan-400 px-4 text-sm font-bold text-zinc-950 transition hover:bg-cyan-300"
                >
                  <BookOpen className="size-4" />
                  查看解法
                </button>
                <Link
                  href="/submit"
                  className="inline-flex h-11 items-center justify-center gap-2 border border-white/10 bg-black/20 px-4 text-sm font-bold text-zinc-200 transition hover:border-cyan-400/40 hover:text-cyan-200"
                >
                  <Send className="size-4" />
                  提交解法
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <nav id="solutions-panel" className="sticky top-16 z-40 border-b border-white/10 bg-zinc-950/95 backdrop-blur-xl scroll-mt-20" aria-label="题目详情 Tab">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 md:px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={activeTab === tab.id}
              className={`h-10 shrink-0 border px-4 text-sm font-bold transition ${
                activeTab === tab.id
                  ? "border-cyan-400 bg-cyan-400 text-zinc-950"
                  : "border-transparent text-zinc-500 hover:border-white/10 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {activeTab === "problem" && (
          <section className="grid gap-5 lg:grid-cols-[1fr_22rem]">
            <div className="border border-white/10 bg-zinc-950 p-5 md:p-7">
              <h2 className="font-bold text-white">题目</h2>
              <div className="mt-5 space-y-4 text-base leading-8 text-zinc-200">
                {problem.statement.map((paragraph) => (
                  <p key={paragraph}><MathBlock>{paragraph}</MathBlock></p>
                ))}
              </div>
            </div>
            <aside className="space-y-4">
              <details className="border border-white/10 bg-zinc-950">
                <summary className="flex list-none items-center justify-between px-4 py-3 text-sm font-bold text-white marker:hidden">
                  参考答案
                  <span className="text-xs font-normal text-zinc-600">展开查看</span>
                </summary>
                <div className="border-t border-white/10 p-4 text-sm leading-7 text-zinc-300">
                  <MathBlock>{problem.answer}</MathBlock>
                </div>
              </details>
              <a
                href={`${problem.sourcePdf}#page=${problem.sourcePage}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 w-full items-center justify-center gap-2 border border-cyan-400/30 bg-cyan-400/5 px-4 text-sm font-bold text-cyan-300 transition hover:bg-cyan-400/10"
              >
                查看原题扫描页
                <ArrowUpRight className="size-4" />
              </a>
            </aside>
          </section>
        )}

        {activeTab === "solutions" && (
          <section className="grid gap-5 lg:grid-cols-[18rem_1fr]">
            <aside className="hidden lg:block">
              <div className="sticky top-32 border border-white/10 bg-zinc-950 p-4">
                <h2 className="text-sm font-bold text-white">对照题目</h2>
                <div className="mt-3 max-h-[28rem] overflow-y-auto space-y-3 text-sm leading-7 text-zinc-400">
                  {problem.statement.map((paragraph, i) => (
                    <p key={i}><MathBlock>{paragraph}</MathBlock></p>
                  ))}
                </div>
              </div>
            </aside>
            <div>
              <div className="mb-4 flex flex-col gap-2 border border-white/10 bg-zinc-950 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-bold text-white">解法对比</h2>
                  <p className="mt-1 text-xs text-zinc-600">先比较核心思路和五维指标，再展开完整解析。</p>
                </div>
                <Link href="/submit" className="inline-flex h-9 items-center justify-center gap-2 border border-cyan-400/30 px-3 text-xs font-bold text-cyan-300">
                  <Plus className="size-3.5" />
                  提交新解法
                </Link>
              </div>
              <SolutionTreePanel problem={problem} />
              {problem.solutions.length ? (
                <div className="space-y-4">
                  {problem.solutions.map((solution, index) => (
                    <SolutionCompareCard key={solution.id} solution={solution} rank={index + 1} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="还没有解法"
                  description="你可以提交第一个思路，让这道题真正进入擂台。"
                  action={<Link href="/submit" className="text-sm font-bold text-cyan-300">提交第一个解法</Link>}
                />
              )}
            </div>
          </section>
        )}

        {activeTab === "knowledge" && (
          <section className="space-y-4">
            <div className="border border-white/10 bg-zinc-950 p-5">
              <h2 className="font-bold text-white">知识点摘要</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">点击卡片进入知识节点查看完整边界说明和对比题目。</p>
            </div>
            {knowledgeNodes.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {knowledgeNodes.map((node) => (
                  <Link
                    key={node.id}
                    href={`/library/${node.id}`}
                    className="group border border-white/10 bg-zinc-950 p-4 transition hover:border-cyan-400/35"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-mono text-zinc-500">{node.category}</span>
                        <h3 className="mt-1 font-bold text-white group-hover:text-cyan-200">{node.title}</h3>
                      </div>
                      <ArrowUpRight className="size-4 shrink-0 text-zinc-600 group-hover:text-cyan-300 mt-1" />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-400 line-clamp-2">{node.summary}</p>
                    {node.aliases && node.aliases.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {node.aliases.slice(0, 3).map((alias) => (
                          <span key={alias} className="border border-white/10 px-2 py-0.5 text-[11px] text-zinc-600">
                            {alias}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="还没有知识点关联" description="后续整理时会把本题关联到可复用的知识节点。" />
            )}
          </section>
        )}

        {activeTab === "graph" && (
          <section>
            {graphSpec && <FunctionGraphPanel spec={graphSpec} />}
            {!graphSpec && hasMathViz && <MathVisualization problemId={problem.id} />}
          </section>
        )}

        {activeTab === "related" && (
          <section className="space-y-4">
            <div className="border border-white/10 bg-zinc-950 p-5">
              <h2 className="font-bold text-white">相关题摘要</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-500">默认只展示少量相近题，避免打断当前题的解法比较。</p>
            </div>
            {relatedProblems.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {relatedProblems.map((item) => (
                  <Link key={item.id} href={`/problems/${item.id}`} className="group border border-white/10 bg-zinc-950 p-4 transition hover:border-cyan-400/35">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="bg-cyan-400 px-2 py-1 font-bold text-zinc-950">{item.region}</span>
                      <span className={`border px-2 py-1 ${difficultyBadgeClass[item.difficulty]}`}>{item.difficulty}</span>
                    </div>
                    <h3 className="mt-3 font-bold text-white group-hover:text-cyan-200">{item.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-zinc-600">{item.solutions.length} 条解法</p>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="还没有相关题" description="当前题还没有整理出稳定的迁移题组。" />
            )}
          </section>
        )}
      </div>
    </main>
  );
}
