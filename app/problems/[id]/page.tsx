import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BrainCircuit, ExternalLink, Eye, FileCheck2, Flag, Send, ShieldCheck, Sparkles, Swords, Target } from "lucide-react";
import { MathBlock } from "@/components/MathBlock";
import { SolutionCard } from "@/components/SolutionCard";
import { ConceptBoundaryPanel } from "@/components/ConceptBoundaryPanel";
import { MathVisualization } from "@/components/MathVisualization";
import { SolutionSharePanel } from "@/components/SolutionSharePanel";
import { getBestSolution, getProblem, problems } from "@/data/problems";
import { getInsightNode } from "@/data/insights";
import { getKnowledgeNode } from "@/data/knowledge";
import { difficultyBadgeClass } from "@/lib/problem-presentation";
import type { BoundaryNote, ConceptContrast, ConceptLink, ContrastProblem, KnowledgeNode, Problem, WhyNotMethod } from "@/lib/types";

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildProblemConceptBoundary(problem: Problem, knowledgeNodes: KnowledgeNode[]) {
  const knowledgeConceptLinks: ConceptLink[] = knowledgeNodes.map((node) => ({
    conceptId: node.id,
    label: node.title,
    relation: node.category,
    note: node.summary,
  }));
  const solutionConceptLinks = problem.solutions.flatMap((solution) => solution.conceptLinks ?? []);
  const solutionConceptContrasts = problem.solutions.flatMap((solution) => solution.conceptContrasts ?? []);
  const solutionBoundaryNotes = problem.solutions.flatMap((solution) => solution.boundaryNotes ?? []);
  const solutionContrastProblems = problem.solutions.flatMap((solution) => solution.contrastProblems ?? []);
  const solutionWhyNotMethods = problem.solutions.flatMap((solution) => solution.whyNotMethods ?? []);

  return {
    conceptLinks: uniqueBy(
      [
        ...(problem.conceptLinks ?? []),
        ...knowledgeConceptLinks,
        ...knowledgeNodes.flatMap((node) => node.conceptLinks ?? []),
        ...solutionConceptLinks,
      ],
      (item) => `${item.conceptId ?? item.label}-${item.label}-${item.relation}`
    ),
    conceptContrasts: uniqueBy<ConceptContrast>(
      [
        ...(problem.conceptContrasts ?? []),
        ...knowledgeNodes.flatMap((node) => node.conceptContrasts ?? []),
        ...solutionConceptContrasts,
      ],
      (item) => `${item.conceptA}-${item.conceptB}-${item.keyDifference}`
    ),
    boundaryNotes: uniqueBy<BoundaryNote>(
      [
        ...(problem.boundaryNotes ?? []),
        ...knowledgeNodes.flatMap((node) => node.boundaryNotes ?? []),
        ...solutionBoundaryNotes,
      ],
      (item) => `${item.title}-${item.note}`
    ),
    contrastProblems: uniqueBy<ContrastProblem>(
      [
        ...(problem.contrastProblems ?? []),
        ...knowledgeNodes.flatMap((node) => node.contrastProblems ?? []),
        ...solutionContrastProblems,
      ],
      (item) => `${item.problemId}-${item.role}-${item.focus}`
    ),
    whyNotMethods: uniqueBy<WhyNotMethod>(
      [
        ...(problem.whyNotMethods ?? []),
        ...knowledgeNodes.flatMap((node) => node.whyNotMethods ?? []),
        ...solutionWhyNotMethods,
      ],
      (item) => `${item.methodName}-${item.reason}`
    ),
  };
}

export function generateStaticParams() {
  return problems.map((problem) => ({ id: problem.id }));
}

