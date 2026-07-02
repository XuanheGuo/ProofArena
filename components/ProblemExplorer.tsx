"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import type { Difficulty, ExamRegion, Problem, QuestionType } from "@/lib/types";
import { ProblemCard } from "@/components/ProblemCard";
import { ProblemScrollbar } from "@/components/ProblemScrollbar";

const regions: Array<"全部卷别" | ExamRegion> = ["全部卷别", "天津卷", "新高考 I 卷", "新高考 II 卷"];
const types: Array<"全部题型" | QuestionType> = ["全部题型", "单选", "多选", "填空", "解答"];
const difficulties: Array<"全部难度" | Difficulty> = ["全部难度", "基础", "中档", "压轴"];

interface ProblemExplorerProps {
  problems: Problem[];
  initialQuery?: string;
  initialRegion?: string;
  initialType?: string;
  initialDifficulty?: string;
  initialTopic?: string;
}

export function ProblemExplorer({
  problems,
  initialQuery = "",
  initialRegion = "全部卷别",
  initialType = "全部题型",
  initialDifficulty = "全部难度",
  initialTopic = "全部专题",
}: ProblemExplorerProps) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [region, setRegion] = useState<(typeof regions)[number]>(
    regions.includes(initialRegion as (typeof regions)[number]) ? (initialRegion as (typeof regions)[number]) : "全部卷别"
  );
  const [type, setType] = useState<(typeof types)[number]>(
    types.includes(initialType as (typeof types)[number]) ? (initialType as (typeof types)[number]) : "全部题型"
  );
  const [difficulty, setDifficulty] = useState<(typeof difficulties)[number]>(
    difficulties.includes(initialDifficulty as (typeof difficulties)[number]) ? (initialDifficulty as (typeof difficulties)[number]) : "全部难度"
  );
  const [topic, setTopic] = useState(initialTopic);

  const topics = useMemo(
    () => ["全部专题", ...Array.from(new Set(problems.flatMap((p) => p.tags))).sort()],
    [problems],
  );

  const pushUrl = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams();
    const merged = { q: query, region, type, difficulty, topic, ...updates };
    if (merged.q) params.set("q", merged.q);
    if (merged.region !== "全部卷别") params.set("region", merged.region);
    if (merged.type !== "全部题型") params.set("type", merged.type);
    if (merged.difficulty !== "全部难度") params.set("difficulty", merged.difficulty);
    if (merged.topic !== "全部专题") params.set("topic", merged.topic);
    const qs = params.toString();
    router.replace(qs ? `/problems?${qs}` : "/problems", { scroll: false });
  }, [query, region, type, difficulty, topic, router]);

  function handleQuery(v: string) { setQuery(v); pushUrl({ q: v }); }
  function handleRegion(v: string) { setRegion(v as typeof region); pushUrl({ region: v }); }
  function handleType(v: string) { setType(v as typeof type); pushUrl({ type: v }); }
  function handleDifficulty(v: string) { setDifficulty(v as typeof difficulty); pushUrl({ difficulty: v }); }
  function handleTopic(v: string) { setTopic(v); pushUrl({ topic: v }); }

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

  function resetFilters() {
    setQuery(""); setRegion("全部卷别"); setType("全部题型"); setDifficulty("全部难度"); setTopic("全部专题");
    router.replace("/problems", { scroll: false });
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
                onChange={(event) => handleQuery(event.target.value)}
                placeholder="搜索题号、题目或专题..."
                className="min-w-0 flex-1 bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
              />
              {query && (
                <button type="button" onClick={() => handleQuery("")} aria-label="清空搜索" className="text-zinc-500 hover:text-white">
                  <X className="size-4" />
                </button>
              )}
            </label>
            <select
              value={region}
              onChange={(event) => handleRegion(event.target.value)}
              className="h-11 border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-300 outline-none"
              aria-label="卷别"
            >
              {regions.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select
              value={topic}
              onChange={(event) => handleTopic(event.target.value)}
              className="h-11 border border-white/10 bg-zinc-950 px-3 text-sm text-zinc-300 outline-none"
              aria-label="专题"
            >
              {topics.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>

          <details className="mt-3 border border-white/10 bg-black/20">
            <summary className="flex h-10 list-none items-center justify-between px-3 text-xs font-bold text-zinc-300 marker:hidden">
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="size-3.5 text-cyan-300" />
                更多筛选
              </span>
              <span className="font-normal text-zinc-600">题型 / 难度</span>
            </summary>
            <div className="flex gap-4 overflow-x-auto border-t border-white/10 px-3 py-3">
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">题型</span>
              {types.map((item) => (
                <button
                  key={item}
                  type="button"
                  data-testid={`type-filter-${item}`}
                  onClick={() => handleType(item)}
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
                  onClick={() => handleDifficulty(item)}
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
          </details>
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
          <div className="grid gap-4">
            {filtered.map((problem, index) => (
              <div key={problem.id} id={`card-${problem.id}`}>
                <ProblemCard problem={problem} rank={index + 1} />
              </div>
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

      <ProblemScrollbar problems={filtered} />
    </>
  );
}
