import type { Metadata } from "next";
import { Hammer, Sparkles } from "lucide-react";
import { StudioWorkspace } from "@/components/StudioWorkspace";
import { getProblems } from "@/lib/db";

export const metadata: Metadata = {
  title: "ProofArena Studio",
  description: "完整投稿工作台，填写结构化解法数据直接提交。",
};

export const revalidate = 3600;

export default async function StudioPage() {
  const problems = await getProblems();
  const problemOptions = problems.map((problem) => ({
    id: problem.id,
    title: problem.title,
    source: `${problem.paper}${problem.number ? ` · ${problem.number}` : ""}`,
    tags: problem.tags,
  }));

  return (
    <main className="grid-surface min-h-screen">
      <section className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-cyan-300">
            <Hammer className="size-4" />
            完整投稿工作台
          </div>
          <h1 className="mt-4 text-4xl font-black text-white md:text-6xl">ProofArena Studio</h1>
          <p className="mt-5 max-w-3xl text-base font-bold leading-8 text-zinc-200 md:text-lg">
            选择一道题，整理一条可以比较、验证和迁移的完整解法。
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
            新题投稿和快速解法可以走
            <a href="/submit" className="text-cyan-400 hover:text-cyan-300 ml-1">普通投稿</a>。
          </p>
          <div className="mt-6 inline-flex items-center gap-2 border border-cyan-400/25 bg-cyan-400/5 px-3 py-2 text-xs font-bold text-cyan-300">
            <Sparkles className="size-4" />
            登录后可直接提交到审核队列
          </div>
        </div>
      </section>

      <StudioWorkspace problems={problemOptions} />
    </main>
  );
}
