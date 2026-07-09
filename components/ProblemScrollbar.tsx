"use client";

import { useEffect, useRef, useState } from "react";
import type { ProblemSummary } from "@/lib/types";
import { getScrollBehavior } from "@/lib/scroll-behavior";

export function ProblemScrollbar({ problems }: { problems: ProblemSummary[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [mobileVisible, setMobileVisible] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    if (media.matches) return;

    let timeout = window.setTimeout(() => setMobileVisible(false), 1400);
    const showTemporarily = () => {
      setMobileVisible(true);
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setMobileVisible(false), 900);
    };

    window.addEventListener("scroll", showTemporarily, { passive: true });
    window.addEventListener("touchstart", showTemporarily, { passive: true });
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("scroll", showTemporarily);
      window.removeEventListener("touchstart", showTemporarily);
    };
  }, []);

  useEffect(() => {
    if (problems.length === 0) return;
    const ratios = new Map<string, number>();
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          ratios.set(entry.target.id, entry.intersectionRatio);
        let best: string | null = null;
        let bestRatio = 0;
        for (const [id, ratio] of ratios) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = id;
          }
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
    document
      .getElementById(`card-${id}`)
      ?.scrollIntoView({ behavior: getScrollBehavior(), block: "center" });
  }

  if (problems.length < 2) return null;

  const hovered = problems.find((p) => p.id === hoverId);
  const hoveredIndex = hovered
    ? problems.findIndex((problem) => problem.id === hovered.id) + 1
    : 0;

  return (
    <div
      data-testid="problem-scrollbar"
      className={`fixed right-2 top-1/2 z-40 flex -translate-y-1/2 transition-opacity duration-300 lg:pointer-events-auto lg:right-4 lg:opacity-100 ${
        mobileVisible
          ? "pointer-events-auto opacity-100"
          : "pointer-events-none opacity-0"
      }`}
      aria-hidden="true"
    >
      {/* Tooltip — desktop only (hover doesn't exist on touch) */}
      {hovered && (
        <div className="pointer-events-none mr-4 hidden self-center whitespace-nowrap  border border-white/10 bg-zinc-950/95 px-3 py-2 text-xs shadow-lg lg:block">
          <span className="font-mono text-zinc-500">
            {String(hoveredIndex).padStart(2, "0")}{" "}
          </span>
          <span className="text-zinc-300">
            {hovered.region} · {hovered.number}
          </span>
          <span className="ml-2 text-zinc-500">
            {hovered.title.length > 16
              ? hovered.title.slice(0, 16) + "…"
              : hovered.title}
          </span>
        </div>
      )}

      {/* Track */}
      <div className="flex flex-col items-end gap-0">
        {problems.map((problem, index) => (
          <button
            key={problem.id}
            type="button"
            onClick={() => scrollTo(problem.id)}
            onMouseEnter={() => setHoverId(problem.id)}
            onMouseLeave={() => setHoverId(null)}
            className="flex items-center justify-end gap-2 py-1 pl-3 lg:py-1.5 lg:pl-6"
            tabIndex={-1}
          >
            <span className="hidden font-mono text-[9px] text-zinc-600 lg:block">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span
              className={`block  transition-all duration-200 ${
                activeId === `card-${problem.id}`
                  ? "h-[3px] bg-cyan-400 w-6 lg:w-10"
                  : hoverId === problem.id
                    ? "h-0.5 bg-zinc-300 w-5 lg:w-8"
                    : "h-px bg-zinc-600 w-3 lg:h-0.5 lg:w-5 hover:bg-zinc-400"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
