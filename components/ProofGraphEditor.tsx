"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Save } from "lucide-react";
import { saveProofGraph } from "@/lib/save-proof-graph";
import { loadSolutionDrafts, type SolutionDraft } from "@/lib/load-solution-drafts";
import type { ProofGraphV1 } from "@/lib/types";
import type { ProblemSummary } from "@/app/admin/proof-graph/page";

// ── constants ────────────────────────────────────────────────────────────────

const REQUIRED_KEYS: Array<keyof ProofGraphV1> = [
  "observations",
  "branches",
  "transformations",
  "verificationSteps",
  "methodBoundaries",
  "challengeEdges",
];

const EMPTY_SKELETON: ProofGraphV1 = {
  observations: [],
  branches: [],
  transformations: [],
  verificationSteps: [],
  methodBoundaries: [],
  challengeEdges: [],
};

function generateId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ── validation ───────────────────────────────────────────────────────────────

type ValidationResult =
  | { ok: true; parsed: ProofGraphV1; counts: Record<string, number> }
  | { ok: false; error: string };

function validate(text: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "JSON 语法错误，请检查括号和引号。" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "根结构必须是对象（{}）。" };
  }
  const obj = parsed as Record<string, unknown>;
  const missing = REQUIRED_KEYS.filter((k) => !Array.isArray(obj[k]));
  if (missing.length) {
    return { ok: false, error: `缺少必需的数组字段：${missing.join(", ")}` };
  }
  const counts: Record<string, number> = {};
  for (const k of REQUIRED_KEYS) {
    counts[k] = (obj[k] as unknown[]).length;
  }
  return { ok: true, parsed: obj as unknown as ProofGraphV1, counts };
}

// ── insert helpers ────────────────────────────────────────────────────────────

function insertIntoJson(
  currentText: string,
  targetKey: keyof ProofGraphV1,
  item: Record<string, unknown>,
): string {
  const result = validate(currentText);
  if (!result.ok) return currentText;
  const graph = structuredClone(result.parsed as unknown) as Record<string, unknown[]>;
  (graph[targetKey] as unknown[]).push(item);
  return JSON.stringify(graph, null, 2);
}

function observationFromDraft(draft: SolutionDraft["draft"], solutionId: string) {
  return {
    id: generateId("obs"),
    title: draft.observationSignal ?? "",
    signal: draft.observationSignal ?? "",
    whyItMatters: draft.observationWhy ?? "",
    relatedSolutionIds: [solutionId],
  };
}

function transformationFromDraft(draft: SolutionDraft["draft"], solutionId: string) {
  return {
    id: generateId("tr"),
    solutionId,
    title: draft.transformationFrom ? `${draft.transformationFrom} → ${draft.transformationTo ?? ""}` : "",
    from: draft.transformationFrom ?? "",
    to: draft.transformationTo ?? "",
    justification: draft.transformationJustification ?? "",
    complexityReduction: draft.transformationComplexityReduction ?? "",
  };
}

function boundaryFromDraft(draft: SolutionDraft["draft"]) {
  return {
    id: generateId("mb"),
    methodName: draft.methodBoundaryName ?? "",
    whyTempting: draft.methodBoundaryWhyTempting ?? "",
    whyNotPriority: draft.methodBoundaryWhyNotPriority ?? "",
    whereItBreaks: draft.methodBoundaryWhereItBreaks ?? "",
    whenItWorks: draft.methodBoundaryWhenItWorks ?? "",
    relatedConcepts: [],
  };
}

// ── DraftCard ─────────────────────────────────────────────────────────────────

