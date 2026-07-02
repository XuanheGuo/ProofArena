import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BookOpenCheck, BrainCircuit, Tags } from "lucide-react";
import { MathBlock } from "@/components/MathBlock";
import { insightNodes } from "@/data/insights";
import { knowledgeNodes } from "@/data/knowledge";

export const metadata: Metadata = {
  title: "思路库 | ProofArena",
  description: "ProofArena 的知识点与思路触发器静态样板库。",
};

const categories = ["函数与导数", "圆锥曲线", "数列", "概率统计", "通用方法"];

function insightsForCategory(category: string) {
  const knowledgeIds = new Set(knowledgeNodes.filter((node) => node.category === category).map((node) => node.id));
  return insightNodes.filter((node) => node.relatedKnowledgeIds.some((id) => knowledgeIds.has(id)));
}

export default function LibraryPage() {
  return (
    <main className="grid-surface min-h-screen">
      <section className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-cyan-300">
            <BookOpenCheck className="size-4" />
            知识与思路库
          </div>
          <h1 className="mt-4 text-4xl font-black text-white md:text-6xl">知识点 / 思路库</h1>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-zinc-400 md:text-base">
            这里把题目标签、知识点和“看到什么就想到什么”的思路触发器连起来。当前是静态 demo，规则匹配来自 TypeScript 数据文件，不接数据库，也不做后端 AI。
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
        <div className="grid gap-5">
          {categories.map((category) => {
            const nodes = knowledgeNodes.filter((node) => node.category === category);
            const insights = insightsForCategory(category);

            return (
              <section key={category} className="border border-white/10 bg-zinc-950">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">分类</span>
                    <h2 className="mt-1 text-xl font-black text-white">{category}</h2>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {nodes.length} 个知识点 · {insights.length} 个思路
                  </span>
                </div>
                <div className="grid gap-px bg-white/10 lg:grid-cols-2">
                  <div className="bg-zinc-950 p-5">
                    <div className="mb-4 flex items-center gap-2 text-xs font-bold text-cyan-300">
                      <BookOpenCheck className="size-4" />
                      知识点
                    </div>
                    <div className="grid gap-3">
                      {nodes.map((node) => (
                        <Link key={node.id} href={`/library/${node.id}`} className="group border border-white/10 bg-black/20 p-4 transition hover:border-cyan-400/40">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-bold text-white">{node.title}</h3>
                            <ArrowUpRight className="size-4 shrink-0 text-zinc-600 group-hover:text-cyan-300" />
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-500">
                            <MathBlock>{node.summary}</MathBlock>
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {node.aliases.slice(0, 3).map((alias) => (
                              <span key={alias} className="border border-cyan-400/15 px-2 py-1 text-[11px] text-zinc-500">
                                {alias}
                              </span>
                            ))}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                  <div className="bg-zinc-950 p-5">
                    <div className="mb-4 flex items-center gap-2 text-xs font-bold text-amber-300">
                      <BrainCircuit className="size-4" />
                      思路触发
                    </div>
                    <div className="grid gap-3">
                      {insights.length > 0 ? insights.map((node) => (
                        <Link key={node.id} href={`/library/${node.id}`} className="group border border-white/10 bg-black/20 p-4 transition hover:border-amber-400/40">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-bold text-white">{node.title}</h3>
                            <ArrowUpRight className="size-4 shrink-0 text-zinc-600 group-hover:text-amber-300" />
                          </div>
                          <p className="mt-2 text-sm leading-6 text-zinc-400">
                            <MathBlock>{node.trigger}</MathBlock>
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {node.appliesTo.slice(0, 3).map((item) => (
                              <span key={item} className="inline-flex items-center gap-1 border border-amber-400/15 px-2 py-1 text-[11px] text-zinc-500">
                                <Tags className="size-3" />
                                {item}
                              </span>
                            ))}
                          </div>
                        </Link>
                      )) : (
                        <div className="border border-dashed border-white/10 p-4 text-sm leading-6 text-zinc-600">
                          暂无思路节点，后续可由投稿 tags 或维护者手动补充。
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