export default async function ProblemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const problem = getProblem(id);

  if (!problem) notFound();

  const examSolution = getBestSolution(problem, "examReady");
  const inspiringSolution = getBestSolution(problem, "elegance");
  const teachingSolution = getBestSolution(problem, "explanation");
  const robustSolution = [...problem.solutions].sort((a, b) => {
    const aRobust = a.kind === "robust" ? 2 : 0;
    const bRobust = b.kind === "robust" ? 2 : 0;
    return b.scores.correctness + b.scores.examReady + bRobust - (a.scores.correctness + a.scores.examReady + aRobust);
  })[0] ?? examSolution;
  const solutionNavigation = [
    { label: "标准解", tone: "text-cyan-300", solution: examSolution, note: "考场主线，稳定拿分。" },
    { label: "启发解", tone: "text-amber-300", solution: inspiringSolution, note: inspiringSolution.inspiration },
    { label: "教学解", tone: "text-red-300", solution: teachingSolution, note: "层次清楚，适合讲解。" },
    { label: "稳健解", tone: "text-emerald-300", solution: robustSolution, note: "计算较多，但容错高。" },
  ];
  const hasVisualization = new Set([
    "ng2-2026-18",
    "tj-2026-18",
    "tj-2026-20",
  ]).has(problem.id);
  const autoMatches = problem.autoMatches ?? [];
  const manualMatches = problem.manualMatches ?? [];
  const autoKnowledgeNodes = [...new Set(autoMatches.flatMap((match) => match.matchedKnowledgeIds))]
    .map(getKnowledgeNode)
    .filter((node): node is NonNullable<ReturnType<typeof getKnowledgeNode>> => Boolean(node));
  const autoInsightNodes = [...new Set(autoMatches.flatMap((match) => match.matchedInsightIds))]
    .map(getInsightNode)
    .filter((node): node is NonNullable<ReturnType<typeof getInsightNode>> => Boolean(node));
  const manualKnowledgeNodes = [...new Set(manualMatches.flatMap((match) => match.matchedKnowledgeIds))]
    .map(getKnowledgeNode)
    .filter((node): node is NonNullable<ReturnType<typeof getKnowledgeNode>> => Boolean(node));
  const manualInsightNodes = [...new Set(manualMatches.flatMap((match) => match.matchedInsightIds))]
    .map(getInsightNode)
    .filter((node): node is NonNullable<ReturnType<typeof getInsightNode>> => Boolean(node));
  const problemKnowledgeNodes = (problem.knowledgeIds ?? [])
    .map(getKnowledgeNode)
    .filter((node): node is NonNullable<ReturnType<typeof getKnowledgeNode>> => Boolean(node));
  const conceptBoundary = buildProblemConceptBoundary(problem, problemKnowledgeNodes);
  const problemLookup = Object.fromEntries(
    problems.map((item) => [item.id, { number: item.number, title: item.title }])
  );

  return (
    <main className="grid-surface min-h-screen">
      <section className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
          <Link href="/problems" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white">
            <ArrowLeft className="size-4" />
            返回题目擂台
          </Link>
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_18rem]">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="bg-cyan-400 px-2 py-1 font-bold text-zinc-950">{problem.region}</span>
                <span className="border border-white/10 px-2 py-1 text-zinc-400">
                  {problem.year} · {problem.paper} · {problem.number}
                </span>
                <span className="border border-cyan-400/30 px-2 py-1 text-cyan-300">{problem.questionType}</span>
                <span className={`border px-2 py-1 ${difficultyBadgeClass[problem.difficulty]}`}>{problem.difficulty}</span>
              </div>
              <h1 className="mt-5 text-3xl font-black text-white md:text-5xl">{problem.title}</h1>
              <div className="mt-5 flex flex-wrap gap-2">
                {problem.tags.map((tag) => (
                  <span key={tag} className="text-sm text-zinc-500">#{tag}</span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 border border-white/10 bg-black/20 lg:grid-cols-1">
              <div className="border-r border-white/10 p-4 lg:border-r-0 lg:border-b">
                <span className="font-mono text-[11px] uppercase text-zinc-600">热度</span>
                <strong className="mt-1 block font-display text-3xl text-red-400">{problem.heat}</strong>
              </div>
              <div className="p-4">
                <span className="font-mono text-[11px] uppercase text-zinc-600">解法</span>
                <strong className="mt-1 block font-display text-3xl text-cyan-300">
                  {String(problem.solutions.length).padStart(2, "0")}
                </strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <nav
        aria-label="阅读路径"
        className="sticky top-16 z-40 border-b border-white/10 bg-zinc-950/95 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-2 md:px-6">
          {[
            ["看题", "problem"],
            ["观察入口", "thinking"],
            ["概念辨析", "concept-boundary"],
            ["选择解法", "choose"],
            ["解法画像", "profiles"],
            ["完整过程", "full-process"],
            ["投稿挑战", "challenge"],
          ].map(([label, target], index) => (
            <a
              key={target}
              href={`#${target}`}
              className="flex shrink-0 items-center gap-2 border border-transparent px-3 py-2 text-xs font-semibold text-zinc-400 transition hover:border-white/10 hover:bg-white/[0.03] hover:text-white"
            >
              <span className="font-mono text-[10px] text-cyan-400">{String(index + 1).padStart(2, "0")}</span>
              {label}
            </a>
          ))}
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <section id="problem" className="scroll-mt-32 border border-white/10 bg-zinc-950">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <span className="font-mono text-xs uppercase tracking-widest text-zinc-500">题干</span>
            <span className="text-xs text-zinc-600">2026 真题 · 扫描页核对</span>
          </div>
          <div className="space-y-4 p-5 text-base leading-8 text-zinc-200 md:p-8 md:text-lg">
            {problem.statement.map((paragraph) => (
              <p key={paragraph}><MathBlock>{paragraph}</MathBlock></p>
            ))}
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
              <a
                href={`${problem.sourcePdf}#page=${problem.sourcePage}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 border border-cyan-400/30 bg-cyan-400/5 px-3 text-xs font-bold text-cyan-300 hover:bg-cyan-400/10"
              >
                <ExternalLink className="size-3.5" />
                查看原题扫描页 · P{problem.sourcePage}
              </a>
              {problem.answerPdf && (
                <a
                  href={problem.answerPdf}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 border border-white/10 px-3 text-xs text-zinc-400 hover:text-white"
                >
                  <FileCheck2 className="size-3.5" />
                  打开官方答案 PDF
                </a>
              )}
            </div>
            <div className="border-l-2 border-emerald-400 bg-emerald-400/5 px-4 py-3 text-sm">
              <span className="font-bold text-emerald-300">参考答案：</span>
              <MathBlock>{problem.answer}</MathBlock>
            </div>
          </div>
        </section>

        <section id="thinking" className="mt-5 scroll-mt-32 border border-cyan-400/25 bg-zinc-950">
          <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
            <BrainCircuit className="size-4 text-cyan-300" />
            <div>
              <h2 className="text-sm font-bold text-white">这题怎么想到？</h2>
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">先找观察入口</span>
            </div>
          </div>
          <div className="grid gap-px bg-white/10 md:grid-cols-2 xl:grid-cols-4">
            <div className="bg-zinc-950 p-5">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                <Eye className="size-4" />
                题目特征
              </div>
              <ul className="mt-4 space-y-3">
                {problem.learningGuide.observation.map((item) => (
                  <li key={item} className="border-l border-cyan-400/40 pl-3 text-sm leading-6 text-zinc-300">
                    <MathBlock>{item}</MathBlock>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-zinc-950 p-5">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <Sparkles className="size-4" />
                思路触发词
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {problem.learningGuide.triggers.map((trigger) => (
                  <span key={trigger} className="border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs leading-6 text-zinc-300">
                    <MathBlock>{trigger}</MathBlock>
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-zinc-950 p-5">
              <div className="flex items-center gap-2 text-xs font-bold text-red-300">
                <Flag className="size-4" />
                常见误区
              </div>
              <ul className="mt-4 space-y-3">
                {problem.learningGuide.pitfalls.map((item) => (
                  <li key={item} className="border-l border-red-400/40 pl-3 text-sm leading-6 text-zinc-300">
                    <MathBlock>{item}</MathBlock>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-zinc-950 p-5">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
                <Target className="size-4" />
                推荐阅读路径
              </div>
              <ol className="mt-4 space-y-3">
                {problem.learningGuide.readingPath.map((item, index) => (
                  <li key={item} className="grid grid-cols-[1.5rem_1fr] gap-2 text-sm leading-6 text-zinc-300">
                    <span className="font-mono text-xs text-emerald-300">{index + 1}</span>
                    <span><MathBlock>{item}</MathBlock></span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section id="related-library" className="mt-5 scroll-mt-32 border border-amber-400/25 bg-zinc-950">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-2">
              <BrainCircuit className="size-4 text-amber-300" />
              <div>
                <h2 className="text-sm font-bold text-white">相关知识与思路</h2>
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">标签关联结果</span>
              </div>
            </div>
            <Link href="/library" className="inline-flex h-9 items-center gap-2 border border-white/10 px-3 text-xs font-bold text-zinc-400 transition hover:border-amber-400/40 hover:text-amber-200">
              打开思路库
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
          <div className="grid gap-px bg-white/10 lg:grid-cols-[1.1fr_1.1fr_.9fr]">
            <div className="bg-zinc-950 p-5">
              <h3 className="text-xs font-bold text-cyan-300">自动匹配的知识点</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {autoKnowledgeNodes.map((node) => (
                  <Link key={node.id} href={`/library/${node.id}`} className="border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-xs text-zinc-300 transition hover:border-cyan-400/50 hover:text-cyan-200">
                    {node.title}
                  </Link>
                ))}
              </div>
              <h3 className="mt-5 text-xs font-bold text-amber-300">自动匹配的思路触发</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {autoInsightNodes.map((node) => (
                  <Link key={node.id} href={`/library/${node.id}`} className="border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-zinc-300 transition hover:border-amber-400/50 hover:text-amber-200">
                    {node.title}
                  </Link>
                ))}
              </div>
            </div>
            <div className="bg-zinc-950 p-5">
              <h3 className="text-xs font-bold text-emerald-300">手动补充的关联</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {[...manualKnowledgeNodes, ...manualInsightNodes].map((node) => (
                  <Link key={node.id} href={`/library/${node.id}`} className="border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-xs text-zinc-300 transition hover:border-emerald-400/50 hover:text-emerald-200">
                    {node.title}
                  </Link>
                ))}
              </div>
              <p className="mt-4 text-xs leading-6 text-zinc-600">
                手动关联用于覆盖规则匹配看不出的“本题关键观察”，后续维护者可以继续补充。
              </p>
            </div>
            <div className="bg-zinc-950 p-5">
              <h3 className="text-xs font-bold text-red-300">匹配来源与置信度</h3>
              <div className="mt-4 space-y-2">
                {[...autoMatches, ...manualMatches].map((match) => (
                  <div key={`${match.source}-${match.tag}`} className="border border-white/10 bg-black/20 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-bold text-zinc-300">#{match.tag}</span>
                      <span className={match.source === "manual" ? "text-xs text-emerald-300" : "text-xs text-cyan-300"}>
                        {match.source === "manual" ? "手动" : "自动"} · {(match.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-zinc-600">
                      知识点 {match.matchedKnowledgeIds.length} · 思路 {match.matchedInsightIds.length}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {hasVisualization && <MathVisualization problemId={problem.id} />}

        <ConceptBoundaryPanel
          id="concept-boundary"
          title="概念辨析"
          description="用相邻概念、反例题和不用某方法的理由，把解法选择的边界讲清楚。"
          conceptLinks={conceptBoundary.conceptLinks}
          conceptContrasts={conceptBoundary.conceptContrasts}
          boundaryNotes={conceptBoundary.boundaryNotes}
          contrastProblems={conceptBoundary.contrastProblems}
          whyNotMethods={conceptBoundary.whyNotMethods}
          problemLookup={problemLookup}
          className="mt-5"
        />

        <section id="choose" className="mt-5 scroll-mt-32 border border-white/10 bg-zinc-950 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold text-zinc-400">
            <Target className="size-4 text-cyan-300" />
            适合谁看
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {[
              { audience: "想拿分", action: "先看标准解", advice: "先建立稳定得分主线，再补充其他视角。", solution: examSolution },
              { audience: "想提思维", action: "看启发解", advice: "重点体会参数消去、结构识别和关键构造。", solution: inspiringSolution },
              { audience: "想讲给别人", action: "看教学解", advice: "沿着可复述的步骤组织语言与板书。", solution: teachingSolution },
            ].map(({ audience, action, advice, solution: targetSolution }) => {
              return (
                <a
                  key={audience}
                  href={`#${targetSolution.id}`}
                  className="group border border-white/10 bg-black/20 p-3 transition hover:border-cyan-400/35"
                >
                  <span className="text-xs font-bold text-cyan-300">{audience}</span>
                  <span className="mx-2 text-zinc-700">·</span>
                  <span className="text-xs text-zinc-500">{action}</span>
                  <strong className="mt-2 flex items-center justify-between gap-2 text-sm text-zinc-200">
                    <span className="truncate">{targetSolution.title}</span>
                    <ArrowUpRight className="size-3.5 shrink-0 text-zinc-600 group-hover:text-cyan-300" />
                  </strong>
                  <p className="mt-2 text-xs leading-5 text-zinc-600">{advice}</p>
                </a>
              );
            })}
          </div>
        </section>

        <section id="navigation" className="my-8 scroll-mt-32 border border-white/10 bg-zinc-950">
          <div className="flex items-center gap-2 border-b border-white/10 p-4 text-sm font-bold text-white">
            <Swords className="size-4 text-red-400" />
            解法导航
            <span className="ml-auto hidden text-xs font-normal text-zinc-600 sm:block">按学习用途选择路线，而不是只看总分</span>
          </div>
          <div className="grid gap-px bg-white/10 md:grid-cols-2">
            {solutionNavigation.map(({ label, tone, solution, note }) => (
              <a
                key={`${label}-${solution.id}`}
                href={`#${solution.id}`}
                className="group bg-zinc-950 p-4 transition hover:bg-white/[0.03]"
              >
                <span className={`text-xs font-bold ${tone}`}>{label}</span>
                <strong className="mt-2 flex items-center justify-between gap-3 text-sm text-white">
                  {solution.title}
                  <ArrowUpRight className="size-4 shrink-0 text-zinc-600 group-hover:text-cyan-300" />
                </strong>
                <p className="mt-2 line-clamp-2 text-xs leading-6 text-zinc-500">
                  <MathBlock>{note}</MathBlock>
                </p>
              </a>
            ))}
          </div>
        </section>

        <section id="profiles" className="scroll-mt-32">
          <div className="mb-4 border border-white/10 bg-zinc-950 p-4 md:p-5">
            <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-white">
              <BrainCircuit className="size-4 text-cyan-300" />
              解法画像
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">先看画像，再看过程</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              默认先看每条路线的启发点、迁移价值、适用场景和局限。需要完整推导时，再点击卡片里的“展开完整解法”。
            </p>
          </div>
          <div id="full-process" className="scroll-mt-32 space-y-8">
            {problem.solutions.map((solution, index) => (
              <SolutionCard key={solution.id} solution={solution} rank={index + 1} />
            ))}
          </div>
        </section>

        <SolutionSharePanel problem={problem} />

        <section id="challenge" className="mt-8 scroll-mt-32 border border-cyan-400/30 bg-cyan-400/[0.06] p-6 md:flex md:items-center md:justify-between md:p-8">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-cyan-300">
              <ShieldCheck className="size-4" />
              补充解法视角
            </div>
            <h2 className="mt-3 text-2xl font-black text-white">你有更好的解法？</h2>
            <p className="mt-2 text-sm text-zinc-400">按统一模板整理思路、完整过程、易错点与自评分。</p>
          </div>
          <Link
            href="/submit"
            className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 bg-cyan-400 px-5 text-sm font-bold text-zinc-950 transition hover:bg-cyan-300 md:mt-0 md:w-auto"
          >
            <Send className="size-4" />
            提交我的解法
          </Link>
        </section>
      </div>
    </main>
  );
}
