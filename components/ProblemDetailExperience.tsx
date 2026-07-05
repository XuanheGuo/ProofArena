"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  FileText,
  Lightbulb,
  MessageSquareText,
  Plus,
  Send,
  Target,
  Trophy,
} from "lucide-react";
import type { Contest, ContestProblem, KnowledgeNode, Problem, Solution } from "@/lib/types";
import { MathBlock } from "@/components/MathBlock";
import { ScoreBar } from "@/components/ScoreBar";
import { VerificationPanel } from "@/components/VerificationPanel";
import { SolutionTreePanel } from "@/components/SolutionTreePanel";
import { SolutionRatingPanel } from "@/components/SolutionRatingPanel";
import { ProofGraphMatrix } from "@/components/ProofGraphMatrix";
import { MethodBoundaryHighlights } from "@/components/MethodBoundaryHighlights";
import { ReasoningReplayPanel } from "@/components/ReasoningReplayPanel";
import { ProofChallengeEdges } from "@/components/ProofChallengeEdges";
import { SolutionDiffPanel } from "@/components/SolutionDiffPanel";
import { ProofGraphProvenancePanel } from "@/components/ProofGraphProvenancePanel";
import { ProofGraphReleaseCard } from "@/components/ProofGraphReleaseCard";
import { graphSpecRegistry } from "@/data/graph-specs";
import { difficultyBadgeClass } from "@/lib/problem-presentation";
import { getSolutionKindMeta } from "@/lib/solution-kinds";
import { contestSolutionTypeMeta } from "@/lib/contest-meta";
import { mathVizProblemIds } from "@/lib/math-viz-problem-ids";

const FunctionGraphPanel = dynamic(
  () => import("@/components/FunctionGraphPanel").then((mod) => mod.FunctionGraphPanel),
  { ssr: false, loading: () => <div className="min-h-96 border border-cyan-400/25 bg-zinc-950 lg:min-h-[34rem]" /> },
);
const MathVisualization = dynamic(
  () => import("@/components/MathVisualization").then((mod) => mod.MathVisualization),
  { ssr: false, loading: () => <div className="min-h-96 border border-cyan-400/25 bg-zinc-950 lg:min-h-[34rem]" /> },
);

type DetailTab = "problem" | "comparison" | "solutions" | "knowledge" | "related" | "graph";

