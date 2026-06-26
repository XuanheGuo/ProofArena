import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BookOpenCheck, Code2, GitBranch, Scale, Swords } from "lucide-react";

export const metadata: Metadata = {
  title: "关于 ProofArena",
  description: "ProofArena 的目标、Demo 状态与开源协议。",
};

export default function AboutPage() {
  return (
    <main className="grid-surface min-h-screen">
      <section className="border-b border-white/10 bg-zinc-950/90">
        <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6 md:py-16 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white">
            <ArrowLeft className="size-4" />
            返回首页
          </Link>
          <div className="mt-10">
            <span className="font-mono text-xs uppercase tracking-widest text-cyan-300">关于 ProofArena</span>
            <h1 className="mt-4 text-4xl font-black text-white md:text-6xl">ProofArena 不是搜题网站</h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-300 md:text-lg">
              我们不追求把答案堆得更多，而是把同一道题的不同解法放在一起，认真比较它们为什么成立、何时好用，以及学生能从中带走什么。
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6 md:py-14 lg:px-8">
        <section className="grid gap-px bg-white/10 md:grid-cols-3">
          {[
            [Swords, "比较解法", "用正确性、考场性、结构美感、计算量与讲解友好度建立共同坐标。"],
            [BookOpenCheck, "学习思路", "保留观察入口、思路来源与关键转化，让“怎么想到”可以被复盘。"],
            [GitBranch, "沉淀题解", "通过公开投稿、校订和验证，逐步形成可引用、可改进的高质量内容。"],
          ].map(([Icon, title, description]) => {
            const ItemIcon = Icon as typeof Swords;
            return (
              <div key={title as string} className="bg-zinc-950 p-6">
                <ItemIcon className="size-5 text-cyan-300" />
                <h2 className="mt-5 text-lg font-bold text-white">{title as string}</h2>
                <p className="mt-3 text-sm leading-7 text-zinc-500">{description as string}</p>
              </div>
            );
          })}
        </section>

        <section className="mt-6 border border-amber-400/25 bg-amber-400/5 p-6 md:p-8">
          <span className="font-mono text-xs uppercase tracking-widest text-amber-300">Demo 状态</span>
          <h2 className="mt-3 text-2xl font-black text-white">现在仍是一个可运行的样板</h2>
          <p className="mt-3 text-sm leading-7 text-zinc-400">
            当前为 ProofArena Demo，题目与解法数据仍在整理中。现阶段重点是验证阅读路径、评分体系、交互图像和投稿规范，而不是追求题目数量。
          </p>
        </section>

        <section className="mt-6 border border-white/10 bg-zinc-950">
          <div className="flex items-center gap-2 border-b border-white/10 px-6 py-4">
            <Scale className="size-4 text-cyan-300" />
            <h2 className="font-bold text-white">开放协议</h2>
          </div>
          <div className="grid gap-px bg-white/10 sm:grid-cols-2">
            <div className="bg-zinc-950 p-6">
              <Code2 className="size-5 text-cyan-300" />
              <span className="mt-5 block font-mono text-xs uppercase text-zinc-500">代码</span>
              <strong className="mt-2 block text-2xl text-white">AGPL-3.0</strong>
              <p className="mt-3 text-sm leading-6 text-zinc-500">应用代码以 AGPL-3.0 协议开放。</p>
            </div>
            <div className="bg-zinc-950 p-6">
              <BookOpenCheck className="size-5 text-amber-300" />
              <span className="mt-5 block font-mono text-xs uppercase text-zinc-500">内容</span>
              <strong className="mt-2 block text-2xl text-white">CC BY-SA 4.0</strong>
              <p className="mt-3 text-sm leading-6 text-zinc-500">原创题解与编辑内容采用署名、相同方式共享协议。</p>
            </div>
          </div>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/problems" className="inline-flex h-11 items-center bg-cyan-400 px-4 text-sm font-bold text-zinc-950">
            查看题目擂台
          </Link>
          <Link href="/submit" className="inline-flex h-11 items-center border border-white/20 px-4 text-sm font-bold text-white">
            提交你的解法
          </Link>
        </div>
      </div>
    </main>
  );
}
