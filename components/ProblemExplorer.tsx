"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { ExamRegion, Problem, QuestionType } from "@/lib/types";
import { ProblemCard } from "@/components/ProblemCard";

const regions: Array<"全部卷别" | ExamRegion> = ["全部卷别", "天津卷"];
const types: Array<"全部题型" | QuestionType> = ["全部题型", "单选", "多选", "填空", "解答"];

export function ProblemExplorer({ problems }: { problems: Problem[] }) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<(typeof regions)[number]>("全部卷别");
  const [type, setType] = useState<(typeof types)[number]>("全部题型");
  const [topic, setTopic] = useState("全部专题");

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
      const matchesTopic = topic === "全部专题" || problem.tags.includes(topic);
      return matchesQuery && matchesRegion && matchesType && matchesTopic;
    });
  }, [problems, query, region, type, topic]);

  const hasFilters = query || region !== "全部卷别" || type !== "全部题型" || topic !== "全部专题";

  function resetFilters() {
    setQuery("");
    setRegion("全部卷别");
    setType("全部题型");
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

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {types.map((item) => (
              <button
                key={item}
                type="button"
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
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="mb-5 flex items-center justify-between border-b border-white/10 pb-4">
          <span className="font-mono text-xs uppercase tracking-wider text-zinc-500">
            {filtered.length} / {problems.length} problems
          </span>
          {hasFilters ? (
            <button type="button" onClick={resetFilters} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white">
              <X className="size-3.5" />
              清除筛选
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-zinc-600">
              <SlidersHorizontal className="size-3.5" />
              按卷别与题号排序
            </span>
          )}
        </div>

        {filtered.length ? (
          <div className="grid gap-4">
            {filtered.map((problem, index) => (
              <ProblemCard key={problem.id} problem={problem} rank={index + 1} />
            ))}
          </div>
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
