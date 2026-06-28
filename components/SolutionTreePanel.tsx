"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, GitBranch, TreePine } from "lucide-react";
import type { Problem, SolutionTreeMethod } from "@/lib/types";

function SolutionMethodNode({
  method,
  problem,
  depth = 0,
}: {
  method: SolutionTreeMethod;
  problem: Problem;
  depth?: number;
}) {
  const linkedSolutions = (method.solutionIds ?? [])
    .map((id) => problem.solutions.find((solution) => solution.id === id))
    .filter((solution): solution is NonNullable<typeof solution> => Boolean(solution));
  const hasChildren = Boolean(method.children?.length);

  return (
    <li className="relative">
      <div className="grid gap-3 border border-white/10 bg-black/20 p-3 sm:grid-cols-[1fr_auto]">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center border border-emerald-400/25 bg-emerald-400/5 font-mono text-[10px] text-emerald-300">
              {depth + 1}
            </span>
            <h4 className="text-sm font-bold text-white">{method.title}</h4>
          </div>
          {method.description && <p className="mt-2 text-xs leading-5 text-zinc-500">{method.description}</p>}
        </div>

        {linkedSolutions.length > 0 && (
          <div className="flex flex-wrap gap-2 sm:max-w-80 sm:justify-end">
            {linkedSolutions.map((solution) => (
              <a
                key={solution.id}
                href={`#${solution.id}`}
                className="inline-flex h-8 items-center gap-1.5 border border-cyan-400/20 bg-cyan-400/5 px-2.5 text-xs font-bold text-cyan-100 transition hover:border-cyan-300/50 hover:text-cyan-200"
              >
                {solution.badge}
                <span className="max-w-32 truncate text-zinc-300">{solution.title}</span>
                <ArrowUpRight className="size-3 shrink-0 text-cyan-300" />
              </a>
            ))}
          </div>
        )}
      </div>

      {hasChildren && (
        <ol className="ml-4 mt-3 space-y-3 border-l border-white/10 pl-4">
          {method.children?.map((child) => (
            <SolutionMethodNode key={child.id} method={child} problem={problem} depth={depth + 1} />
          ))}
        </ol>
      )}
    </li>
  );
}

export function SolutionTreePanel({ problem }: { problem: Problem }) {
  const [expanded, setExpanded] = useState(false);
  const totalMethodCount = useMemo(() => {
    function count(methods: SolutionTreeMethod[]): number {
      return methods.reduce((sum, method) => sum + 1 + count(method.children ?? []), 0);
    }

    return problem.solutionTree?.roots.reduce((sum, root) => sum + count(root.methods), 0) ?? 0;
  }, [problem.solutionTree]);

  if (!problem.solutionTree || problem.solutionTree.roots.length === 0) return null;

  return (
    <section id="solution-tree" className="mt-5 scroll-mt-32 border border-emerald-400/25 bg-zinc-950">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center justify-between gap-4 border-b border-white/10 px-5 py-4 text-left transition hover:bg-white/[0.03]"
      >
        <span className="flex items-center gap-3">
          <TreePine className="size-4 text-emerald-300" />
          <span>
            <span className="block text-sm font-bold text-white">🌳 思路树</span>
            <span className="mt-1 block font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              {problem.solutionTree.roots.length} 个思维入口 · {totalMethodCount} 条方法分支
            </span>
          </span>
        </span>
        <ChevronDown className={`size-4 shrink-0 text-zinc-500 transition ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="grid gap-px bg-white/10 lg:grid-cols-2">
          {problem.solutionTree.roots.map((root) => (
            <div key={root.id} className="bg-zinc-950 p-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center border border-emerald-400/25 bg-emerald-400/5">
                  <GitBranch className="size-4 text-emerald-300" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white">{root.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">{root.description}</p>
                </div>
              </div>

              <ol className="mt-4 space-y-3">
                {root.methods.map((method) => (
                  <SolutionMethodNode key={method.id} method={method} problem={problem} />
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