function DraftCard({
  draft: solutionDraft,
  onInsert,
}: {
  draft: SolutionDraft;
  onInsert: (key: keyof ProofGraphV1, item: Record<string, unknown>) => void;
}) {
  const { draft } = solutionDraft;
  const hasObs = !!(draft.observationSignal || draft.observationWhy);
  const hasTransform = !!(draft.transformationFrom || draft.transformationTo);
  const hasBoundary = !!draft.methodBoundaryName;

  const kindLabel: Record<string, string> = {
    standard: "标准", insight: "启发", robust: "稳健", teaching: "教学",
  };

  return (
    <div className="rounded border border-white/10 bg-zinc-950 p-3 text-xs">
      <div className="mb-2 flex items-center gap-2">
        <span className="font-bold text-zinc-300">{solutionDraft.solutionTitle}</span>
        <span className="border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-600">
          {kindLabel[solutionDraft.solutionKind] ?? solutionDraft.solutionKind}
        </span>
      </div>
      <div className="space-y-2">
        {hasObs && (
          <div className="flex items-start justify-between gap-3 border-l-2 border-cyan-400/30 pl-2">
            <div className="min-w-0">
              <span className="font-bold text-cyan-400/70">观察</span>
              <p className="mt-0.5 line-clamp-2 text-zinc-500">{draft.observationSignal}</p>
            </div>
            <button
              type="button"
              onClick={() => onInsert("observations", observationFromDraft(draft, solutionDraft.solutionId))}
              className="shrink-0 rounded border border-cyan-400/30 px-2 py-0.5 text-[10px] font-bold text-cyan-300 hover:bg-cyan-400/10"
            >
              插入
            </button>
          </div>
        )}
        {hasTransform && (
          <div className="flex items-start justify-between gap-3 border-l-2 border-emerald-400/30 pl-2">
            <div className="min-w-0">
              <span className="font-bold text-emerald-400/70">转化</span>
              <p className="mt-0.5 line-clamp-2 text-zinc-500">{draft.transformationFrom}</p>
            </div>
            <button
              type="button"
              onClick={() => onInsert("transformations", transformationFromDraft(draft, solutionDraft.solutionId))}
              className="shrink-0 rounded border border-emerald-400/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300 hover:bg-emerald-400/10"
            >
              插入
            </button>
          </div>
        )}
        {hasBoundary && (
          <div className="flex items-start justify-between gap-3 border-l-2 border-amber-400/30 pl-2">
            <div className="min-w-0">
              <span className="font-bold text-amber-400/70">方法边界</span>
              <p className="mt-0.5 line-clamp-2 text-zinc-500">{draft.methodBoundaryName}</p>
            </div>
            <button
              type="button"
              onClick={() => onInsert("methodBoundaries", boundaryFromDraft(draft))}
              className="shrink-0 rounded border border-amber-400/30 px-2 py-0.5 text-[10px] font-bold text-amber-300 hover:bg-amber-400/10"
            >
              插入
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ProofGraphEditor ──────────────────────────────────────────────────────────

export function ProofGraphEditor({ problems }: { problems: ProblemSummary[] }) {
  const [selectedId, setSelectedId] = useState<string>(problems[0]?.id ?? "");
  const [jsonText, setJsonText] = useState<string>(() => {
    const first = problems[0];
    return JSON.stringify(first?.proofGraph ?? EMPTY_SKELETON, null, 2);
  });
  const [drafts, setDrafts] = useState<SolutionDraft[]>([]);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const validation = validate(jsonText);

  function selectProblem(id: string) {
    const problem = problems.find((p) => p.id === id);
    setSelectedId(id);
    setJsonText(JSON.stringify(problem?.proofGraph ?? EMPTY_SKELETON, null, 2));
    setDrafts([]);
    setDraftsOpen(false);
    setMessage("");
    setError("");
  }

  async function loadDrafts() {
    if (!selectedId) return;
    setDraftsLoading(true);
    try {
      const result = await loadSolutionDrafts(selectedId);
      setDrafts(result);
      setDraftsOpen(true);
    } catch {
      setError("加载解法草稿时出错。");
    } finally {
      setDraftsLoading(false);
    }
  }

  function handleInsert(key: keyof ProofGraphV1, item: Record<string, unknown>) {
    setJsonText((current) => insertIntoJson(current, key, item));
    setMessage("");
    setError("");
  }

  async function handleSave() {
    if (!validation.ok) return;
    setSaving(true);
    setMessage("");
    setError("");
    const result = await saveProofGraph(selectedId, validation.parsed);
    setSaving(false);
    if (result.success) {
      setMessage("已保存。");
    } else {
      setError(result.error);
    }
  }

  const selectedProblem = problems.find((p) => p.id === selectedId);

  const LABEL_MAP: Partial<Record<keyof ProofGraphV1, string>> = {
    observations: "观察", branches: "分支", transformations: "转化",
    verificationSteps: "验证", methodBoundaries: "边界", challengeEdges: "挑战",
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      {/* ── Main editor column ── */}
      <div className="space-y-4">
        {/* Problem selector */}
        <label className="grid gap-2 text-sm">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-white">选择题目</span>
            {selectedProblem && (
              <Link
                href={`/problems/${selectedProblem.id}`}
                className="text-xs font-bold text-cyan-300 transition hover:text-cyan-200"
              >
                查看前台题页
              </Link>
            )}
          </span>
          <select
            value={selectedId}
            onChange={(e) => selectProblem(e.target.value)}
            className="h-11 rounded border border-white/10 bg-zinc-900 px-3 text-sm text-white outline-none focus:border-cyan-400/50"
          >
            {problems.map((p) => (
              <option key={p.id} value={p.id}>
                {p.year} {p.region} · {p.number} · {p.title}
                {p.proofGraph ? " ✓" : ""}
              </option>
            ))}
          </select>
        </label>

        {/* JSON textarea */}
        <label className="grid gap-2 text-sm">
          <span className="font-bold text-white">
            proof_graph JSON
            <span className="ml-2 font-normal text-zinc-600">
              {selectedProblem?.proofGraph ? "已有数据" : "空"}
            </span>
          </span>
          <textarea
            value={jsonText}
            onChange={(e) => { setJsonText(e.target.value); setMessage(""); setError(""); }}
            rows={28}
            spellCheck={false}
            className="resize-y rounded border border-white/10 bg-black/30 px-4 py-3 font-mono text-xs leading-5 text-zinc-200 outline-none transition focus:border-cyan-400/50"
          />
        </label>

        {/* Messages */}
        {message && (
          <p className="rounded border border-emerald-400/30 bg-emerald-400/[0.06] px-3 py-2 text-sm text-emerald-300">
            {message}
          </p>
        )}
        {error && (
          <p className="rounded border border-red-400/30 bg-red-400/[0.06] px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        {/* Save button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={!validation.ok || saving}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded bg-cyan-400 text-sm font-bold text-zinc-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Save className="size-4" />
          {saving ? "保存中…" : "保存 proof_graph"}
        </button>
      </div>

      {/* ── Right sidebar ── */}
      <div className="space-y-4">
        {/* Validation strip */}
        <section className="rounded border border-white/10 bg-black/20 p-4">
          <h3 className="mb-3 text-sm font-bold text-white">JSON 验证</h3>
          {validation.ok ? (
            <div className="space-y-1.5">
              <p className="text-xs text-emerald-300">✓ 结构合法</p>
              {REQUIRED_KEYS.map((k) => (
                <div key={k} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">{LABEL_MAP[k] ?? k}</span>
                  <span className="font-bold text-zinc-300">{validation.counts[k]}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs leading-5 text-red-300">{validation.error}</p>
          )}
        </section>

        {/* Drafts panel */}
        <section className="rounded border border-white/10 bg-black/20">
          <button
            type="button"
            onClick={draftsOpen ? () => setDraftsOpen(false) : loadDrafts}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm"
          >
            <span className="font-bold text-white">
              解法草稿
              {drafts.length > 0 && (
                <span className="ml-2 rounded border border-violet-400/30 px-1.5 py-0.5 text-[10px] text-violet-300">
                  {drafts.length} 条
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-600">
                {draftsOpen ? "" : "点击加载"}
              </span>
              <ChevronDown className={`size-4 text-zinc-500 transition-transform ${draftsOpen ? "rotate-180" : ""}`} />
            </div>
          </button>
          {draftsOpen && (
            <div className="border-t border-white/10 p-3">
              {draftsLoading ? (
                <p className="py-4 text-center text-xs text-zinc-600">加载中…</p>
              ) : drafts.length === 0 ? (
                <p className="py-4 text-center text-xs text-zinc-600">
                  该题目没有已发布解法的草稿数据。
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-[10px] leading-5 text-zinc-600">
                    点击「插入」将草稿字段作为新对象插入对应数组。ID 自动生成，请在 JSON 编辑器中补充其余字段（如 observationId、solutionIds 等）。
                  </p>
                  {drafts.map((d) => (
                    <DraftCard key={d.solutionId} draft={d} onInsert={handleInsert} />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Quick reference */}
        <section className="rounded border border-white/10 bg-black/20 p-4">
          <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-zinc-600">
            ProofGraphV1 字段参考
          </h3>
          <div className="space-y-1 text-[10px] leading-5 text-zinc-600">
            <p><span className="text-zinc-400">observations</span>: id, title, signal, whyItMatters, relatedSolutionIds[]</p>
            <p><span className="text-zinc-400">branches</span>: id, observationId, title, promise, risk, solutionIds[]</p>
            <p><span className="text-zinc-400">transformations</span>: id, solutionId, title, from, to, justification, complexityReduction</p>
            <p><span className="text-zinc-400">verificationSteps</span>: id, solutionId, type, statement, status, note</p>
            <p><span className="text-zinc-400">methodBoundaries</span>: id, methodName, whyTempting, whyNotPriority, whereItBreaks, whenItWorks, relatedConcepts[]</p>
            <p><span className="text-zinc-400">challengeEdges</span>: id, challengerSolutionId, targetSolutionId, claim, advantages[], risk</p>
          </div>
        </section>
      </div>
    </div>
  );
}
