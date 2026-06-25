import { BookOpenCheck, Crosshair, Lightbulb, MoveRight, Repeat2, Sparkles, Target, TimerReset } from "lucide-react";
import type { Problem, Solution } from "@/lib/types";
import { getBestSolution } from "@/data/problems";
import { getInsightNode } from "@/data/insights";
import { getKnowledgeNode } from "@/data/knowledge";
import { getSolutionKindMeta } from "@/lib/solution-kinds";

function bestBy(problem: Problem, score: keyof Solution["scores"]) {
  return getBestSolution(problem, score) ?? problem.solutions[0];
}

export function getShareRoutes(problem: Problem) {
  const exam = bestBy(problem, "examReady");
  const inspiringCandidates = [...problem.solutions].sort((a, b) => {
    const aBonus = a.inspiration || a.transferValue ? 0.3 : 0;
    const bBonus = b.inspiration || b.transferValue ? 0.3 : 0;
    return b.scores.elegance + bBonus - (a.scores.elegance + aBonus);
  });
  const inspiring = inspiringCandidates[0] ?? exam;
  const teaching = bestBy(problem, "explanation");
  const robust = [...problem.solutions].sort((a, b) => {
    const aRobust = a.kind === "robust" ? 2 : 0;
    const bRobust = b.kind === "robust" ? 2 : 0;
    return b.scores.correctness + b.scores.examReady + bRobust - (a.scores.correctness + a.scores.examReady + aRobust);
  })[0] ?? exam;

  return [
    { label: "标准解", description: "考场主线，稳定拿分", solution: exam, icon: TimerReset, tone: "text-cyan-300" },
    { label: "启发解", description: "结构观察，打开思路", solution: inspiring, icon: Sparkles, tone: "text-amber-300" },
    { label: "教学解", description: "层次清楚，适合讲解", solution: teaching, icon: BookOpenCheck, tone: "text-red-300" },
    { label: "稳健解", description: "计算较多，但容错高", solution: robust, icon: Target, tone: "text-emerald-300" },
  ];
}

export function getShareTags(problem: Problem) {
  const knowledgeTags = (problem.knowledgeIds ?? [])
    .map(getKnowledgeNode)
    .filter((node): node is NonNullable<ReturnType<typeof getKnowledgeNode>> => Boolean(node))
    .map((node) => node.title);
  const insightTags = (problem.insightIds ?? [])
    .map(getInsightNode)
    .filter((node): node is NonNullable<ReturnType<typeof getInsightNode>> => Boolean(node))
    .map((node) => node.title);

  return [...new Set([...knowledgeTags, ...insightTags, ...problem.tags])].slice(0, 5);
}

export function getSolutionShareTags(problem: Problem, solution: Solution) {
  const solutionKnowledgeTags = (solution.knowledgeIds ?? [])
    .map(getKnowledgeNode)
    .filter((node): node is NonNullable<ReturnType<typeof getKnowledgeNode>> => Boolean(node))
    .map((node) => node.title);
  const solutionInsightTags = (solution.insightIds ?? [])
    .map(getInsightNode)
    .filter((node): node is NonNullable<ReturnType<typeof getInsightNode>> => Boolean(node))
    .map((node) => node.title);

  return [...new Set([...solutionKnowledgeTags, ...solutionInsightTags, ...solution.tags, ...problem.tags])].slice(0, 5);
}

export function getDefaultShareSolution(problem: Problem) {
  return (
    [...problem.solutions].sort((a, b) => {
      const aSignal = a.inspiration && a.transferValue ? 1 : 0;
      const bSignal = b.inspiration && b.transferValue ? 1 : 0;
      return bSignal + b.scores.explanation + b.scores.elegance - (aSignal + a.scores.explanation + a.scores.elegance);
    })[0] ?? problem.solutions[0]
  );
}

