"use client";

import { Check, ClipboardCopy, MessageSquareText } from "lucide-react";
import { useState } from "react";
import type { Problem, Solution } from "@/lib/types";
import { getShareRoutes, getShareTags, getSolutionShareTags } from "@/components/ShareCard";
import { getSolutionKindMeta } from "@/lib/solution-kinds";

export function CopyLinkButton({ path, problem, solution }: { path: string; problem?: Problem; solution?: Solution }) {
  const [copiedTarget, setCopiedTarget] = useState<"link" | "text" | null>(null);

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

  function getUrl() {
    const origin = window.location.origin || "https://proof-arena.guoxh.dpdns.org";
    return `${origin}${path}`;
  }

  function buildShareText() {
    if (!problem) return getUrl();

    if (solution) {
      const kindMeta = getSolutionKindMeta(solution.kind);
      const tags = getSolutionShareTags(problem, solution).slice(0, 5);
      const scenarios = solution.suitableFor.slice(0, 3).join("、") || "待补充";
      const costs = [...solution.tradeoffs, ...solution.limitations].slice(0, 2).join("；") || "待补充";

      return `【ProofArena 解法分享】
题目：${problem.title}
来源：${problem.year}${problem.region} · ${problem.number}

解法：${solution.title}
类型：${kindMeta.label}（${kindMeta.description}）
作者：${solution.author}

这个解法值得看：
${solution.inspiration}

关键转化：
${solution.keyTransform}

迁移价值：
${solution.transferValue}

适合：${scenarios}
代价与局限：${costs}
相关思路：${tags.length ? tags.join("、") : "待补充"}

不是搜答案，是比较思路。
完整解法：${getUrl()}#${solution.id}`;
    }

    const routes = getShareRoutes(problem);
    const routeByLabel = new Map(routes.map((route) => [route.label, route.solution?.title ?? "待补充解法"]));
    const tags = getShareTags(problem).slice(0, 5);

    return `【ProofArena 解法分享】
题目：${problem.title}
来源：${problem.year}${problem.region} · ${problem.number}

这道题目前收录了 ${problem.solutions.length} 种解法：
- 标准解：${routeByLabel.get("标准解") ?? "待补充解法"}
- 启发解：${routeByLabel.get("启发解") ?? "待补充解法"}
- 教学解：${routeByLabel.get("教学解") ?? "待补充解法"}
- 稳健解：${routeByLabel.get("稳健解") ?? "待补充解法"}

相关思路：${tags.length ? tags.join("、") : "待补充"}

不是搜答案，是比较思路。
完整解法：${getUrl()}`;
  }

  async function copyValue(value: string, target: "link" | "text") {

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

      setCopiedTarget(target);
      window.setTimeout(() => setCopiedTarget(null), 1600);
    } catch {
      setCopiedTarget(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => copyValue(getUrl(), "link")}
        className="inline-flex h-11 w-full items-center justify-center gap-2 border border-white/20 px-4 text-sm font-bold text-white transition hover:border-cyan-400/50 hover:text-cyan-300 sm:w-auto"
      >
        {copiedTarget === "link" ? <Check className="size-4 text-emerald-300" /> : <ClipboardCopy className="size-4" />}
        {copiedTarget === "link" ? "链接已复制" : "复制链接"}
      </button>
      {problem && (
        <button
          type="button"
          onClick={() => copyValue(buildShareText(), "text")}
          className="inline-flex h-11 w-full items-center justify-center gap-2 bg-cyan-400 px-4 text-sm font-bold text-zinc-950 transition hover:bg-cyan-300 sm:w-auto"
        >
          {copiedTarget === "text" ? <Check className="size-4" /> : <MessageSquareText className="size-4" />}
          {copiedTarget === "text" ? "文案已复制" : "复制分享文案"}
        </button>
      )}
    </>
  );
}
