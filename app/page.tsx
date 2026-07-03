import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Compass, Send, Swords, Trophy } from "lucide-react";
import { getLearningIndex, getProblems } from "@/lib/db";
import { difficultyBadgeClass } from "@/lib/problem-presentation";
import { MathBlock } from "@/components/MathBlock";

export const revalidate = 3600;

export default async function HomePage() {
  const problems = await getProblems();
  const solutionCount = problems.reduce((sum, problem) => sum + problem.solutions.length, 0);
  const featuredProblems = ["ng2-2026-18", "ng1-2026-18", "tj-2026-09"]
    .map((id) => problems.find((problem) => problem.id === id))
    .filter((problem): problem is (typeof problems)[number] => Boolean(problem));
  const stats = [
    [String(problems.length).padStart(2, "0"), "精编真题"],
    [String(solutionCount).padStart(2, "0"), "完整解法"],
    ["逐题", "人工校订"],
  ];

  return (
    <main>
      <section className="hero-arena relative min-h-[68vh] overflow-hidden border-b border-white/10">
        <Image
          src="/arena-background.png"
          alt=""
          fill
          priority
          className="pointer-events-none object-cover object-center opacity-65"
        />
        <div className="hero-overlay pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#09090b_5%,rgba(9,9,11,.92)_36%,rgba(9,9,11,.25)_75%,#09090b_100%)]" />
        <div className="grid-surface pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative mx-auto flex min-h-[68vh] max-w-7xl items-center px-4 py-16 md:px-6">
          <div className="max-w-3xl">
            <div className="mb-5 flex items-center gap-3 font-mono text-xs uppercase tracking-[0.18em] text-cyan-300">
              <span className="h-px w-8 bg-cyan-400" />
              2026 高考数学赛季
            </div>
            <h1 className="font-display text-4xl font-black leading-[1.02] text-white sm:text-6xl md:text-8xl">
              Proof<span className="text-cyan-300">Arena</span>
            </h1>
            <p className="mt-5 text-xl font-bold text-zinc-100 md:text-2xl">
              同一道题，多种解法，正面交锋。
            </p>
            <p className="mt-3 max-w-2xl border-l-2 border-red-500 pl-4 text-sm font-semibold leading-7 text-zinc-200 md:text-base">
              ProofArena 是一个围绕数学题展开解法比较、思路拆解和知识关联的平台。
            </p>
            <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-400 md:text-base">
              核心路径很简单：看题，比较不同解法，然后把真正有启发的路线沉淀下来。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/problems"
                className="inline-flex h-12 items-center gap-2 bg-cyan-400 px-5 text-sm font-bold text-zinc-950 transition hover:bg-cyan-300"
              >
                开始看题
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/submit"
                className="inline-flex h-12 items-center gap-2 border border-white/20 bg-black/25 px-5 text-sm font-bold text-white transition hover:border-white/40"
              >
                提交题目/解法
                <Send className="size-4" />
              </Link>
            </div>
          </div>
        </div>
        <div className="relative mx-4 -mt-16 grid max-w-7xl grid-cols-3 border border-white/10 bg-zinc-950/90 backdrop-blur md:mx-auto md:w-[calc(100%-3rem)]">
          {stats.map(([value, label]) => (
            <div key={label} className="border-r border-white/10 p-4 last:border-r-0 md:p-6">
              <strong className="font-display block text-2xl font-black text-white md:text-3xl">{value}</strong>
              <span className="mt-1 block text-xs text-zinc-500">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-white/10 bg-zinc-950 py-14">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mb-6 flex items-center gap-2 text-sm font-bold text-white">
            <Compass className="size-4 text-cyan-300" />
            默认阅读路径
          </div>
          <div className="grid gap-px bg-white/10 md:grid-cols-3">
            {[
              ["01", "选一道题", "按卷别或专题进入，不需要先理解全部评分体系。"],
              ["02", "看观察入口", "先读题干和关键观察，再决定走哪条解法。"],
              ["03", "展开一条解法", "优先看标准解；想提思维时再看启发解和进阶资料。"],
            ].map(([step, title, description]) => (
              <div key={step} className="bg-zinc-950 p-5">
                <span className="font-mono text-xs text-cyan-300">{step}</span>
                <h2 className="mt-3 text-lg font-bold text-white">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid-surface border-b border-white/10 py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="font-mono text-xs uppercase tracking-widest text-red-400">新手入口</span>
              <h2 className="mt-2 text-2xl font-black leading-tight text-white sm:text-3xl md:text-4xl">先从这几道题开始</h2>
            </div>
            <Link href="/problems" className="hidden items-center gap-2 text-sm text-zinc-400 hover:text-white sm:flex">
              查看全部 <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {featuredProblems.map((problem, index) => (
              <article key={problem.id} className="flex border border-white/10 bg-zinc-950 p-5">
                <div className="flex min-h-[22rem] w-full flex-col">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-zinc-600">{String(index + 1).padStart(2, "0")}</span>
                    <span className={`border px-2 py-1 text-xs ${difficultyBadgeClass[problem.difficulty]}`}>
                      {problem.difficulty}
                    </span>
                  </div>
                  <h3 className="mt-4 min-h-14 text-lg font-bold leading-7 text-white">{problem.title}</h3>
                  <p className="mt-4 line-clamp-5 text-sm leading-7 text-zinc-400">
                    <MathBlock>{problem.statement[0]}</MathBlock>
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-px bg-white/10 text-center">
                    <div className="bg-zinc-950 p-3">
                      <strong className="font-display block text-xl text-cyan-300">{problem.solutions.length}</strong>
                      <span className="text-[11px] text-zinc-600">解法路线</span>
                    </div>
                    <div className="bg-zinc-950 p-3">
                      <strong className="font-display block text-xl text-amber-300">{getLearningIndex(problem)}</strong>
                      <span className="text-[11px] text-zinc-600">学习指数</span>
                    </div>
                  </div>
                  <Link
                    href={`/problems/${problem.id}`}
                    className="mt-auto inline-flex h-10 w-full items-center justify-center gap-2 bg-cyan-400 px-4 text-sm font-bold text-zinc-950 transition hover:bg-cyan-300"
                  >
                    进入擂台
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 md:grid-cols-[.8fr_1.2fr] md:px-6">
          <div>
            <span className="font-mono text-xs uppercase tracking-widest text-cyan-300">解法评价维度</span>
            <h2 className="mt-3 text-2xl font-black leading-tight text-white sm:text-3xl">解法不只分对错</h2>
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
              [ArrowRight, "讲解友好", "便于复盘与迁移"],
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
          <span className="flex flex-wrap gap-4">
            <Link href="/about" className="hover:text-white">关于</Link>
            <Link href="/submit" className="hover:text-white">投稿</Link>
            <span>Demo · 2026</span>
          </span>
        </div>
      </footer>
    </main>
  );
}
