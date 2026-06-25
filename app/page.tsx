import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronRight, Send, Swords, Trophy } from "lucide-react";
import { ProblemCard } from "@/components/ProblemCard";
import { problems } from "@/data/problems";

export default function HomePage() {
  const featuredProblems = ["tj-2026-20", "tj-2026-19", "tj-2026-18"]
    .map((id) => problems.find((problem) => problem.id === id))
    .filter((problem): problem is (typeof problems)[number] => Boolean(problem));

  return (
    <main>
      <section className="hero-arena relative min-h-[68vh] overflow-hidden border-b border-white/10">
        <Image
          src="/arena-background.png"
          alt=""
          fill
          priority
          className="object-cover object-center opacity-65"
        />
        <div className="hero-overlay absolute inset-0 bg-[linear-gradient(90deg,#09090b_5%,rgba(9,9,11,.92)_36%,rgba(9,9,11,.25)_75%,#09090b_100%)]" />
        <div className="grid-surface absolute inset-0 opacity-40" />
        <div className="relative mx-auto flex min-h-[68vh] max-w-7xl items-center px-4 py-16 md:px-6">
          <div className="max-w-3xl">
            <div className="mb-5 flex items-center gap-3 font-mono text-xs uppercase tracking-[0.18em] text-cyan-300">
              <span className="h-px w-8 bg-cyan-400" />
              2026 高考数学赛季
            </div>
            <h1 className="font-display text-5xl font-black leading-[1.02] text-white sm:text-6xl md:text-8xl">
              Proof<span className="text-cyan-300">Arena</span>
            </h1>
            <p className="mt-5 text-xl font-bold text-zinc-100 md:text-2xl">
              同一道题，多种解法，正面交锋。
            </p>
            <p className="mt-3 max-w-2xl border-l-2 border-red-500 pl-4 text-sm font-semibold leading-7 text-zinc-200 md:text-base">
              同一道题，把标准解、启发解、稳健解、教学解放在一起比较。
            </p>
            <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-400 md:text-base">
              我们不只给解法打分，更关心每个解法带来的启发。比较考场可行性、结构美感、计算负担与讲解质量，是为了帮助你选择最适合当前目标的路线。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/problems"
                className="inline-flex h-12 items-center gap-2 bg-cyan-400 px-5 text-sm font-bold text-zinc-950 transition hover:bg-cyan-300"
              >
                进入题目擂台
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href={`/problems/${featuredProblems[0].id}`}
                className="inline-flex h-12 items-center gap-2 border border-white/20 bg-black/25 px-5 text-sm font-bold text-white transition hover:border-white/40"
              >
                查看本周焦点
                <ChevronRight className="size-4" />
              </Link>
              <Link
                href="/submit"
                className="inline-flex h-12 items-center gap-2 border border-white/20 bg-black/25 px-5 text-sm font-bold text-white transition hover:border-cyan-400/50 hover:text-cyan-300"
              >
                提交我的解法
                <Send className="size-4" />
              </Link>
            </div>
          </div>
        </div>
        <div className="relative mx-auto -mt-16 grid max-w-7xl grid-cols-3 border border-white/10 bg-zinc-950/90 backdrop-blur md:w-[calc(100%-3rem)]">
          {[
            ["05", "精编真题"],
            ["10", "完整解法"],
            ["100%", "公开验证"],
          ].map(([value, label]) => (
            <div key={label} className="border-r border-white/10 p-4 last:border-r-0 md:p-6">
              <strong className="font-display block text-2xl font-black text-white md:text-3xl">{value}</strong>
              <span className="mt-1 block text-xs text-zinc-500">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid-surface border-b border-white/10 py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <span className="font-mono text-xs uppercase tracking-widest text-red-400">Solution routes</span>
              <h2 className="mt-2 text-3xl font-black text-white md:text-4xl">当前解法导航</h2>
            </div>
            <Link href="/problems" className="hidden items-center gap-2 text-sm text-zinc-400 hover:text-white sm:flex">
              查看全部 <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-4">
            {featuredProblems.map((problem, index) => (
              <ProblemCard key={problem.id} problem={problem} rank={index + 1} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 md:grid-cols-[.8fr_1.2fr] md:px-6">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-cyan-300">Scoring system</span>
            <h2 className="mt-3 text-3xl font-black text-white">解法不只分对错</h2>
            <p className="mt-4 text-sm leading-7 text-zinc-400">
              一个正确但考场上写不完的解法，和一个短、稳、能迁移的解法，不该得到相同评价。
            </p>
          </div>
          <div className="grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
            {[
              [CheckCircle2, "正确性", "推理链完整、边界无遗漏"],
              [Swords, "考场性", "时间可控、路径容易识别"],
              [Trophy, "结构美感", "转化自然、结构简洁"],
              [ArrowRight, "计算量", "更少展开与重复运算"],
              [ChevronRight, "讲解友好", "便于复盘与迁移"],
            ].map(([Icon, title, description]) => {
              const FeatureIcon = Icon as typeof CheckCircle2;
              return (
                <div key={title as string} className="bg-zinc-950 p-5">
                  <FeatureIcon className="size-5 text-cyan-300" />
                  <h3 className="mt-5 font-bold text-white">{title as string}</h3>
                  <p className="mt-2 text-xs leading-6 text-zinc-500">{description as string}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 text-xs text-zinc-600 md:px-6">
        <p>当前为 ProofArena Demo，题目与解法数据仍在整理中。</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>ProofArena · 高中数学解法竞技场</span>
          <span className="flex gap-4">
            <Link href="/about" className="hover:text-white">关于</Link>
            <Link href="/submit" className="hover:text-white">投稿</Link>
            <span>Demo season / 2026</span>
          </span>
        </div>
      </footer>
    </main>
  );
}
