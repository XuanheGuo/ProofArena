import { BookOpenCheck, Crosshair, Sparkles, Target, TimerReset } from "lucide-react";
import type { Problem, Solution } from "@/lib/types";
import { getBestSolution } from "@/data/problems";
import { getInsightNode } from "@/data/insights";
import { getKnowledgeNode } from "@/data/knowledge";

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
  const light = bestBy(problem, "calculation");

  return [
    { label: "最适合考场", solution: exam, icon: TimerReset, tone: "text-red-300" },
    { label: "最有启发", solution: inspiring, icon: Sparkles, tone: "text-amber-300" },
    { label: "最适合讲解", solution: teaching, icon: BookOpenCheck, tone: "text-cyan-300" },
    { label: "最少计算", solution: light, icon: Target, tone: "text-emerald-300" },
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

export function ShareCard({ problem }: { problem: Problem }) {
  const routes = getShareRoutes(problem);
  const tags = getShareTags(problem);

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
              <p className="text-xs font-bold text-cyan-200">同一道题，解法也有段位。</p>
            </div>
          </div>
          <span className="border border-white/15 bg-black/20 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-zinc-400">
            Share Card
          </span>
        </div>

        <div className="mt-8">
          <div className="flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="bg-cyan-400 px-2 py-1 text-zinc-950">{problem.region}</span>
            <span className="border border-white/15 bg-black/20 px-2 py-1 text-zinc-300">
              {problem.year} · {problem.paper} · {problem.number}
            </span>
          </div>
          <h2 className="mt-4 text-3xl font-black leading-tight text-white sm:text-4xl">{problem.title}</h2>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-px bg-white/10">
          <div className="bg-zinc-950/80 p-4">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Solutions</span>
            <strong className="mt-1 block font-display text-3xl text-cyan-300">
              {String(problem.solutions.length).padStart(2, "0")}
            </strong>
            <p className="mt-1 text-xs text-zinc-500">已收录解法</p>
          </div>
          <div className="bg-zinc-950/80 p-4">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">Mode</span>
            <strong className="mt-1 block font-display text-3xl text-red-300">VS</strong>
            <p className="mt-1 text-xs text-zinc-500">比较思路，不只看答案</p>
          </div>
        </div>

        <div className="mt-5 border border-white/10 bg-black/25">
          <div className="border-b border-white/10 px-4 py-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">解法导航</h3>
          </div>
          <div className="grid gap-px bg-white/10 sm:grid-cols-2">
            {routes.map(({ label, solution, icon: Icon, tone }) => (
              <div key={label} className="min-w-0 bg-zinc-950/85 p-3">
                <div className={`flex items-center gap-1.5 text-[11px] font-bold ${tone}`}>
                  <Icon className="size-3.5" />
                  {label}
                </div>
                <p className="mt-1.5 truncate text-xs font-bold text-zinc-100">{solution?.title ?? "待补充解法"}</p>
              </div>
            ))}
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
              <p className="text-sm font-black text-white">不是搜答案，是比较思路。</p>
              <p className="mt-1 text-[11px] leading-5 text-zinc-500">扫码/访问查看完整解法，暂时不用真的生成二维码</p>
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
