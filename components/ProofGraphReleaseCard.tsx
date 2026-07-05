"use client";

import { useState } from "react";
import { Check, ClipboardCopy, Tag } from "lucide-react";
import type { Problem } from "@/lib/types";

function fallbackCopy(value: string) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);
  return ok;
}

export function ProofGraphReleaseCard({ problem }: { problem: Problem }) {
  const [copied, setCopied] = useState(false);
  const pg = problem.proofGraph;

  if (!pg) return null;

  const counts = [
    { count: pg.observations.length, label: "观察" },
    { count: pg.branches.length, label: "分支" },
    { count: pg.transformations.length, label: "转化" },
    { count: pg.methodBoundaries.length, label: "方法边界" },
    { count: pg.challengeEdges.length, label: "挑战关系" },
    { count: problem.solutions.length, label: "解法" },
  ];

  function buildCitation() {
    const origin = window.location.origin || "https://proof-arena.guoxh.dpdns.org";
    return `ProofArena · ${problem.title}
${problem.year} ${problem.region} · ${problem.paper} · ${problem.number}

推理图谱当前版本：${pg!.observations.length} 观察 · ${pg!.branches.length} 分支 · ${pg!.transformations.length} 转化 · ${pg!.methodBoundaries.length} 方法边界 · ${pg!.challengeEdges.length} 挑战关系 · ${problem.solutions.length} 解法

${origin}/problems/${problem.id}`;
  }

  async function copyCitation() {
    const value = buildCitation();
    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(value);
        } catch {
          if (!fallbackCopy(value)) return;
        }
      } else if (!fallbackCopy(value)) {
        return;
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="border border-white/10">
      <div className="border-b border-white/10 bg-black/20 px-4 py-3">
        <h3 className="text-sm font-bold text-white">当前版本</h3>
        <p className="mt-0.5 text-xs text-zinc-500">
          这是本题推理图谱的当前发布快照，可引用于笔记、分享或课堂材料。
        </p>
      </div>
      <div className="space-y-3 p-4">
        <p className="flex items-center gap-1.5 text-xs text-zinc-500">
          <Tag className="size-3.5 text-zinc-600" />
          {problem.region} · {problem.year} · {problem.number}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {counts.map((c) => (
            <span
              key={c.label}
              className="border border-white/10 bg-white/[0.02] px-2 py-1 text-xs text-zinc-400"
            >
              <span className="font-bold text-zinc-200">{c.count}</span> {c.label}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={copyCitation}
          className="inline-flex h-9 items-center gap-1.5 border border-cyan-400/30 px-3 text-xs font-bold text-cyan-300 transition hover:bg-cyan-400/10"
        >
          {copied ? <Check className="size-3.5 text-emerald-300" /> : <ClipboardCopy className="size-3.5" />}
          {copied ? "已复制" : "复制引用"}
        </button>
      </div>
    </section>
  );
}
