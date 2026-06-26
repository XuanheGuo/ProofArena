import { BookOpenCheck, Crosshair, Lightbulb, MoveRight, Repeat2, Sparkles, Target, TimerReset } from "lucide-react";
import type { Problem, Solution } from "@/lib/types";
import { getBestSolution } from "@/data/problems";
import { getInsightNode } from "@/data/insights";
import { getKnowledgeNode } from "@/data/knowledge";
import { MathBlock } from "@/components/MathBlock";
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

export type ShareCardMode = "idea" | "transform" | "full";

const shareModeCopy: Record<ShareCardMode, { eyebrow: string; title: string; minHeight: string }> = {
  idea: { eyebrow: "思路卡", title: "这一步是怎么想到的", minHeight: "min-h-[600px] xl:min-h-[460px]" },
  transform: { eyebrow: "转化卡", title: "关键转化", minHeight: "min-h-[600px] xl:min-h-[460px]" },
  full: { eyebrow: "完整过程", title: "从观察到落笔", minHeight: "min-h-[800px] xl:min-h-[580px]" },
};

function ShareSection({ icon: Icon, title, children }: { icon: typeof Lightbulb; title: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-cyan-400/75 py-0.5 pl-3">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-cyan-300">
        <Icon className="size-3.5" />
        {title}
      </div>
      <div className="mt-1.5 break-words text-xs leading-5 text-zinc-100">{children}</div>
    </div>
  );
}

export function ShareCard({
  problem,
  solution,
  mode = "idea",
}: {
  problem: Problem;
  solution: Solution;
  mode?: ShareCardMode;
}) {
  const tags = getSolutionShareTags(problem, solution);
  const kindMeta = getSolutionKindMeta(solution.kind);
  const tradeoff = [...solution.tradeoffs, ...solution.limitations][0] ?? "需要结合题目条件判断适用范围。";
  const modeCopy = shareModeCopy[mode];

  return (
    <article
      data-testid="solution-share-card"
      className="share-card mx-auto w-full max-w-[460px] min-w-0 overflow-hidden border border-white/10 border-t-2 border-t-cyan-400 bg-zinc-950 text-white shadow-xl shadow-black/15 xl:max-w-[900px]"
    >
      <div className={`flex ${modeCopy.minHeight} flex-col p-5 sm:p-6`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center border border-cyan-400/40 bg-cyan-400/10 text-cyan-300">
              <Crosshair className="size-4" />
            </span>
            <div>
              <div className="font-display text-lg font-black tracking-wide">ProofArena</div>
              <p className="text-xs font-bold text-cyan-200">不是搜答案，是比较思路。</p>
            </div>
          </div>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            解法卡
          </span>
        </div>

        <div className="mt-5 xl:grid xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] xl:gap-4">
          <div>
            <div className="flex flex-wrap gap-2 text-[11px] font-bold">
              <span className="bg-cyan-400 px-2 py-1 text-zinc-950">{problem.region}</span>
              <span className="border border-white/10 px-2 py-1 text-zinc-400">
                {problem.year} · {problem.paper} · {problem.number}
              </span>
            </div>
            <p className="mt-3 text-xs font-bold uppercase tracking-widest text-zinc-500">{modeCopy.eyebrow} · 本题解法</p>
            <h2 className="mt-1.5 text-[1.7rem] font-black leading-tight text-white sm:text-4xl">{solution.title}</h2>
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-400">{problem.title}</p>

            <div className="mt-5 border-l-2 border-white/20 pl-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-zinc-500">题目</p>
              <div className="mt-2 space-y-1.5 text-xs leading-5 text-zinc-300">
                {problem.statement.map((line, index) => (
                  <p key={`${line}-${index}`}>
                    <MathBlock>{line}</MathBlock>
                  </p>
                ))}
              </div>
            </div>

            <div className="mt-5 flex items-end justify-between gap-4 border-y border-white/10 py-3">
              <div className="min-w-0">
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">解法类型</span>
                <strong className={`mt-1.5 inline-flex border px-2 py-1 text-xs ${kindMeta.className}`}>
                  {kindMeta.label}
                </strong>
                <p className="mt-1.5 text-xs text-zinc-500">{kindMeta.description}</p>
              </div>
              <div className="shrink-0 border-l border-white/10 pl-4 text-right">
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">参考分</span>
                <strong className="mt-1 block font-display text-2xl text-cyan-300">
                  {((solution.scores.correctness + solution.scores.examReady + solution.scores.explanation) / 3).toFixed(1)}
                </strong>
                <p className="mt-0.5 text-[10px] text-zinc-500">辅助参考</p>
              </div>
            </div>
          </div>

          <div className="mt-5 xl:mt-0">
            <div className="border-l-2 border-cyan-400 pl-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">{modeCopy.title}</h3>
          </div>
          <div className="mt-4 space-y-4">
            {mode === "idea" && (
              <ShareSection icon={Lightbulb} title="思路来源">
                <MathBlock>{solution.origin}</MathBlock>
                <div className="mt-3 border-t border-white/10 pt-3 text-zinc-300">
                  <span className="font-bold text-amber-300">启发点：</span>
                  <MathBlock>{solution.inspiration}</MathBlock>
                </div>
              </ShareSection>
            )}
            {mode === "transform" && (
              <ShareSection icon={MoveRight} title="关键转化">
                <MathBlock>{solution.keyTransform}</MathBlock>
              </ShareSection>
            )}
            {mode === "full" && (
              <>
                <ShareSection icon={Lightbulb} title="思路来源">
                  <MathBlock>{solution.origin}</MathBlock>
                </ShareSection>
                <ShareSection icon={MoveRight} title="关键转化">
                  <MathBlock>{solution.keyTransform}</MathBlock>
                </ShareSection>
                <div className="border-l-2 border-red-400/75 py-0.5 pl-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-300">
                    <BookOpenCheck className="size-3.5" />
                    完整过程
                  </div>
                  <ol className="mt-2 space-y-2 text-xs leading-5 text-zinc-100">
                    {solution.summary.map((step, index) => (
                      <li key={`${step}-${index}`} className="flex gap-2">
                        <span className="font-mono text-cyan-300">0{index + 1}</span>
                        <span><MathBlock>{step}</MathBlock></span>
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            )}
          </div>
        </div>

            {mode !== "full" && (
              <div className="mt-5 grid gap-5 border-t border-white/10 pt-5 sm:grid-cols-2">
                <ShareSection icon={Repeat2} title="迁移价值">
                  <MathBlock>{solution.transferValue}</MathBlock>
                </ShareSection>
                <ShareSection icon={Sparkles} title="代价">
                  <MathBlock>{tradeoff}</MathBlock>
                </ShareSection>
              </div>
            )}

            <div className="mt-5 border-t border-white/10 pt-4">
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span key={tag} className="border border-cyan-400/20 bg-cyan-400/5 px-2.5 py-1.5 text-[11px] font-bold text-cyan-100">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto border-t border-white/10 pt-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-black text-white">同一道题，解法也有段位。</p>
              <p className="mt-1 text-[11px] leading-5 text-zinc-500">访问 ProofArena 查看这份解法的完整过程</p>
            </div>
            <div className="text-right">
              <div className="font-mono text-[11px] font-bold text-cyan-300">proof-arena.guoxh.dpdns.org</div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
