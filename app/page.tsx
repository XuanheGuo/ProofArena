import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Flame,
  Send,
  Swords,
  Trophy,
} from "lucide-react";
import {
  getLearningIndex,
  getProblemSummaries,
  getProblemsByIds,
} from "@/lib/db";
import { getFeaturedContest } from "@/lib/contests";
import { difficultyBadgeClass } from "@/lib/problem-presentation";
import { MathBlock } from "@/components/MathBlock";
import { ContestPromoCard } from "@/components/ContestPromoCard";

export const revalidate = 3600;

const FEATURED_PROBLEM_IDS = ["ng2-2026-18", "ng1-2026-18", "tj-2026-09"];

export default async function HomePage() {
  const [summaries, featuredCandidates, currentContest] = await Promise.all([
    getProblemSummaries(),
    getProblemsByIds(FEATURED_PROBLEM_IDS),
    getFeaturedContest(),
  ]);
  const solutionCount = summaries.reduce(
    (sum, problem) => sum + problem.solutions.length,
    0,
  );
  const featuredProblems = FEATURED_PROBLEM_IDS.map((id) =>
    featuredCandidates.find((problem) => problem.id === id),
  ).filter((problem): problem is (typeof featuredCandidates)[number] =>
    Boolean(problem),
  );
  const stats = [
    [String(summaries.length).padStart(2, "0"), "精编真题"],
    [String(solutionCount).padStart(2, "0"), "完整解法"],
  ];
  // Hero"动态战况" module — desktop-only, fills the right half of the hero
  // that used to be empty background. Computed off`summaries` (already
  // fetched above for the stats bar), no extra queries.
  const topBySolutions = [...summaries].sort(
    (a, b) => b.solutions.length - a.solutions.length,
  )[0];
  const topByHeat =
    [...summaries]
      .sort((a, b) => b.heat - a.heat)
      .find((problem) => problem.id !== topBySolutions?.id) ??
    [...summaries].sort((a, b) => b.heat - a.heat)[0];
  const hasArenaStatus = Boolean(currentContest || topBySolutions);

  return (
    <main>
      <section className="hero-arena relative min-h-[68vh] overflow-hidden border-b border-white/10">
        <div className="hero-overlay pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#09090b_5%,rgba(9,9,11,.92)_36%,rgba(9,9,11,.25)_75%,#09090b_100%)]" />
        <div className="grid-surface pointer-events-none absolute inset-0 opacity-50" />
        <div className="relative mx-auto flex min-h-[68vh] max-w-7xl items-center gap-10 px-4 py-16 md:px-6">
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
              ProofArena
              是一个围绕数学题展开解法比较、思路拆解和知识关联的平台。
            </p>
            <p className="mt-4 max-w-xl text-sm leading-7 text-zinc-400 md:text-base">
              核心路径很简单：看题，比较不同解法，然后把真正有启发的路线沉淀下来。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/problems"
                className="pressable pill-button inline-flex h-12 items-center gap-2 bg-cyan-400 px-5 text-sm font-bold text-zinc-950 shadow-lg shadow-cyan-400/15 hover:bg-cyan-300"
              >
                开始看题
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="/submit"
                className="pressable pill-button inline-flex h-12 items-center gap-2 border border-white/20 bg-black/25 px-5 text-sm font-bold text-white hover:border-cyan-400/35"
              >
                提交题目/解法
                <Send className="size-4" />
              </Link>
            </div>
          </div>

          {hasArenaStatus && (
            <div className="hidden w-full max-w-sm shrink-0 lg:block">
              <div className="surface-panel overflow-hidden bg-zinc-950/80 backdrop-blur">
                <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3">
                  <Flame className="size-4 text-amber-300" />
                  <span className="font-mono text-xs uppercase tracking-widest text-zinc-400">
                    动态战况
                  </span>
                </div>
                <div className="divide-y divide-white/10">
                  {currentContest && (
                    <Link
                      href={`/contests/${currentContest.slug}`}
                      className="pressable flex items-center justify-between gap-3 px-5 py-4 hover:bg-white/[0.03]"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                          比赛进行中
                        </p>
                        <p className="mt-1 truncate text-sm font-bold text-white">
                          <MathBlock>{currentContest.title}</MathBlock>
                        </p>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-zinc-600" />
                    </Link>
                  )}
                  {topBySolutions && (
                    <Link
                      href={`/problems/${topBySolutions.id}`}
                      className="pressable flex items-center justify-between gap-3 px-5 py-4 hover:bg-white/[0.03]"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">
                          对比最多解法
                        </p>
                        <p className="mt-1 truncate text-sm font-bold text-white">
                          <MathBlock>{topBySolutions.title}</MathBlock>
                        </p>
                      </div>
                      <span className="shrink-0 font-display text-lg font-black tabular-nums text-cyan-300">
                        {topBySolutions.solutions.length}
                      </span>
                    </Link>
                  )}
                  {topByHeat && topByHeat.id !== topBySolutions?.id && (
                    <Link
                      href={`/problems/${topByHeat.id}`}
                      className="pressable flex items-center justify-between gap-3 px-5 py-4 hover:bg-white/[0.03]"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                          热度最高
                        </p>
                        <p className="mt-1 truncate text-sm font-bold text-white">
                          <MathBlock>{topByHeat.title}</MathBlock>
                        </p>
                      </div>
                      <ArrowRight className="size-4 shrink-0 text-zinc-600" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="relative mx-auto -mt-16 max-w-7xl px-4 md:px-6">
          <div className="surface-panel flex w-full flex-col overflow-hidden bg-zinc-950/90 backdrop-blur sm:w-fit sm:flex-row">
            <div className="grid grid-cols-2">
              {stats.map(([value, label]) => (
                <div
                  key={label}
                  className="border-r border-white/10 p-4 last:border-r-0 md:p-6"
                >
                  <strong className="font-display block text-2xl font-black tabular-nums text-white md:text-3xl">
                    {value}
                  </strong>
                  <span className="mt-1 block text-xs text-zinc-500">
                    {label}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t border-white/10 px-4 py-3 text-xs font-bold text-emerald-300 sm:border-l sm:border-t-0 md:px-6">
              <CheckCircle2 className="size-4 shrink-0" />
              逐题人工校订
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-zinc-950 py-14">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mb-6 flex items-center gap-2 text-sm font-bold text-white">
            <Compass className="size-4 text-cyan-300" />
            默认阅读路径
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              [
                "01",
                "选一道题",
                "按卷别或专题进入，不需要先理解全部评分体系。",
              ],
              ["02", "看观察入口", "先读题干和关键观察，再决定走哪条解法。"],
              [
                "03",
                "展开一条解法",
                "优先看标准解；想提思维时再看启发解和进阶资料。",
              ],
            ].map(([step, title, description]) => (
              <div key={step} className="surface-panel-subtle bg-zinc-950 p-5">
                <span className="font-mono text-xs text-cyan-300">{step}</span>
                <h2 className="mt-3 text-lg font-bold text-white">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid-surface border-b border-white/10 py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="font-mono text-xs uppercase tracking-widest text-red-400">
                新手入口
              </span>
              <h2 className="mt-2 text-2xl font-black leading-tight text-white sm:text-3xl md:text-4xl">
                先从这几道题开始
              </h2>
            </div>
            <Link
              href="/problems"
              className="pressable hidden items-center gap-2 px-2 py-1 text-sm text-zinc-400 hover:bg-white/10 hover:text-white sm:flex"
            >
              查看全部 <ArrowRight className="size-4" />
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {featuredProblems.map((problem, index) => (
              <article
                key={problem.id}
                className="interactive-lift surface-panel flex p-5 hover:border-cyan-400/35"
              >
                <div className="flex min-h-[22rem] w-full flex-col">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-zinc-600">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={`border px-2 py-1 text-xs ${difficultyBadgeClass[problem.difficulty]}`}
                    >
                      {problem.difficulty}
                    </span>
                  </div>
                  <h3 className="mt-4 min-h-14 text-lg font-bold leading-7 text-white">
                    {problem.title}
                  </h3>
                  <p className="mt-4 line-clamp-5 text-sm leading-7 text-zinc-400">
                    <MathBlock>{problem.statement[0]}</MathBlock>
                  </p>
                  <div className="surface-panel-subtle mt-5 grid grid-cols-2 gap-px overflow-hidden bg-white/10 text-center">
                    <div className="bg-zinc-950 p-3">
                      <strong className="font-display block text-xl tabular-nums text-cyan-300">
                        {problem.solutions.length}
                      </strong>
                      <span className="text-[11px] text-zinc-600">
                        解法路线
                      </span>
                    </div>
                    <div className="bg-zinc-950 p-3">
                      <strong className="font-display block text-xl tabular-nums text-amber-300">
                        {getLearningIndex(problem)}
                      </strong>
                      <span className="text-[11px] text-zinc-600">
                        学习指数
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/problems/${problem.id}`}
                    className="pressable pill-button mt-auto inline-flex h-10 w-full items-center justify-center gap-2 bg-cyan-400 px-4 text-sm font-bold text-zinc-950 hover:bg-cyan-300"
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
            <span className="font-mono text-xs uppercase tracking-widest text-cyan-300">
              解法评价维度
            </span>
            <h2 className="mt-3 text-2xl font-black leading-tight text-white sm:text-3xl">
              解法不只分对错
            </h2>
            <p className="mt-4 text-sm leading-7 text-zinc-400">
              一个正确但考场上写不完的解法，和一个短、稳、能迁移的解法，不该得到相同评价。
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-5">
            {[
              [CheckCircle2, "正确性", "推理链完整、边界无遗漏"],
              [Swords, "考场性", "时间可控、路径容易识别"],
              [Trophy, "结构美感", "转化自然、结构简洁"],
              [ArrowRight, "计算量", "更少展开与重复运算"],
              [ArrowRight, "讲解友好", "便于复盘与迁移"],
            ].map(([Icon, title, description]) => {
              const FeatureIcon = Icon as typeof CheckCircle2;
              return (
                <div
                  key={title as string}
                  className="surface-panel-subtle bg-zinc-950 p-5"
                >
                  <FeatureIcon className="size-5 text-cyan-300" />
                  <h3 className="mt-5 font-bold text-white">
                    {title as string}
                  </h3>
                  <p className="mt-2 text-xs leading-6 text-zinc-500">
                    {description as string}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-zinc-950">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 text-sm sm:grid-cols-3 md:px-6">
          <div>
            <span className="font-display text-lg font-black text-white">
              Proof<span className="text-cyan-300">Arena</span>
            </span>
            <p className="mt-3 text-xs leading-6 text-zinc-500">
              围绕数学题展开解法比较、思路拆解和知识关联的平台。当前为
              Demo，题目与解法数据仍在整理中。
            </p>
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              导航
            </span>
            <ul className="mt-3 space-y-2 text-xs text-zinc-400">
              <li>
                <Link href="/problems" className="hover:text-white">
                  题目擂台
                </Link>
              </li>
              <li>
                <Link href="/contests" className="hover:text-white">
                  比赛
                </Link>
              </li>
              <li>
                <Link href="/library" className="hover:text-white">
                  思路库
                </Link>
              </li>
              <li>
                <Link href="/submit" className="hover:text-white">
                  投稿
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-white">
                  关于
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              开放协议
            </span>
            <ul className="mt-3 space-y-2 text-xs text-zinc-400">
              <li>应用代码 · AGPL-3.0</li>
              <li>原创题解与编辑内容 · CC BY-SA 4.0</li>
              <li>
                <Link
                  href="/about"
                  className="text-cyan-400 hover:text-cyan-300"
                >
                  查看完整协议说明 →
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mx-auto flex max-w-7xl flex-col gap-2 border-t border-white/10 px-4 py-4 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <span>ProofArena · 高中数学解法竞技场</span>
          <span>Demo · 2026</span>
        </div>
      </footer>

      {currentContest && (
        <ContestPromoCard
          slug={currentContest.slug}
          title={currentContest.title}
        />
      )}
    </main>
  );
}