const allTabs: Array<{ id: DetailTab; label: string; requiresGraph?: boolean; requiresProofGraph?: boolean }> = [
  { id: "problem", label: "题目" },
  { id: "comparison", label: "比较" },
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
  const contestType = solution.contestSolutionType ? contestSolutionTypeMeta[solution.contestSolutionType] : null;

  return (
    <article id={solution.id} className="scroll-mt-32 border border-white/10 bg-zinc-950 transition-colors hover:border-white/20">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r md:p-6">
          {/* badges row */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] text-zinc-600">{String(rank).padStart(2, "0")}</span>
            <span className={`border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${meta.className}`}>
              {meta.label}
            </span>
            {contestType && (
              <span className="border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                {contestType.shortLabel}
              </span>
            )}
            {solution.isPostContest && (
              <span className="border border-zinc-600 px-2 py-0.5 text-[11px] text-zinc-400">赛后</span>
            )}
            {solution.thinkingCues?.forkOf && (
              <a
                href={`#${solution.thinkingCues.forkOf.solutionId}`}
                className="border border-violet-400/40 bg-violet-400/10 px-2 py-0.5 text-[11px] font-bold text-violet-300 transition hover:bg-violet-400/20"
              >
                Fork 自：{solution.thinkingCues.forkOf.solutionTitle}
              </a>
            )}
          </div>
          <h3 className="mt-3 text-lg font-bold leading-snug text-white sm:text-xl">{solution.title}</h3>
          <p className="mt-2 text-sm leading-7 text-zinc-300">
            <MathBlock>{solution.inspiration}</MathBlock>
          </p>
          {/* tags — muted, smaller */}
          {solution.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {solution.tags.map((tag) => (
                <span key={tag} className="bg-white/[0.04] px-2 py-0.5 text-[11px] text-zinc-500">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col justify-between p-5">
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-cyan-400">
              <Lightbulb className="size-3.5" />
              核心转化
            </div>
            <p className="line-clamp-5 text-sm leading-7 text-zinc-400">
              <MathBlock>{solution.keyTransform}</MathBlock>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className={`mt-5 inline-flex h-9 items-center justify-center gap-2 border text-sm font-bold transition ${
              expanded
                ? "border-white/20 bg-white/[0.04] text-zinc-300 hover:bg-white/[0.07]"
                : "border-cyan-400/40 bg-cyan-400/[0.06] text-cyan-300 hover:bg-cyan-400/10"
            }`}
          >
            {expanded ? "收起" : "展开解析"}
            <ChevronDown className={`size-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/10 p-5 md:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
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
                    <li key={step} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 text-sm leading-7 text-zinc-300">
                      <span className="font-mono text-cyan-300">{String(index + 1).padStart(2, "0")}</span>
                      <span><MathBlock>{step}</MathBlock></span>
                    </li>
                  ))}
                </ol>
              </section>
              <details className="border border-white/10 bg-black/20">
                <summary className="flex list-none flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm font-bold text-white marker:hidden">
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
                <summary className="flex list-none flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm font-bold text-white marker:hidden">
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
          <div className="mt-5 border-t border-white/10 pt-5">
            <SolutionRatingPanel solutionId={solution.id} authorId={solution.authorId} />
          </div>
        </div>
      )}
    </article>
  );
}

function ProofGraphSummaryStrip({
  problem,
  submitHref,
  onOpenComparison,
}: {
  problem: Problem;
  submitHref: string;
  onOpenComparison: () => void;
}) {
  const pg = problem.proofGraph!;
  const parts = [
    { count: pg.observations.length, label: "入口" },
    { count: pg.branches.length, label: "分支" },
    { count: pg.transformations.length, label: "转化" },
    { count: pg.methodBoundaries.length, label: "边界" },
    { count: pg.challengeEdges.length, label: "挑战" },
  ].filter((p) => p.count > 0);

  const summary = parts.map((p) => `${p.count} ${p.label}`).join(" · ");

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border border-white/10 bg-black/20 px-4 py-2">
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
        <span className="font-bold text-zinc-400">推理图谱</span>
        <span className="border border-emerald-400/30 bg-emerald-400/[0.06] px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
          当前版本
        </span>
        {summary && <span className="text-zinc-600">{summary}</span>}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onOpenComparison}
          className="inline-flex h-7 items-center gap-1.5 border border-violet-400/30 px-3 text-xs font-bold text-violet-200 transition hover:bg-violet-400/10"
        >
          查看图谱
        </button>
        <a
          href={submitHref}
          className="inline-flex h-7 items-center gap-1.5 border border-cyan-400/30 px-3 text-xs font-bold text-cyan-300 transition hover:bg-cyan-400/10"
        >
          提交新解法
        </a>
      </div>
    </div>
  );
}

function ComparisonTabNav({ problem }: { problem: Problem }) {
  const pg = problem.proofGraph;
  const hasReplay = Boolean(
    pg && (
      pg.observations.length > 0 ||
      pg.branches.length > 0 ||
      pg.transformations.length > 0 ||
      pg.verificationSteps.length > 0 ||
      pg.methodBoundaries.length > 0
    ),
  );
  const hasProvenance = Boolean(
    pg && (
      pg.observations.length > 0 ||
      pg.transformations.length > 0 ||
      pg.challengeEdges.length > 0 ||
      pg.methodBoundaries.length > 0 ||
      problem.solutions.some((solution) => solution.thinkingCues?.forkOf)
    ),
  );
  const sections = [
    { id: "comparison-release", label: "发布信息", show: Boolean(pg) },
    { id: "comparison-matrix", label: "解法比较", show: true },
    { id: "comparison-boundaries", label: "方法边界", show: Boolean(pg?.methodBoundaries.length) },
    { id: "comparison-replay", label: "推导过程", show: hasReplay },
    { id: "comparison-challenges", label: "解法挑战", show: Boolean(pg?.challengeEdges.length) },
    { id: "comparison-diff", label: "解法 Diff", show: problem.solutions.length >= 2 },
    { id: "comparison-provenance", label: "图谱来源", show: hasProvenance },
    { id: "comparison-tree", label: "思路树", show: Boolean(problem.solutionTree?.roots.length) },
  ].filter((section) => section.show);

  return (
    <nav className="border border-white/10 bg-black/20 px-3 py-2" aria-label="比较工具目录">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[10px] font-bold uppercase tracking-wide text-zinc-600">
          比较工具
        </span>
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="inline-flex h-7 items-center border border-white/10 px-2.5 text-xs font-bold text-zinc-400 transition hover:border-cyan-400/35 hover:text-cyan-200"
          >
            {section.label}
          </a>
        ))}
      </div>
    </nav>
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
  contestContext,
}: {
  problem: Problem;
  knowledgeNodes: KnowledgeNode[];
  relatedProblems: Problem[];
  contestContext?: {
    contest: Contest;
    contestProblem: ContestProblem;
  };
}) {
  const graphSpec = graphSpecRegistry[problem.id];
  const hasMathViz = mathVizProblemIds.has(problem.id);
  const tabs = allTabs.filter((tab) => {
    if (tab.requiresGraph && !Boolean(graphSpec) && !hasMathViz) return false;
    if (tab.requiresProofGraph && !problem.proofGraph) return false;
    if (tab.id === "comparison" && problem.solutions.length < 2) return false;
    return true;
  });
  const [activeTab, setActiveTab] = useState<DetailTab>("solutions");
  const [showGuide, setShowGuide] = useState(false);
  const proofGraph = problem.proofGraph;
  const hasReplay = Boolean(
    proofGraph && (
      proofGraph.observations.length > 0 ||
      proofGraph.branches.length > 0 ||
      proofGraph.transformations.length > 0 ||
      proofGraph.verificationSteps.length > 0 ||
      proofGraph.methodBoundaries.length > 0
    ),
  );
  const hasProvenance = Boolean(
    proofGraph && (
      proofGraph.observations.length > 0 ||
      proofGraph.transformations.length > 0 ||
      proofGraph.challengeEdges.length > 0 ||
      proofGraph.methodBoundaries.length > 0 ||
      problem.solutions.some((solution) => solution.thinkingCues?.forkOf)
    ),
  );

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
      document.getElementById("solutions-content")?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  function showComparison() {
    setActiveTab("comparison");
    requestAnimationFrame(() => {
      document.getElementById("proof-graph-comparison-content")?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  const keyConditions = useMemo(
    () => [...problem.learningGuide.observation.slice(0, 2), ...problem.learningGuide.triggers.slice(0, 2)],
    [problem],
  );
  const submitHref = contestContext
    ? `/submit?contest=${contestContext.contest.slug}&problem=${problem.id}`
    : "/submit";
  const hideSolutionsForContest = contestContext?.contest.status === "active";

  return (
    <main className="grid-surface min-h-screen">
      <section className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-10">
          {problem.dataNotice && (
            <div className="mb-5 flex gap-3 border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3 text-sm leading-6 text-amber-100">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
              <span>{problem.dataNotice}</span>
            </div>
          )}

          {showGuide && (
            <div className="mb-5 flex flex-col gap-3 border border-cyan-400/25 bg-cyan-400/[0.06] p-4 text-sm leading-6 text-zinc-200 sm:flex-row sm:items-center sm:justify-between">
              <span>新手可以按这个顺序看：先读题，再比较不同解法，最后把自己的思路整理成可复核的投稿。</span>
              <button type="button" onClick={dismissGuide} className="text-left text-xs font-bold text-cyan-300 sm:text-right">
                知道了
              </button>
            </div>
          )}

          {contestContext && (
            <div className="mb-5 border border-amber-400/25 bg-amber-400/[0.06] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-bold text-amber-200">
                      <Trophy className="size-3.5" />
                      {contestContext.contest.title}
                    </span>
                    <span className="border border-amber-400/20 px-2 py-1 text-amber-100/80">
                      Day {contestContext.contestProblem.dayIndex} · {contestContext.contestProblem.title}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">
                    {contestContext.contestProblem.theme}。当前题目会按比赛解法类型提交，赛后优秀解法将回流到题目页。
                  </p>
                </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  <Link
                    href={`/contests/${contestContext.contest.slug}`}
                    className="inline-flex h-9 items-center justify-center gap-2 border border-amber-400/25 px-3 text-xs font-bold text-amber-200 transition hover:bg-amber-400/10"
                  >
                    返回比赛主页
                  </Link>
                  {(contestContext.contest.status === "active" || contestContext.contest.status === "judging") && (
                    <Link
                      href={submitHref}
                      className="inline-flex h-9 items-center justify-center gap-2 bg-amber-300 px-3 text-xs font-bold text-zinc-950 transition hover:bg-amber-200"
                    >
                      <Send className="size-3.5" />
                      {contestContext.contest.status === "judging" ? "赛后补充" : "提交参赛解法"}
                    </Link>
                  )}
                  </div>
              </div>
            </div>
          )}

          <Link href="/problems" className="text-sm text-zinc-500 transition hover:text-white">
            返回题目列表
          </Link>
          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="bg-cyan-400 px-2 py-1 font-bold text-zinc-950">{problem.region}</span>
                <span className="border border-white/10 px-2 py-1 text-zinc-400">
                  {problem.year} · {problem.paper} · {problem.number}
                </span>
                <span className={`border px-2 py-1 ${difficultyBadgeClass[problem.difficulty]}`}>{problem.difficulty}</span>
              </div>
              <h1 className="mt-4 text-2xl font-black leading-tight text-white sm:text-3xl md:text-5xl">{problem.title}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-400">
                先看题目本体；到「比较」看路线差异，到「解法」展开完整解析。知识点和相关题放在辅助区，避免干扰主线阅读。
              </p>
            </div>
            <div className="grid grid-cols-3 border border-white/10 bg-black/20 text-center sm:max-w-md lg:max-w-none">
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
            {problem.proofGraph && (
              <ProofGraphSummaryStrip problem={problem} submitHref={submitHref} onOpenComparison={showComparison} />
            )}
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
              href={submitHref}
              className="inline-flex h-11 items-center justify-center gap-2 border border-white/10 bg-black/20 px-4 text-sm font-bold text-zinc-200 transition hover:border-cyan-400/40 hover:text-cyan-200"
            >
              <Send className="size-4" />
              {contestContext ? "提交参赛解法" : "提交解法"}
            </Link>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
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
                  href={submitHref}
                  className="inline-flex h-11 items-center justify-center gap-2 border border-white/10 bg-black/20 px-4 text-sm font-bold text-zinc-200 transition hover:border-cyan-400/40 hover:text-cyan-200"
                >
                  <Send className="size-4" />
                  {contestContext ? "提交参赛解法" : "提交解法"}
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
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
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
                <summary className="flex list-none flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm font-bold text-white marker:hidden">
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

        {activeTab === "comparison" && (
          <section id="proof-graph-comparison-content" className="space-y-4 scroll-mt-28">
            <ComparisonTabNav problem={problem} />
            {proofGraph && (
              <div id="comparison-release" className="scroll-mt-28">
                <ProofGraphReleaseCard problem={problem} />
              </div>
            )}
            <div id="comparison-matrix" className="scroll-mt-28">
              <ProofGraphMatrix problem={problem} />
            </div>
            {Boolean(proofGraph?.methodBoundaries.length) && (
              <div id="comparison-boundaries" className="scroll-mt-28">
                <MethodBoundaryHighlights problem={problem} />
              </div>
            )}
            {hasReplay && (
              <div id="comparison-replay" className="scroll-mt-28">
                <ReasoningReplayPanel problem={problem} />
              </div>
            )}
            {Boolean(proofGraph?.challengeEdges.length) && (
              <div id="comparison-challenges" className="scroll-mt-28">
                <ProofChallengeEdges problem={problem} />
              </div>
            )}
            {problem.solutions.length >= 2 && (
              <div id="comparison-diff" className="scroll-mt-28">
                <SolutionDiffPanel problem={problem} />
              </div>
            )}
            {hasProvenance && (
              <div id="comparison-provenance" className="scroll-mt-28">
                <ProofGraphProvenancePanel problem={problem} />
              </div>
            )}
            {Boolean(problem.solutionTree?.roots.length) && (
              <div id="comparison-tree" className="scroll-mt-28">
                <SolutionTreePanel problem={problem} />
              </div>
            )}
          </section>
        )}

        {activeTab === "solutions" && (
          <section className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
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
            <div id="solutions-content">
              <div className="mb-4 flex flex-col gap-2 border border-white/10 bg-zinc-950 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-bold text-white">完整解法</h2>
                  <p className="mt-1 text-xs text-zinc-600">
                    {hideSolutionsForContest
                      ? "比赛进行中，题解暂时隐藏，避免提前形成路径暗示。"
                      : "展开任意解法查看完整推理步骤和验证细节。"}
                  </p>
                </div>
                <Link href={submitHref} className="inline-flex h-9 items-center justify-center gap-2 border border-cyan-400/30 px-3 text-xs font-bold text-cyan-300">
                  <Plus className="size-3.5" />
                  {contestContext ? "提交参赛解法" : "提交新解法"}
                </Link>
              </div>
              {hideSolutionsForContest ? (
                <div className="border border-amber-400/25 bg-amber-400/[0.06] px-6 py-12 text-center">
                  <Trophy className="mx-auto size-7 text-amber-300" />
                  <h3 className="mt-4 font-bold text-white">比赛进行中，题解暂时隐藏</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
                    先把自己的观察写下来。哪怕只是一个入口、一种直觉、一个卡点，也比被已有题解牵着走更有价值。
                  </p>
                  <Link href={submitHref} className="mt-5 inline-flex h-10 items-center justify-center gap-2 bg-amber-300 px-4 text-sm font-bold text-zinc-950">
                    <Send className="size-4" />
                    提交参赛思路
                  </Link>
                </div>
              ) : (
                <>
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
                  action={<Link href={submitHref} className="text-sm font-bold text-cyan-300">提交第一个解法</Link>}
                />
              )}
                </>
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
