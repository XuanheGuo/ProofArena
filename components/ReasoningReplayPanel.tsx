"use client";

import { useState } from "react";
import {
  ChevronDown,
  Eye,
  GitBranch,
  ShieldAlert,
  Sparkles,
  Wrench,
} from "lucide-react";
import { MathBlock } from "@/components/MathBlock";
import type {
  Problem,
  ProofMethodBoundary,
  ProofObservation,
  ProofStrategyBranch,
  ProofTransformation,
  ProofVerificationStep,
} from "@/lib/types";

// ── Step shell ────────────────────────────────────────────────────────────────

function Step({
  index,
  label,
  icon: Icon,
  accent,
  children,
}: {
  index: number;
  label: string;
  icon: React.ElementType;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
      <div className="flex flex-col items-center gap-1">
        <div
          className={`flex size-8 items-center justify-center border text-xs font-bold ${accent}`}
        >
          {index}
        </div>
        <div className="w-px flex-1 bg-white/10" />
      </div>
      <div className="pb-6">
        <div
          className={`mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${accent.replace("border-", "text-").replace("/30", "/80").replace("bg-", "")}`}
        >
          <Icon className="size-3.5" />
          {label}
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Step 1: observations ──────────────────────────────────────────────────────

function ObservationsStep({
  observations,
}: {
  observations: ProofObservation[];
}) {
  return (
    <ul className="space-y-2">
      {observations.map((obs) => (
        <li key={obs.id} className="border border-white/10 bg-zinc-950 p-3">
          <p className="text-sm font-bold text-zinc-200">
            <MathBlock>{obs.title}</MathBlock>
          </p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            <MathBlock>{obs.whyItMatters}</MathBlock>
          </p>
        </li>
      ))}
    </ul>
  );
}

// ── Step 2: strategy branches ─────────────────────────────────────────────────

function BranchesStep({
  branches,
  observations,
  methodBoundaries,
}: {
  branches: ProofStrategyBranch[];
  observations: ProofObservation[];
  methodBoundaries: ProofMethodBoundary[];
}) {
  const obsMap = new Map(observations.map((o) => [o.id, o]));
  const boundaryMap = new Map(methodBoundaries.map((b) => [b.id, b]));

  return (
    <div className="space-y-2">
      {branches.map((branch) => {
        const obs = obsMap.get(branch.observationId);
        const linkedBoundaries = (branch.methodBoundaryIds ?? [])
          .map((id) => boundaryMap.get(id))
          .filter((b): b is ProofMethodBoundary => b !== undefined);
        return (
          <div
            key={branch.id}
            className="border border-cyan-400/15 bg-cyan-400/[0.04] p-3"
          >
            <p className="text-sm font-bold text-zinc-200">
              <MathBlock>{branch.title}</MathBlock>
            </p>
            {obs && (
              <p className="mt-0.5 text-[10px] text-zinc-600">
                来自观察：<MathBlock>{obs.signal}</MathBlock>
              </p>
            )}
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              <div className="border-l-2 border-emerald-400/40 pl-2">
                <span className="text-[10px] font-bold text-emerald-400/70">
                  优势
                </span>
                <p className="mt-0.5 text-xs leading-5 text-zinc-400">
                  <MathBlock>{branch.promise}</MathBlock>
                </p>
              </div>
              <div className="border-l-2 border-red-400/40 pl-2">
                <span className="text-[10px] font-bold text-red-400/70">
                  风险
                </span>
                <p className="mt-0.5 text-xs leading-5 text-zinc-400">
                  <MathBlock>{branch.risk}</MathBlock>
                </p>
              </div>
            </div>
            {linkedBoundaries.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-cyan-400/10 pt-2">
                <span className="text-[10px] text-zinc-600">注意：</span>
                {linkedBoundaries.map((b) => (
                  <span
                    key={b.id}
                    className="inline-flex items-center gap-1 border border-amber-400/25 bg-amber-400/[0.06] px-2 py-0.5 text-[10px] text-amber-300"
                    title={b.whyNotPriority}
                  >
                    {b.methodName} → 见下方方法边界
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 3: method boundaries (why tempting → why not) ────────────────────────

function MethodBoundaryItem({ boundary }: { boundary: ProofMethodBoundary }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-amber-400/20 bg-amber-400/[0.04]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-bold text-zinc-200">
            {boundary.methodName}
          </p>
          <p className="mt-0.5 truncate text-xs text-zinc-500">
            <MathBlock>{boundary.whyTempting}</MathBlock>
          </p>
        </div>
        <ChevronDown
          className={`size-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="grid gap-2 border-t border-amber-400/10 p-3 sm:grid-cols-2">
          <div>
            <span className="text-[10px] font-bold text-red-400/70">
              为什么不优先
            </span>
            <p className="mt-1 text-xs leading-5 text-zinc-400">
              <MathBlock>{boundary.whyNotPriority}</MathBlock>
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-amber-400/70">
              在哪里卡住
            </span>
            <p className="mt-1 text-xs leading-5 text-zinc-400">
              <MathBlock>{boundary.whereItBreaks}</MathBlock>
            </p>
          </div>
          <div className="sm:col-span-2">
            <span className="text-[10px] font-bold text-emerald-400/70">
              什么时候变成好方法
            </span>
            <p className="mt-1 text-xs leading-5 text-zinc-400">
              <MathBlock>{boundary.whenItWorks}</MathBlock>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function MethodBoundariesStep({
  boundaries,
}: {
  boundaries: ProofMethodBoundary[];
}) {
  return (
    <div className="space-y-2">
      {boundaries.map((b) => (
        <MethodBoundaryItem key={b.id} boundary={b} />
      ))}
    </div>
  );
}

// ── Step 4: key transformations ───────────────────────────────────────────────

function TransformationsStep({
  transformations,
}: {
  transformations: ProofTransformation[];
}) {
  return (
    <div className="space-y-2">
      {transformations.map((t) => (
        <div key={t.id} className="border border-white/10 bg-zinc-950 p-3">
          <p className="text-sm font-bold text-zinc-200">
            <MathBlock>{t.title}</MathBlock>
          </p>
          <div className="mt-2 flex items-start gap-2 text-xs">
            <span className="shrink-0 border border-zinc-700 px-1.5 py-0.5 font-mono text-zinc-500">
              从
            </span>
            <p className="leading-5 text-zinc-400">
              <MathBlock>{t.from}</MathBlock>
            </p>
          </div>
          <div className="mt-1 flex items-start gap-2 text-xs">
            <span className="shrink-0 border border-cyan-700/50 px-1.5 py-0.5 font-mono text-cyan-500">
              到
            </span>
            <p className="leading-5 text-zinc-300">
              <MathBlock>{t.to}</MathBlock>
            </p>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-zinc-500">
            <MathBlock>{t.complexityReduction}</MathBlock>
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Step 5: verification steps ────────────────────────────────────────────────

const stepTypeLabel: Record<ProofVerificationStep["type"], string> = {
  substitution: "代入检验",
  boundary: "边界核对",
  equality: "取等验证",
  numeric: "数值抽样",
  cas: "CAS 复算",
  manual: "人工复核",
};

const stepTypeTone: Record<ProofVerificationStep["type"], string> = {
  substitution: "border-emerald-400/30 text-emerald-300",
  boundary: "border-amber-400/30 text-amber-300",
  equality: "border-cyan-400/30 text-cyan-300",
  numeric: "border-violet-400/30 text-violet-300",
  cas: "border-blue-400/30 text-blue-300",
  manual: "border-zinc-500/30 text-zinc-400",
};

function VerificationStep({ step }: { step: ProofVerificationStep }) {
  return (
    <div className="border border-white/10 bg-zinc-950 p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className={`border px-1.5 py-0.5 text-[10px] font-bold ${stepTypeTone[step.type]}`}
        >
          {stepTypeLabel[step.type]}
        </span>
      </div>
      <p className="text-xs leading-5 text-zinc-300">
        <MathBlock>{step.statement}</MathBlock>
      </p>
      {step.note && (
        <p className="mt-1.5 border-l border-emerald-400/30 pl-2 text-[11px] leading-5 text-zinc-500">
          {step.note}
        </p>
      )}
    </div>
  );
}

function VerificationStepsStep({ steps }: { steps: ProofVerificationStep[] }) {
  return (
    <div className="space-y-2">
      {steps.map((s) => (
        <VerificationStep key={s.id} step={s} />
      ))}
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export function ReasoningReplayPanel({ problem }: { problem: Problem }) {
  const pg = problem.proofGraph;
  const [open, setOpen] = useState(false);

  if (!pg) return null;

  const hasContent =
    pg.observations.length > 0 ||
    pg.branches.length > 0 ||
    pg.transformations.length > 0 ||
    pg.verificationSteps.length > 0 ||
    pg.methodBoundaries.length > 0;

  if (!hasContent) return null;

  const steps: Array<{
    key: string;
    label: string;
    icon: React.ElementType;
    accent: string;
    content: React.ReactNode;
  }> = [
    pg.observations.length > 0 && {
      key: "obs",
      label: "看到什么条件",
      icon: Eye,
      accent: "border-cyan-400/30 bg-cyan-400/[0.08] text-cyan-300",
      content: <ObservationsStep observations={pg.observations} />,
    },
    pg.branches.length > 0 && {
      key: "branches",
      label: "可能想到哪些路线",
      icon: GitBranch,
      accent: "border-violet-400/30 bg-violet-400/[0.08] text-violet-300",
      content: (
        <BranchesStep
          branches={pg.branches}
          observations={pg.observations}
          methodBoundaries={pg.methodBoundaries}
        />
      ),
    },
    pg.methodBoundaries.length > 0 && {
      key: "boundaries",
      label: "哪些路线看起来可行但不优先",
      icon: ShieldAlert,
      accent: "border-amber-400/30 bg-amber-400/[0.08] text-amber-300",
      content: <MethodBoundariesStep boundaries={pg.methodBoundaries} />,
    },
    pg.transformations.length > 0 && {
      key: "transforms",
      label: "关键转化",
      icon: Sparkles,
      accent: "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-300",
      content: <TransformationsStep transformations={pg.transformations} />,
    },
    pg.verificationSteps.length > 0 && {
      key: "verify",
      label: "如何验证",
      icon: Wrench,
      accent: "border-zinc-500/30 bg-zinc-500/[0.08] text-zinc-300",
      content: <VerificationStepsStep steps={pg.verificationSteps} />,
    },
  ].filter(Boolean) as typeof steps;

  return (
    <section className="border border-white/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 bg-black/20 px-4 py-3 text-left"
      >
        <div>
          <h3 className="text-sm font-bold text-white">推导过程</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            从条件出发，逐步缩小路线，找到关键转化，再验证结果
          </p>
        </div>
        <ChevronDown
          className={`size-4 shrink-0 text-zinc-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="border-t border-white/10 p-4 md:p-6">
          <div className="space-y-0">
            {steps.map((step, i) => (
              <Step
                key={step.key}
                index={i + 1}
                label={step.label}
                icon={step.icon}
                accent={step.accent}
              >
                {step.content}
              </Step>
            ))}
            {/* last step has no connector line */}
          </div>
        </div>
      )}
    </section>
  );
}
