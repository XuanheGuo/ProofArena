import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BookOpenCheck, BrainCircuit, Link2, Tags } from "lucide-react";
import { MathBlock } from "@/components/MathBlock";
import { getInsightNode, insightNodes } from "@/data/insights";
import { getKnowledgeNode, knowledgeNodes } from "@/data/knowledge";
import { problems } from "@/data/problems";

export function generateStaticParams() {
  return [...knowledgeNodes, ...insightNodes].map((node) => ({ id: node.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const node = getKnowledgeNode(id) ?? getInsightNode(id);

  return {
    title: node ? `${node.title} | ProofArena 思路库` : "思路库 | ProofArena",
  };
}

export default async function LibraryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const knowledge = getKnowledgeNode(id);
  const insight = getInsightNode(id);

  if (!knowledge && !insight) notFound();

  const isKnowledge = Boolean(knowledge);
  const title = knowledge?.title ?? insight?.title ?? "";
  const category = knowledge?.category ?? getKnowledgeNode(insight?.relatedKnowledgeIds[0] ?? "")?.category ?? "思路触发";
  const summary = knowledge?.summary ?? insight?.idea ?? "";
  const trigger = insight?.trigger ?? knowledge?.examples[0] ?? "看到相关标签、题型结构或目标量时，可以回到这个节点检查是否适用。";
  const relatedKnowledgeIds = knowledge?.relatedIds ?? insight?.relatedKnowledgeIds ?? [];
  const relatedKnowledge = relatedKnowledgeIds.map(getKnowledgeNode).filter((node): node is NonNullable<ReturnType<typeof getKnowledgeNode>> => Boolean(node));
  const relatedProblems = problems.filter((problem) => {
    const problemHit = problem.knowledgeIds?.includes(id) || problem.insightIds?.includes(id);
    const solutionHit = problem.solutions.some((solution) => solution.knowledgeIds?.includes(id) || solution.insightIds?.includes(id));
    return problemHit || solutionHit || insight?.relatedProblemIds.includes(problem.id);
  });
  const relatedSolutions = problems.flatMap((problem) =>
    problem.solutions
      .filter((solution) => solution.knowledgeIds?.includes(id) || solution.insightIds?.includes(id))
      .map((solution) => ({ problem, solution }))
  );
  const exampleTags = knowledge?.aliases ?? insight?.appliesTo ?? [];

  return (
    <main className="grid-surface min-h-screen">
      <section className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6 md:py-14 lg:px-8">
          <Link href="/library" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white">
            <ArrowLeft className="size-4" />
            返回思路库
          </Link>
          <div className="mt-8">
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-cyan-300">
              {isKnowledge ? <BookOpenCheck className="size-4" /> : <BrainCircuit className="size-4" />}
              {isKnowledge ? "知识点节点" : "思路触发节点"}
            </div>
            <h1 className="mt-4 text-4xl font-black text-white md:text-6xl">{title}</h1>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="bg-cyan-400 px-2 py-1 text-xs font-bold text-zinc-950">{category}</span>
              <span className="border border-white/10 px-2 py-1 text-xs text-zinc-400">{isKnowledge ? "知识点" : "思路触发"}</span>
              {insight && <span className="border border-amber-400/25 px-2 py-1 text-xs text-amber-300">{insight.difficulty}</span>}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-6 md:py-12 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <section className="border border-white/10 bg-zinc-950">
            <div className="border-b border-white/10 px-5 py-4">
              <h2 className="font-bold text-white">简介</h2>
            </div>
            <div className="space-y-5 p-5 md:p-7">
              <p className="text-base leading-8 text-zinc-300">
                <MathBlock>{summary}</MathBlock>
              </p>
              <div className="border-l-2 border-amber-400 bg-amber-400/5 p-4">
                <h3 className="text-xs font-bold text-amber-300">什么时候想到它</h3>
                <p className="mt-3 text-sm leading-7 text-zinc-300">
                  <MathBlock>{trigger}</MathBlock>
                </p>
              </div>
              {knowledge && (
                <div className="border border-white/10 bg-black/20 p-4">
                  <h3 className="text-xs font-bold text-cyan-300">前置知识</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {knowledge.prerequisites.map((item) => (
                      <span key={item} className="border border-white/10 px-2.5 py-1.5 text-xs text-zinc-400">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {insight && (
                <div className="border border-white/10 bg-black/20 p-4">
                  <h3 className="text-xs font-bold text-cyan-300">核心想法</h3>
                  <p className="mt-3 text-sm leading-7 text-zinc-300">
                    <MathBlock>{insight.idea}</MathBlock>
                  </p>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-5">
            <section className="border border-white/10 bg-zinc-950 p-5">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
                <Link2 className="size-4" />
                相关知识
              </div>
              <div className="mt-4 grid gap-2">
                {relatedKnowledge.length > 0 ? relatedKnowledge.map((node) => (
                  <Link key={node.id} href={`/library/${node.id}`} className="group border border-white/10 bg-black/20 p-3 transition hover:border-cyan-400/40">
                    <div className="flex items-center justify-between gap-3 text-sm font-bold text-white">
                      {node.title}
                      <ArrowUpRight className="size-3.5 shrink-0 text-zinc-600 group-hover:text-cyan-300" />
                    </div>
                  </Link>
                )) : (
                  <p className="text-sm leading-6 text-zinc-600">暂无明确关联，等待后续共建补充。</p>
                )}
              </div>
            </section>

            <section className="border border-white/10 bg-zinc-950 p-5">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <Tags className="size-4" />
                示例标签
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {exampleTags.map((tag) => (
                  <span key={tag} className="border border-amber-400/20 bg-amber-400/5 px-2.5 py-1.5 text-xs text-zinc-300">
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          </aside>
        </div>

        <section className="mt-5 border border-white/10 bg-zinc-950">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="font-bold text-white">相关题目 / 解法</h2>
          </div>
          <div className="grid gap-px bg-white/10 md:grid-cols-2">
            {relatedProblems.map((problem) => (
              <Link key={problem.id} href={`/problems/${problem.id}`} className="group bg-zinc-950 p-5 transition hover:bg-white/[0.03]">
                <span className="text-xs font-bold text-cyan-300">{problem.number}</span>
                <h3 className="mt-2 font-bold text-white">{problem.title}</h3>
                <p className="mt-2 text-xs leading-6 text-zinc-500">{problem.tags.map((tag) => `#${tag}`).join(" ")}</p>
              </Link>
            ))}
            {relatedSolutions.map(({ problem, solution }) => (
              <Link key={`${problem.id}-${solution.id}`} href={`/problems/${problem.id}#${solution.id}`} className="group bg-zinc-950 p-5 transition hover:bg-white/[0.03]">
                <span className="text-xs font-bold text-amber-300">解法 · {problem.number}</span>
                <h3 className="mt-2 font-bold text-white">{solution.title}</h3>
                <p className="mt-2 line-clamp-2 text-xs leading-6 text-zinc-500">{solution.inspiration}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
