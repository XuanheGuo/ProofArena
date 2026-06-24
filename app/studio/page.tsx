import type { Metadata } from "next";
import { Hammer, ShieldCheck } from "lucide-react";
import { StudioWorkspace } from "@/components/StudioWorkspace";

export const metadata: Metadata = {
  title: "ProofArena Studio",
  description: "把题目、解法与思路标签整理成结构化数据。",
};

export default function StudioPage() {
  return (
    <main className="grid-surface min-h-screen">
      <section className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-cyan-300">
            <Hammer className="size-4" />
            Internal / Demo
          </div>
          <h1 className="mt-4 text-4xl font-black text-white md:text-6xl">ProofArena Studio</h1>
          <p className="mt-5 max-w-3xl text-base font-bold leading-8 text-zinc-200 md:text-lg">
            把题目、解法与思路标签整理成结构化数据。
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">
            第一版只做前端本地状态、标签自动匹配和 JSON 生成。这里不会保存到后端，也不会直接写入 <code className="text-cyan-300">data/problems.ts</code>。
          </p>
          <div className="mt-6 inline-flex items-center gap-2 border border-emerald-400/25 bg-emerald-400/5 px-3 py-2 text-xs font-bold text-emerald-300">
            <ShieldCheck className="size-4" />
            Local only · Static demo
          </div>
        </div>
      </section>

      <StudioWorkspace />
    </main>
  );
}
