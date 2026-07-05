"use client";

import { ShieldAlert } from "lucide-react";
import { MathBlock } from "@/components/MathBlock";
import type { Problem } from "@/lib/types";

export function MethodBoundaryHighlights({ problem }: { problem: Problem }) {
  const boundaries = problem.proofGraph?.methodBoundaries ?? [];
  if (!boundaries.length) return null;

  return (
    <section className="border border-white/10">
      <div className="border-b border-white/10 bg-black/20 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-bold text-white">
          <ShieldAlert className="size-4 text-amber-300" />
          为什么不优先用这些方法
        </h3>
        <p className="mt-0.5 text-[11px] text-zinc-600">
          这些路线看起来可行，但在本题中有明确限制。展开推导过程查看完整分析。
        </p>
      </div>
      <div className="divide-y divide-white/5">
        {boundaries.map((b) => (
          <div key={b.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <p className="text-sm font-bold text-zinc-200">{b.methodName}</p>
              <div className="mt-1.5 border-l-2 border-red-400/40 pl-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-red-400/70">
                  不优先原因
                </span>
                <p className="mt-0.5 text-xs leading-5 text-zinc-400">
                  <MathBlock>{b.whyNotPriority}</MathBlock>
                </p>
              </div>
            </div>
            <div className="border-l-2 border-emerald-400/40 pl-2">
              <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-400/70">
                什么时候变好
              </span>
              <p className="mt-0.5 text-xs leading-5 text-zinc-400">
                <MathBlock>{b.whenItWorks}</MathBlock>
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
