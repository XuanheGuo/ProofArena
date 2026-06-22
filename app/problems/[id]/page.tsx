import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BrainCircuit, ExternalLink, Eye, FileCheck2, Flag, Send, ShieldCheck, Sparkles, Swords, Target } from "lucide-react";
import { MathBlock } from "@/components/MathBlock";
import { SolutionCard } from "@/components/SolutionCard";
import { MathVisualization } from "@/components/MathVisualization";
import { getBestSolution, getProblem, getSolutionAverage, problems } from "@/data/problems";

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

  const rankedSolutions = [...problem.solutions].sort(
    (a, b) => getSolutionAverage(b) - getSolutionAverage(a),
  );
  const examSolution = getBestSolution(problem, "examReady");
  const elegantSolution = getBestSolution(problem, "elegance");
  const teachingSolution = getBestSolution(problem, "explanation");
  const hasVisualization = new Set([
    "tj-2026-18",
    "tj-2026-20",
  ]).has(problem.id);

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
                <span className="border border-red-400/30 px-2 py-1 text-red-300">{problem.difficulty}</span>
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
                <span className="font-mono text-[11px] uppercase text-zinc-600">Heat</span>
                <strong className="mt-1 block font-display text-3xl text-red-400">{problem.heat}</strong>
              </div>
              <div className="p-4">
                <span className="font-mono text-[11px] uppercase text-zinc-600">Solutions</span>
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
            ["题目", "problem"],
            ["这题怎么想到", "thinking"],
            ...(hasVisualization ? [["图像实验", "visualization"]] : []),
            ["选择解法", "choose"],
            ["解法排行", "ranking"],
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
            <span className="font-mono text-xs uppercase tracking-widest text-zinc-500">Problem statement</span>
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
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Before the solution</span>
            </div>
          </div>
          <div className="grid gap-px bg-white/10 lg:grid-cols-[1fr_1.2fr_1fr]">
            <div className="bg-zinc-950 p-5">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                <Eye className="size-4" />
                观察入口
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
                推荐先看
              </div>
              <p className="mt-4 text-sm leading-7 text-zinc-300">
                <MathBlock>{problem.learningGuide.recommendation}</MathBlock>
              </p>
            </div>
          </div>
        </section>

        {hasVisualization && <MathVisualization problemId={problem.id} />}

        <section id="choose" className="mt-5 scroll-mt-32 border border-white/10 bg-zinc-950 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold text-zinc-400">
            <Target className="size-4 text-cyan-300" />
            适合谁看
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            {[
              { audience: "想拿分", action: "先看标准解", advice: "先建立稳定得分主线，再补充其他视角。", solution: examSolution },
              { audience: "想提思维", action: "看最优雅解", advice: "重点体会参数消去、结构识别和关键构造。", solution: elegantSolution },
              { audience: "想讲给别人", action: "看讲解友好最高的解法", advice: "沿着可复述的步骤组织语言与板书。", solution: teachingSolution },
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

        <section id="ranking" className="my-8 scroll-mt-32 border border-white/10 bg-zinc-950">
          <div className="flex items-center gap-2 border-b border-white/10 p-4 text-sm font-bold text-white">
            <Swords className="size-4 text-red-400" />
            解法排行榜
          </div>
          <div className="divide-y divide-white/10">
            {rankedSolutions.map((solution, index) => (
              <a
                key={solution.id}
                href={`#${solution.id}`}
                className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 p-4 transition hover:bg-white/[0.03] md:grid-cols-[4rem_1fr_10rem_5rem]"
              >
                <span className="font-display text-2xl font-black text-zinc-500">#{index + 1}</span>
                <span>
                  <strong className="block text-sm text-white">{solution.title}</strong>
                  <span className="mt-1 block text-xs text-zinc-600">{solution.author}</span>
                </span>
                <span className="hidden text-xs text-zinc-500 md:block">{solution.badge}</span>
                <span className="flex items-center justify-end gap-2 font-display text-xl font-black text-cyan-300">
                  {getSolutionAverage(solution).toFixed(1)}
                  <ArrowUpRight className="size-4" />
                </span>
              </a>
            ))}
          </div>
        </section>

        <div className="space-y-8">
          {rankedSolutions.map((solution, index) => (
            <SolutionCard key={solution.id} solution={solution} rank={index + 1} />
          ))}
        </div>

        <section id="challenge" className="mt-8 scroll-mt-32 border border-cyan-400/30 bg-cyan-400/[0.06] p-6 md:flex md:items-center md:justify-between md:p-8">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-cyan-300">
              <ShieldCheck className="size-4" />
              挑战当前榜单
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
