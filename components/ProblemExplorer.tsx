"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutList, Rows3, Search, SlidersHorizontal, X } from "lucide-react";
import type {
  Difficulty,
  ExamRegion,
  ProblemSummary,
  QuestionType,
} from "@/lib/types";
import { ProblemCard } from "@/components/ProblemCard";
import { ProblemScrollbar } from "@/components/ProblemScrollbar";
import { Listbox } from "@/components/Listbox";

const regions: Array<"全部卷别" | ExamRegion> = [
  "全部卷别",
  "天津卷",
  "北京卷",
  "新高考 I 卷",
  "新高考 II 卷",
  "清华强基",
  "北大强基",
  "原创题",
  "改编题",
  "其他来源",
];
const types: Array<"全部题型" | QuestionType> = [
  "全部题型",
  "单选",
  "多选",
  "填空",
  "解答",
];
const difficulties: Array<"全部难度" | Difficulty> = [
  "全部难度",
  "基础",
  "中档",
  "压轴",
];

interface ProblemExplorerProps {
  problems: ProblemSummary[];
}

export function ProblemExplorer({ problems }: ProblemExplorerProps) {
  const router = useRouter();
  // Read initial filter state from the URL client-side so this page stays
  // static/ISR — the server component no longer receives searchParams.
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const initialRegion = searchParams.get("region") ?? "全部卷别";
  const initialType = searchParams.get("type") ?? "全部题型";
  const initialDifficulty = searchParams.get("difficulty") ?? "全部难度";
  const initialTopic = searchParams.get("topic") ?? "全部专题";

  const [query, setQuery] = useState(initialQuery);
  const [region, setRegion] = useState<(typeof regions)[number]>(
    regions.includes(initialRegion as (typeof regions)[number])
      ? (initialRegion as (typeof regions)[number])
      : "全部卷别",
  );
  const [type, setType] = useState<(typeof types)[number]>(
    types.includes(initialType as (typeof types)[number])
      ? (initialType as (typeof types)[number])
      : "全部题型",
  );
  const [difficulty, setDifficulty] = useState<(typeof difficulties)[number]>(
    difficulties.includes(initialDifficulty as (typeof difficulties)[number])
      ? (initialDifficulty as (typeof difficulties)[number])
      : "全部难度",
  );
  const [topic, setTopic] = useState(initialTopic);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    try {
      setCompact(localStorage.getItem("proofarena-problem-view") === "compact");
    } catch {}
  }, []);

  function toggleCompact(next: boolean) {
    setCompact(next);
    try {
      localStorage.setItem(
        "proofarena-problem-view",
        next ? "compact" : "detailed",
      );
    } catch {}
  }

  const topics = useMemo(
    () => [
      "全部专题",
      ...Array.from(new Set(problems.flatMap((p) => p.tags))).sort(),
    ],
    [problems],
  );

  const pushUrl = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams();
      const merged = { q: query, region, type, difficulty, topic, ...updates };
      if (merged.q) params.set("q", merged.q);
      if (merged.region !== "全部卷别") params.set("region", merged.region);
      if (merged.type !== "全部题型") params.set("type", merged.type);
      if (merged.difficulty !== "全部难度")
        params.set("difficulty", merged.difficulty);
      if (merged.topic !== "全部专题") params.set("topic", merged.topic);
      const qs = params.toString();
      router.replace(qs ? `/problems?${qs}` : "/problems", { scroll: false });
    },
    [query, region, type, difficulty, topic, router],
  );

  // Filtering itself runs instantly off local `query` state (see `filtered`
  // below) — only the URL sync is debounced, so fast typing doesn't spam
  // history/router.replace calls on every keystroke. A ref keeps the
  // debounced call pointing at the latest pushUrl (latest region/type/etc),
  // not whatever was current when the timer was scheduled.
  const pushUrlRef = useRef(pushUrl);
  useEffect(() => {
    pushUrlRef.current = pushUrl;
  }, [pushUrl]);
  const queryDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (queryDebounceTimer.current) clearTimeout(queryDebounceTimer.current);
    },
    [],
  );

  function handleQuery(v: string) {
    setQuery(v);
    if (queryDebounceTimer.current) clearTimeout(queryDebounceTimer.current);
    queryDebounceTimer.current = setTimeout(
      () => pushUrlRef.current({ q: v }),
      400,
    );
  }
  function handleRegion(v: string) {
    setRegion(v as typeof region);
    pushUrl({ region: v });
  }
  function handleType(v: string) {
    setType(v as typeof type);
    pushUrl({ type: v });
  }
  function handleDifficulty(v: string) {
    setDifficulty(v as typeof difficulty);
    pushUrl({ difficulty: v });
  }
  function handleTopic(v: string) {
    setTopic(v);
    pushUrl({ topic: v });
  }

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return problems.filter((problem) => {
      const matchesQuery =
        !keyword ||
        [
          problem.title,
          problem.number,
          problem.region,
          problem.paper,
          problem.questionType,
          ...problem.tags,
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      const matchesRegion = region === "全部卷别" || problem.region === region;
      const matchesType = type === "全部题型" || problem.questionType === type;
      const matchesDifficulty =
        difficulty === "全部难度" || problem.difficulty === difficulty;
      const matchesTopic = topic === "全部专题" || problem.tags.includes(topic);
      return (
        matchesQuery &&
        matchesRegion &&
        matchesType &&
        matchesDifficulty &&
        matchesTopic
      );
    });
  }, [difficulty, problems, query, region, type, topic]);

  const hasFilters =
    query ||
    region !== "全部卷别" ||
    type !== "全部题型" ||
    difficulty !== "全部难度" ||
    topic !== "全部专题";

  function resetFilters() {
    if (queryDebounceTimer.current) clearTimeout(queryDebounceTimer.current);
    setQuery("");
    setRegion("全部卷别");
    setType("全部题型");
    setDifficulty("全部难度");
    setTopic("全部专题");
    router.replace("/problems", { scroll: false });
  }

  return (
    <>
      <section className="border-b border-white/10 bg-zinc-950/80">
        <div className="mx-auto max-w-7xl px-4 py-5 md:px-6">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
            <label className="pressable pill-button flex h-11 items-center gap-3 border border-white/10 bg-zinc-950 px-3 hover:border-cyan-400/35 focus-within:border-cyan-400/50">
              <Search className="size-4 text-zinc-500" />
              <input
                value={query}
                onChange={(event) => handleQuery(event.target.value)}
                placeholder="搜索题号、题目或专题..."
                className="min-w-0 flex-1 bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => handleQuery("")}
                  aria-label="清空搜索"
                  className="pressable  p-1 text-zinc-500 hover:bg-white/10 hover:text-white"
                >
                  <X className="size-4" />
                </button>
              )}
            </label>
            <Listbox
              label="卷别"
              value={region}
              onChange={handleRegion}
              options={regions}
            />
            <Listbox
              label="专题"
              value={topic}
              onChange={handleTopic}
              options={topics}
            />
          </div>

          <details className="surface-panel-subtle mt-3 overflow-hidden bg-black/20">
            <summary className="flex h-10 list-none items-center justify-between px-3 text-xs font-bold text-zinc-300 marker:hidden">
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="size-3.5 text-cyan-300" />
                更多筛选
              </span>
              <span className="font-normal text-zinc-600">题型 / 难度</span>
            </summary>
            <div className="flex gap-4 overflow-x-auto border-t border-white/10 px-3 py-3">
              <div className="flex min-w-max shrink-0 items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                  题型
                </span>
                {types.map((item) => (
                  <button
                    key={item}
                    type="button"
                    data-testid={`type-filter-${item}`}
                    onClick={() => handleType(item)}
                    className={`pressable pill-button h-9 shrink-0 border px-3 text-xs font-semibold ${
                      type === item
                        ? "border-cyan-400 bg-cyan-400 text-zinc-950"
                        : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-white"
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="flex min-w-max shrink-0 items-center gap-2 border-l border-white/10 pl-4">
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                  难度
                </span>
                {difficulties.map((item) => (
                  <button
                    key={item}
                    type="button"
                    data-testid={`difficulty-filter-${item}`}
                    aria-pressed={difficulty === item}
                    onClick={() => handleDifficulty(item)}
                    className={`pressable pill-button h-9 shrink-0 border px-3 text-xs font-semibold ${
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
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <span className="font-mono text-xs uppercase tracking-wider text-zinc-500">
            {filtered.length} / {problems.length} 道题
          </span>
          <div className="flex flex-wrap items-center gap-4">
            {hasFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="pressable flex items-center gap-1.5  px-2 py-1 text-xs text-zinc-500 hover:bg-white/10 hover:text-white"
              >
                <X className="size-3.5" />
                清除筛选
              </button>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-zinc-600">
                <SlidersHorizontal className="size-3.5" />
                可按卷别、题型、难度与专题筛选
              </span>
            )}
            <div className="surface-panel-subtle flex overflow-hidden text-xs text-zinc-500">
              <button
                type="button"
                onClick={() => toggleCompact(false)}
                aria-pressed={!compact}
                className={`pressable flex items-center gap-1.5 px-2.5 py-1.5 ${!compact ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"}`}
              >
                <Rows3 className="size-3.5" />
                详细
              </button>
              <button
                type="button"
                onClick={() => toggleCompact(true)}
                aria-pressed={compact}
                className={`pressable flex items-center gap-1.5 border-l border-white/10 px-2.5 py-1.5 ${compact ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white"}`}
              >
                <LayoutList className="size-3.5" />
                紧凑
              </button>
            </div>
          </div>
        </div>

        {filtered.length ? (
          <div className="grid gap-4">
            {filtered.map((problem, index) => (
              <div key={problem.id} id={`card-${problem.id}`}>
                <ProblemCard
                  problem={problem}
                  rank={index + 1}
                  compact={compact}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="surface-panel px-6 py-20 text-center">
            <Search className="mx-auto size-7 text-zinc-600" />
            <h2 className="mt-4 font-bold text-white">没有匹配的真题</h2>
            <p className="mt-2 text-sm text-zinc-500">
              换一个关键词，或清除部分筛选条件。
            </p>
          </div>
        )}
      </section>

      <ProblemScrollbar problems={filtered} />
    </>
  );
}