export function ShareCard({ problem, solution }: { problem: Problem; solution: Solution }) {
  const tags = getSolutionShareTags(problem, solution);
  const kindMeta = getSolutionKindMeta(solution.kind);
  const tradeoff = [...solution.tradeoffs, ...solution.limitations][0] ?? "需要结合题目条件判断适用范围。";

  return (
    <article className="mx-auto aspect-[4/5] w-full max-w-[560px] min-w-0 overflow-hidden border border-cyan-400/25 bg-zinc-950 text-white shadow-2xl shadow-cyan-950/20">
      <div className="grid-surface relative flex h-full flex-col bg-[radial-gradient(circle_at_18%_10%,rgba(34,211,238,.20),transparent_28%),radial-gradient(circle_at_85%_8%,rgba(239,68,68,.18),transparent_26%),linear-gradient(145deg,rgba(9,9,11,.96),rgba(24,24,27,.98))] p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center bg-cyan-400 text-zinc-950">
              <Crosshair className="size-5" />
            </span>
            <div>
              <div className="font-display text-lg font-black tracking-wide">ProofArena</div>
              <p className="text-xs font-bold text-cyan-200">不是搜答案，是比较思路。</p>
            </div>
          </div>
          <span className="border border-white/15 bg-black/20 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-zinc-400">
            Solution Card
          </span>
        </div>

        <div className="mt-7">
          <div className="flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="bg-cyan-400 px-2 py-1 text-zinc-950">{problem.region}</span>
            <span className="border border-white/15 bg-black/20 px-2 py-1 text-zinc-300">
              {problem.year} · {problem.paper} · {problem.number}
            </span>
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-zinc-500">本题解法</p>
          <h2 className="mt-2 text-3xl font-black leading-tight text-white sm:text-4xl">{solution.title}</h2>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-zinc-400">{problem.title}</p>
        </div>

        <div className="mt-5 grid grid-cols-[1fr_auto] gap-px bg-white/10">
          <div className="min-w-0 bg-zinc-950/80 p-4">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Type</span>
            <strong className={`mt-2 inline-flex border px-2.5 py-1.5 text-sm ${kindMeta.className}`}>
              {kindMeta.label}
            </strong>
            <p className="mt-2 text-xs text-zinc-500">{kindMeta.description}</p>
          </div>
          <div className="bg-zinc-950/80 p-4 text-right">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Score</span>
            <strong className="mt-1 block font-display text-3xl text-cyan-300">
              {((solution.scores.correctness + solution.scores.examReady + solution.scores.explanation) / 3).toFixed(1)}
            </strong>
            <p className="mt-1 text-xs text-zinc-500">参考，不压扁价值</p>
          </div>
        </div>

        <div className="mt-5 border border-white/10 bg-black/25">
          <div className="border-b border-white/10 px-4 py-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">解法画像</h3>
          </div>
          <div className="grid gap-px bg-white/10">
            <div className="bg-zinc-950/85 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
                <Lightbulb className="size-3.5" />
                启发点
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-zinc-100">{solution.inspiration}</p>
            </div>
            <div className="bg-zinc-950/85 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-300">
                <MoveRight className="size-3.5" />
                关键转化
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-zinc-100">{solution.keyTransform}</p>
            </div>
            <div className="grid gap-px bg-white/10 sm:grid-cols-2">
              <div className="bg-zinc-950/85 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-cyan-300">
                  <Repeat2 className="size-3.5" />
                  迁移价值
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-zinc-300">{solution.transferValue}</p>
              </div>
              <div className="bg-zinc-950/85 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-300">
                  <Sparkles className="size-3.5" />
                  代价
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-zinc-300">{tradeoff}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="border border-cyan-400/20 bg-cyan-400/5 px-2.5 py-1.5 text-[11px] font-bold text-cyan-100">
                #{tag}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-auto border-t border-white/10 pt-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-black text-white">同一道题，解法也有段位。</p>
              <p className="mt-1 text-[11px] leading-5 text-zinc-500">扫码/访问查看这份解法的完整过程</p>
            </div>
            <div className="text-right">
              <div className="font-mono text-[11px] font-bold text-cyan-300">proof-arena.guoxh.dpdns.org</div>
              <div className="mt-2 inline-grid size-11 place-items-center border border-white/15 bg-white/5 font-mono text-[9px] text-zinc-500">
                QR
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
