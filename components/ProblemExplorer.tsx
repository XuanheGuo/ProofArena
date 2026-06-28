"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { Difficulty, ExamRegion, Problem, QuestionType } from "@/lib/types";
import { ProblemCard } from "@/components/ProblemCard";

const regions: Array<"全部卷别" | ExamRegion> = ["全部卷别", "天津卷", "新高考 I 卷", "新高考 II 卷"];
const types: Array<"全部题型" | QuestionType> = ["全部题型", "单选", "多选", "填空", "解答"];
const difficulties: Array<"全部难度" | Difficulty> = ["全部难度", "基础", "中档", "压轴"];

export function ProblemExplorer({ problems }: { problems: Problem[] }) {
  const mobileScrollerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<(typeof regions)[number]>("全部卷别");
  const [type, setType] = useState<(typeof types)[number]>("全部题型");
  const [difficulty, setDifficulty] = useState<(typeof difficulties)[number]>("全部难度");
  const [topic, setTopic] = useState("全部专题");
  const [mobileSlideIndex, setMobileSlideIndex] = useState(0);

  const topics = useMemo(
    () => ["全部专题", ...Array.from(new Set(problems.flatMap((problem) => problem.tags))).sort()],
    [problems],
  );

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return problems.filter((problem) => {
      const matchesQuery =
        !keyword ||
        [problem.title, problem.number, problem.region, problem.paper, problem.questionType, ...problem.tags]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      const matchesRegion = region === "全部卷别" || problem.region === region;
      const matchesType = type === "全部题型" || problem.questionType === type;
      const matchesDifficulty = difficulty === "全部难度" || problem.difficulty === difficulty;
      const matchesTopic = topic === "全部专题" || problem.tags.includes(topic);
      return matchesQuery && matchesRegion && matchesType && matchesDifficulty && matchesTopic;
    });
  }, [difficulty, problems, query, region, type, topic]);

  const hasFilters = query || region !== "全部卷别" || type !== "全部题型" || difficulty !== "全部难度" || topic !== "全部专题";

  useEffect(() => {
    setMobileSlideIndex(0);
    mobileScrollerRef.current?.scrollTo({ left: 0 });
  }, [filtered]);

  useEffect(() => {
    const scroller = mobileScrollerRef.current;
    if (!scroller) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const activeEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const index = activeEntry?.target.getAttribute("data-slide-index");
        if (index) setMobileSlideIndex(Number(index));
      },
      { root: scroller, threshold: [0.55, 0.75, 0.95] },
    );

    Array.from(scroller.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [filtered]);

  function updateMobileSlideIndex() {
    const scroller = mobileScrollerRef.current;
    if (!scroller) return;

    const nextIndex = Math.round(scroller.scrollLeft / scroller.clientWidth);
    setMobileSlideIndex(Math.min(Math.max(nextIndex, 0), Math.max(filtered.length - 1, 0)));
  }

  function resetFilters() {
    setQuery("");
    setRegion("全部卷别");
    setType("全部题型");
    setDifficulty("全部难度");
    setTopic("全部专题");
  }

  return (
    <>
      <section className="border-b border-white/10 bg-zinc-950/80">
        <div className="mx-auto max-w-7xl px-4 py-5 md:px-6">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <label className="flex h-11 items-center gap-3 border border-white/10 bg-zinc-950 px-3 focus-within:border-cyan-400/50">
              <Search className="size-4 text-zinc-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索题号、题目或专题..."
                className="min-w-0 flex-1 bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="清空搜索" className="text-zinc-500 hover:text-white">
                  <X className="size-4" />
                </button>
              )}
            </label>
            <select
              value={region}
              onChange={(event) => setRegion(event.target.value as typeof region)}
              className="h-11 border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-300 outline-none"
              aria-label="卷别"
            >
              {regions.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              className="h-11 border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-300 outline-none"
              aria-label="专题"
            >
              {topics.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>

          <div className="mt-3 flex gap-4 overflow-x-auto pb-1">
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">题型</span>
              {types.map((item) => (
                <button
                  key={item}
                  type="button"
                  data-testid={`type-filter-${item}`}
                  onClick={() => setType(item)}
                  className={`h-9 shrink-0 border px-3 text-xs font-semibold transition ${
                    type === item
                      ? "border-cyan-400 bg-cyan-400 text-zinc-950"
                      : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-white"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-2 border-l border-white/10 pl-4">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">难度</span>
              {difficulties.map((item) => (
                <button
                  key={item}
                  type="button"
                  data-testid={`difficulty-filter-${item}`}
                  aria-pressed={difficulty === item}
                  onClick={() => setDifficulty(item)}
                  className={`h-9 shrink-0 border px-3 text-xs font-semibold transition ${
                    difficulty === item
                      ? "border-cyan-400 bg-cyan-400 text-zinc-950"
                      : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-white"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
          <span className="font-mono text-xs uppercase tracking-wider text-zinc-500">
            {filtered.length} / {problems.length} 道题
          </span>
          {hasFilters ? (
            <button type="button" onClick={resetFilters} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white">
              <X className="size-3.5" />
              清除筛选
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-zinc-600">
              <SlidersHorizontal className="size-3.5" />
              可按卷别、题型、难度与专题筛选
            </span>
          )}
        </div>

        {filtered.length ? (
          <>
            <div className="hidden md:grid md:gap-4">
              {filtered.map((problem, index) => (
                <ProblemCard key={problem.id} problem={problem} rank={index + 1} />
              ))}
            </div>

            <div className="-mx-4 md:hidden">
              <div
                ref={mobileScrollerRef}
                onScroll={updateMobileSlideIndex}
                className="flex h-[calc(100svh-3rem)] min-h-[42rem] w-screen snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                aria-label="移动端题目滑动列表"
              >
                {filtered.map((problem, index) => (
                  <div
                    key={problem.id}
                    data-slide-index={index}
                    className="h-full w-screen min-w-full shrink-0 snap-start overflow-y-auto overscroll-contain"
                  >
                    <ProblemCard problem={problem} rank={index + 1} />
                  </div>
                ))}
              </div>

              <div className="pointer-events-none sticky bottom-4 z-10 mx-auto mt-4 flex w-fit items-center gap-2 border border-white/10 bg-zinc-950/90 px-3 py-1.5 font-mono text-xs text-zinc-300 backdrop-blur">
                <span>{Math.min(mobileSlideIndex + 1, filtered.length)}</span>
                <span className="text-zinc-600">/</span>
                <span>{filtered.length}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="border border-white/10 bg-zinc-950 px-6 py-20 text-center">
            <Search className="mx-auto size-7 text-zinc-600" />
            <h2 className="mt-4 font-bold text-white">没有匹配的真题</h2>
            <p className="mt-2 text-sm text-zinc-500">换一个关键词，或清除部分筛选条件。</p>
          </div>
        )}
      </section>
    </>
  );
}
