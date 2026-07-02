"use client";

import { useEffect, useRef, useState } from "react";
import type { Problem } from "@/lib/types";

const REGION_SHORT: Record<string, string> = {
  "天津卷": "津",
  "新高考 I 卷": "Ⅰ",
  "新高考 II 卷": "Ⅱ",
  "北京卷": "京",
};

export function ProblemScrollbar({ problems }: { problems: Problem[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (problems.length === 0) return;
    const ratios = new Map<string, number>();
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) ratios.set(entry.target.id, entry.intersectionRatio);
        let best: string | null = null;
        let bestRatio = 0;
        for (const [id, ratio] of ratios) {
          if (ratio > bestRatio) { bestRatio = ratio; best = id; }
        }
        if (best) setActiveId(best);
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    for (const p of problems) {
      const el = document.getElementById(`card-${p.id}`);
      if (el) observerRef.current.observe(el);
    }
    return () => observerRef.current?.disconnect();
  }, [problems]);

  function scrollTo(id: string) {
    document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (problems.length < 2) return null;

  // Group by region
  const groups: Array<{ region: string; ids: string[] }> = [];
  for (const p of problems) {
    const last = groups[groups.length - 1];
    if (last && last.region === p.region) last.ids.push(p.id);
    else groups.push({ region: p.region, ids: [p.id] });
  }

  const items: Array<{ type: "region"; label: string } | { type: "problem"; problem: Problem }> = [];
  for (const group of groups) {
    items.push({ type: "region", label: REGION_SHORT[group.region] ?? group.region.slice(0, 1) });
    for (const id of group.ids) {
      const p = problems.find((x) => x.id === id)!;
      items.push({ type: "problem", problem: p });
    }
  }

  const hovered = problems.find((p) => p.id === hoverId);

  return (
    <div className="fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 lg:flex" aria-hidden="true">
      {/* Tooltip */}
      {hovered && (
        <div className="pointer-events-none mr-4 self-center whitespace-nowrap rounded border border-white/10 bg-zinc-950/95 px-3 py-2 text-xs shadow-lg">
          <span className="font-mono text-zinc-500">{REGION_SHORT[hovered.region] ?? ""} </span>
          <span className="text-zinc-300">{hovered.number}</span>
          <span className="ml-2 text-zinc-500">
            {hovered.title.length > 16 ? hovered.title.slice(0, 16) + "…" : hovered.title}
          </span>
        </div>
      )}

      {/* Track */}
      <div className="flex flex-col items-end gap-0">
        {items.map((item, i) =>
          item.type === "region" ? (
            <div
              key={`region-${i}`}
              className="my-1.5 pr-1 font-mono text-[10px] leading-none text-zinc-500 select-none"
            >
              {item.label}
            </div>
          ) : (
            <button
              key={item.problem.id}
              type="button"
              onClick={() => scrollTo(item.problem.id)}
              onMouseEnter={() => setHoverId(item.problem.id)}
              onMouseLeave={() => setHoverId(null)}
              className="flex items-center justify-end py-1.5 pl-6"
              tabIndex={-1}
            >
              <span
                className={`block rounded-full transition-all duration-200 ${
                  activeId === `card-${item.problem.id}`
                    ? "h-[3px] w-10 bg-cyan-400"
                    : hoverId === item.problem.id
                    ? "h-0.5 w-8 bg-zinc-300"
                    : "h-0.5 w-5 bg-zinc-600 hover:bg-zinc-400"
                }`}
              />
            </button>
          ),
        )}
      </div>
    </div>
  );
}
