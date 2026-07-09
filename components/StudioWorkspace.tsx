"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  Check,
  ClipboardCopy,
  FileJson2,
  Gauge,
  Lightbulb,
  ListChecks,
  MessageSquareText,
  Route,
  Send,
  SlidersHorizontal,
  Sparkles,
  Tags,
} from "lucide-react";
import { getInsightNode } from "@/data/insights";
import { getKnowledgeNode } from "@/data/knowledge";
import { matchTagsToKnowledge } from "@/data/tag-matcher";
import { checkSolutionQuality } from "@/lib/quality-checker";
import { parseSubmissionError } from "@/lib/submission-errors";
import { getSubmissionFailureReasonLabel } from "@/lib/submission-meta";
import { createClient } from "@/lib/supabase-client";
import { MathBlock } from "@/components/MathBlock";
import { ScoreBar } from "@/components/ScoreBar";
import { getSolutionKindMeta } from "@/lib/solution-kinds";
import { convertPlainMathTextToLatex } from "@/lib/math-normalizer";
import type { TagMatch } from "@/lib/types";

type ProblemOption = {
  id: string;
  title: string;
  source: string;
  tags: string[];
};

type StepId = "route" | "thinking" | "process" | "review" | "submit";
type SolutionKind = "standard" | "insight" | "robust" | "teaching";

type StudioState = {
  problemId: string;
  kind: SolutionKind;
  title: string;
  author: string;
  solutionTags: string;
  origin: string;
  keyTransform: string;
  fullProcess: string;
  inspiration: string;
  transferValue: string;
  suitableFor: string;
  tradeoffs: string;
  pitfalls: string;
  verifiableSteps: string;
  scoringReason: string;
  scores: {
    correctness: number;
    examReady: number;
    elegance: number;
    calculation: number;
    explanation: number;
  };
};

const steps: Array<{ id: StepId; title: string; icon: typeof Route }> = [
  { id: "route", title: "绑定题目", icon: Route },
  { id: "thinking", title: "思路入口", icon: Lightbulb },
  { id: "process", title: "推理过程", icon: ListChecks },
  { id: "review", title: "评分校对", icon: SlidersHorizontal },
  { id: "submit", title: "预览提交", icon: Send },
];

const kindLabels: Record<SolutionKind, string> = {
  standard: "标准解",
  insight: "启发解",
  robust: "稳健解",
  teaching: "教学解",
};

const scoreLabels: Array<[keyof StudioState["scores"], string, string]> = [
  ["correctness", "正确性", "推理是否严密"],
  ["examReady", "考场性", "时间和入口是否可控"],
  ["elegance", "结构美感", "转化是否自然简洁"],
  ["calculation", "计算量", "展开和重复运算是否少"],
  ["explanation", "讲解友好", "是否便于复盘迁移"],
];

const initialState = (problemId: string): StudioState => ({
  problemId,
  kind: "standard",
  title: "",
  author: "ProofArena 用户",
  solutionTags: "",
  origin: "",
  keyTransform: "",
  fullProcess: "",
  inspiration: "",
  transferValue: "",
  suitableFor: "",
  tradeoffs: "",
  pitfalls: "",
  verifiableSteps: "",
  scoringReason: "",
  scores: {
    correctness: 8,
    examReady: 7,
    elegance: 7,
    calculation: 7,
    explanation: 8,
  },
});

function splitList(value: string) {
  return value
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function confidenceLabel(value: number) {
  return `${Math.round(value * 100)}%`;
}

function normalizeScore(value: number) {
  return Math.min(10, Math.max(1, Math.round(value * 10) / 10));
}

export function StudioWorkspace({ problems }: { problems: ProblemOption[] }) {
  const [state, setState] = useState(() => initialState(problems[0]?.id ?? ""));
  const [activeStep, setActiveStep] = useState<StepId>("route");
  const [previewMode, setPreviewMode] = useState<"card" | "markdown" | "json">("card");
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "submitting" | "done" | "error" | "precheck_failed">("idle");
  const [submitError, setSubmitError] = useState("");
  const [precheckFailedReason, setPrecheckFailedReason] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
  }, [supabase]);

  const selectedProblem = useMemo(
    () => problems.find((problem) => problem.id === state.problemId) ?? problems[0],
    [problems, state.problemId]
  );

  const solutionTags = useMemo(() => splitList(state.solutionTags), [state.solutionTags]);
  const allTags = useMemo(() => unique([...(selectedProblem?.tags ?? []), ...solutionTags]), [selectedProblem, solutionTags]);
  const matches = useMemo(() => {
    const merged = new Map<string, TagMatch>();

    for (const match of matchTagsToKnowledge(allTags)) {
      const current = merged.get(match.tag);
      merged.set(match.tag, current ? {
        ...current,
        matchedKnowledgeIds: unique([...current.matchedKnowledgeIds, ...match.matchedKnowledgeIds]),
        matchedInsightIds: unique([...current.matchedInsightIds, ...match.matchedInsightIds]),
        confidence: Math.max(current.confidence, match.confidence),
      } : match);
    }

    return [...merged.values()];
  }, [allTags]);

  const knowledgeNodes = useMemo(
    () => unique(matches.flatMap((match) => match.matchedKnowledgeIds)).map(getKnowledgeNode).filter((node): node is NonNullable<ReturnType<typeof getKnowledgeNode>> => Boolean(node)),
    [matches]
  );

  const insightNodes = useMemo(
    () => unique(matches.flatMap((match) => match.matchedInsightIds)).map(getInsightNode).filter((node): node is NonNullable<ReturnType<typeof getInsightNode>> => Boolean(node)),
    [matches]
  );

  const qualityReport = useMemo(() => checkSolutionQuality({
    origin: state.origin,
    keyTransform: state.keyTransform,
    fullProcess: state.fullProcess,
    inspiration: state.inspiration,
    transferValue: state.transferValue,
    pitfalls: state.pitfalls,
    verifiableSteps: state.verifiableSteps,
    suitableFor: state.suitableFor,
    tradeoffs: state.tradeoffs,
    scoringReason: state.scoringReason,
  }), [state]);

  const requiredChecks = useMemo(() => [
    ["绑定题目", Boolean(state.problemId)],
    ["解法标题", Boolean(state.title.trim())],
    ["思路来源", Boolean(state.origin.trim())],
    ["关键转化", Boolean(state.keyTransform.trim())],
    ["完整过程", Boolean(state.fullProcess.trim())],
    ["启发点", Boolean(state.inspiration.trim())],
    ["评分理由", Boolean(state.scoringReason.trim())],
  ] as const, [state]);

  const missingFields = requiredChecks.filter(([, done]) => !done).map(([label]) => label);
  const completeCount = requiredChecks.length - missingFields.length;

  const exportJson = useMemo(() => ({
    submissionType: "solution",
    problemId: state.problemId,
    problemTitle: selectedProblem?.title,
    problemSource: selectedProblem?.source,
    solution: {
      kind: state.kind,
      title: state.title,
      author: state.author,
      tags: solutionTags,
      origin: state.origin,
      keyTransform: state.keyTransform,
      process: state.fullProcess,
      inspiration: state.inspiration,
      transferValue: state.transferValue,
      suitableFor: splitList(state.suitableFor),
      tradeoffs: splitList(state.tradeoffs),
      pitfalls: splitList(state.pitfalls),
      verifiableSteps: splitList(state.verifiableSteps),
      scores: state.scores,
      scoringReason: state.scoringReason,
      knowledgeIds: unique(matches.flatMap((match) => match.matchedKnowledgeIds)),
      insightIds: unique(matches.flatMap((match) => match.matchedInsightIds)),
      autoMatches: matches,
      qualityReport,
    },
  }), [matches, qualityReport, selectedProblem, solutionTags, state]);

  const markdownPreview = useMemo(() => `# 解法投稿：${state.title || "未命名解法"}

## 对应题目
${selectedProblem ? `${selectedProblem.source} · ${selectedProblem.title}` : "（未选择）"}

## 类型
${kindLabels[state.kind]}

## 作者
${state.author || "（未填写）"}

## 标签
${solutionTags.length ? solutionTags.map((tag) => `- ${tag}`).join("\n") : "（未填写）"}

## 思路来源
${state.origin || "（未填写）"}

## 关键转化
${state.keyTransform || "（未填写）"}

## 完整过程
${state.fullProcess || "（未填写）"}

## 启发点
${state.inspiration || "（未填写）"}

## 迁移价值
${state.transferValue || "（未填写）"}

## 适用场景
${splitList(state.suitableFor).length ? splitList(state.suitableFor).map((item) => `- ${item}`).join("\n") : "（未填写）"}

## 代价与局限
${splitList(state.tradeoffs).length ? splitList(state.tradeoffs).map((item) => `- ${item}`).join("\n") : "（未填写）"}

## 易错点
${splitList(state.pitfalls).length ? splitList(state.pitfalls).map((item) => `- ${item}`).join("\n") : "（未填写）"}

## 可验证步骤
${splitList(state.verifiableSteps).length ? splitList(state.verifiableSteps).map((item) => `- ${item}`).join("\n") : "（未填写）"}

## 五维自评
${scoreLabels.map(([key, label]) => `- ${label}：${state.scores[key].toFixed(1)}`).join("\n")}

## 评分理由
${state.scoringReason || "（未填写）"}
`, [selectedProblem, solutionTags, state]);

  const jsonPreview = useMemo(() => JSON.stringify(exportJson, null, 2), [exportJson]);
  const preview = previewMode === "markdown" ? markdownPreview : jsonPreview;

  function updateField<K extends keyof StudioState>(key: K, value: StudioState[K]) {
    setState((current) => ({ ...current, [key]: value }));
    setSubmitStatus("idle");
  }

  function updateScore(key: keyof StudioState["scores"], value: number) {
    setState((current) => ({
      ...current,
      scores: { ...current.scores, [key]: normalizeScore(value) },
    }));
    setSubmitStatus("idle");
  }

  function convertMathFields() {
    setState((current) => ({
      ...current,
      origin: convertPlainMathTextToLatex(current.origin),
      keyTransform: convertPlainMathTextToLatex(current.keyTransform),
      fullProcess: convertPlainMathTextToLatex(current.fullProcess),
      inspiration: convertPlainMathTextToLatex(current.inspiration),
      transferValue: convertPlainMathTextToLatex(current.transferValue),
      tradeoffs: convertPlainMathTextToLatex(current.tradeoffs),
      pitfalls: convertPlainMathTextToLatex(current.pitfalls),
      verifiableSteps: convertPlainMathTextToLatex(current.verifiableSteps),
      scoringReason: convertPlainMathTextToLatex(current.scoringReason),
    }));
    setSubmitStatus("idle");
  }

  async function copyPreview() {
    await navigator.clipboard.writeText(previewMode === "json" ? jsonPreview : markdownPreview);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function handleSubmit() {
    if (!user || !selectedProblem || missingFields.length > 0) return;

    setSubmitStatus("submitting");
    setSubmitError("");
    setPrecheckFailedReason(null);

    const { data, error } = await supabase
      .from("submissions")
      .insert({
        submission_type: "solution",
        problem_id: selectedProblem.id,
        problem_source: selectedProblem.source,
        user_id: user.id,
        kind: state.kind,
        title: state.title,
        content: {
          markdown: markdownPreview,
          json: exportJson,
        },
        status: "pending",
      })
      .select("id, status, failure_reason")
      .single();

    if (error) {
      setSubmitStatus("error");
      setSubmitError(parseSubmissionError(error).message);
      return;
    }

    if (data?.status === "precheck_failed") {
      setSubmitStatus("precheck_failed");
      setPrecheckFailedReason(data.failure_reason ?? null);
      return;
    }

    setSubmitStatus("done");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      <div className={`grid gap-6 ${activeStep === "submit" ? "lg:grid-cols-[14rem_minmax(0,1fr)]" : "lg:grid-cols-[16rem_1fr_22rem]"}`}>
        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const active = activeStep === step.id;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStep(step.id)}
                className={`flex h-14 w-full items-center gap-3 rounded border px-4 text-left transition ${
                  active ? "border-cyan-400 bg-cyan-400 text-zinc-950" : "border-white/10 bg-zinc-950 text-zinc-400 hover:border-white/25 hover:text-white"
                }`}
              >
                <span className="font-mono text-xs font-black">{String(index + 1).padStart(2, "0")}</span>
                <Icon className="size-4" />
                <span className="text-sm font-bold">{step.title}</span>
              </button>
            );
          })}
        </aside>

        <main className="min-w-0 border border-white/10 bg-zinc-950">
          <div className="border-b border-white/10 px-5 py-4 md:px-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-300">ProofArena Studio</p>
            <h2 className="mt-1 text-xl font-black text-white">{steps.find((step) => step.id === activeStep)?.title}</h2>
          </div>
          <div className="p-5 md:p-6">
            {activeStep === "route" && (
              <div className="space-y-5">
                <label className="grid gap-2 text-sm">
                  <span className="font-bold text-white">对应题目</span>
                  <select
                    value={state.problemId}
                    onChange={(event) => updateField("problemId", event.target.value)}
                    className="h-11 rounded border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-cyan-400/60"
                  >
                    {problems.map((problem) => (
                      <option key={problem.id} value={problem.id}>{problem.source} · {problem.title}</option>
                    ))}
                  </select>
                </label>
                {selectedProblem && (
                  <div className="rounded border border-white/10 bg-black/20 p-4">
                    <p className="text-xs font-bold text-zinc-500">当前题目</p>
                    <h3 className="mt-2 text-lg font-black text-white">{selectedProblem.title}</h3>
                    <p className="mt-1 text-sm text-zinc-500">{selectedProblem.source}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedProblem.tags.map((tag) => (
                        <span key={tag} className="rounded border border-white/10 px-2.5 py-1 text-xs text-zinc-400">#{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField label="解法标题" value={state.title} onChange={(value) => updateField("title", value)} placeholder="例如：切线下界与望远镜乘积" />
                  <TextField label="作者署名" value={state.author} onChange={(value) => updateField("author", value)} />
                  <label className="grid gap-2 text-sm">
                    <span className="font-bold text-white">解法类型</span>
                    <select
                      value={state.kind}
                      onChange={(event) => updateField("kind", event.target.value as SolutionKind)}
                      className="h-11 rounded border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-cyan-400/60"
                    >
                      {Object.entries(kindLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <TextField label="解法标签" value={state.solutionTags} onChange={(value) => updateField("solutionTags", value)} placeholder="导数、切线、不等式" />
                </div>
              </div>
            )}

            {activeStep === "thinking" && (
              <div className="grid gap-4 md:grid-cols-2">
                <TextArea label="思路来源" value={state.origin} onChange={(value) => updateField("origin", value)} rows={5} placeholder="看到哪些条件后想到这条路？" />
                <TextArea label="关键转化" value={state.keyTransform} onChange={(value) => updateField("keyTransform", value)} rows={5} placeholder="哪一步真正改变了题目的形态？" />
                <TextArea label="启发点" value={state.inspiration} onChange={(value) => updateField("inspiration", value)} rows={5} />
                <TextArea label="迁移价值" value={state.transferValue} onChange={(value) => updateField("transferValue", value)} rows={5} />
              </div>
            )}

            {activeStep === "process" && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={convertMathFields}
                    className="inline-flex h-10 items-center rounded border border-amber-400/30 px-4 text-sm font-bold text-amber-300 transition hover:bg-amber-400/10"
                  >
                    自动转码公式
                  </button>
                </div>
                <TextArea label="完整过程" value={state.fullProcess} onChange={(value) => updateField("fullProcess", value)} rows={12} placeholder="按步骤写出推理链，保留定义域、分类讨论、取等条件等关键位置。" />
                <div className="grid gap-4 md:grid-cols-3">
                  <TextArea label="适用场景" value={state.suitableFor} onChange={(value) => updateField("suitableFor", value)} rows={5} />
                  <TextArea label="代价与局限" value={state.tradeoffs} onChange={(value) => updateField("tradeoffs", value)} rows={5} />
                  <TextArea label="易错点" value={state.pitfalls} onChange={(value) => updateField("pitfalls", value)} rows={5} />
                </div>
                <TextArea label="可验证步骤" value={state.verifiableSteps} onChange={(value) => updateField("verifiableSteps", value)} rows={4} />
              </div>
            )}

            {activeStep === "review" && (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  {scoreLabels.map(([key, label, description]) => (
                    <div key={key} className="rounded border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-white">{label}</p>
                          <p className="mt-1 text-xs text-zinc-600">{description}</p>
                        </div>
                        <strong className="font-display text-2xl text-cyan-300">{state.scores[key].toFixed(1)}</strong>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="10"
                        step="0.1"
                        value={state.scores[key]}
                        onChange={(event) => updateScore(key, Number(event.target.value))}
                        className="mt-4 w-full accent-cyan-400"
                      />
                    </div>
                  ))}
                </div>
                <TextArea label="评分理由" value={state.scoringReason} onChange={(value) => updateField("scoringReason", value)} rows={5} placeholder="解释这些分数背后的权衡。" />
              </div>
            )}

            {activeStep === "submit" && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex rounded border border-white/10 bg-black/20 p-1">
                    {[
                      ["card", BookOpen, "真实卡片"],
                      ["markdown", MessageSquareText, "Markdown"],
                      ["json", FileJson2, "JSON"],
                    ].map(([value, Icon, label]) => {
                      const PreviewIcon = Icon as typeof MessageSquareText;
                      const active = previewMode === value;
                      return (
                        <button
                          key={value as string}
                          type="button"
                          onClick={() => setPreviewMode(value as typeof previewMode)}
                          className={`inline-flex h-9 items-center gap-2 rounded px-3 text-xs font-bold transition ${
                            active ? "bg-cyan-400 text-zinc-950" : "text-zinc-400 hover:text-white"
                          }`}
                        >
                          <PreviewIcon className="size-3.5" />
                          {label as string}
                        </button>
                      );
                    })}
                  </div>
                  {previewMode !== "card" && (
                    <button
                      type="button"
                      onClick={copyPreview}
                      className="inline-flex h-10 items-center gap-2 rounded border border-white/10 px-4 text-sm font-bold text-zinc-300 transition hover:border-cyan-400/40 hover:text-cyan-200"
                    >
                      {copied ? <Check className="size-4 text-emerald-300" /> : <ClipboardCopy className="size-4" />}
                      {copied ? "已复制" : "复制预览"}
                    </button>
                  )}
                </div>
                {previewMode === "card" ? (
                  <StudioSolutionPreview
                    state={state}
                    problem={selectedProblem}
                    knowledgeTitles={knowledgeNodes.map((node) => node.title)}
                    insightTitles={insightNodes.map((node) => node.title)}
                  />
                ) : (
                  <pre className="math-scroll max-h-[34rem] rounded border border-white/10 bg-black/20 p-4 text-xs leading-6 text-zinc-300">
                    <code>{preview}</code>
                  </pre>
                )}
                <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  {submitStatus === "done" ? (
                    <div className="inline-flex items-center gap-2 text-sm font-bold text-emerald-300">
                      <Check className="size-4" />
                      已提交到审核队列
                    </div>
                  ) : user ? (
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitStatus === "submitting" || missingFields.length > 0}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded bg-cyan-400 px-6 text-sm font-bold text-zinc-950 transition hover:bg-cyan-300 disabled:opacity-50"
                    >
                      <Send className="size-4" />
                      {submitStatus === "submitting" ? "提交中..." : "提交到 ProofArena"}
                    </button>
                  ) : (
                    <a href="/auth/login" className="inline-flex h-11 items-center justify-center rounded border border-white/10 px-6 text-sm font-bold text-zinc-300 transition hover:border-cyan-400/40 hover:text-cyan-200">登录后提交</a>
                  )}
                  {missingFields.length > 0 && <p className="text-xs text-amber-300">还缺：{missingFields.join("、")}</p>}
                  {submitStatus === "error" && <p className="text-xs text-red-300">{submitError}</p>}
                  {submitStatus === "precheck_failed" && (
                    <p className="text-xs text-amber-300">
                      预筛未通过：{getSubmissionFailureReasonLabel(precheckFailedReason)}，请修改后重新提交。
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>

        <aside className={`space-y-4 lg:sticky lg:top-24 lg:self-start ${activeStep === "submit" ? "lg:hidden" : ""}`}>
          <Panel title="完整度" icon={<Gauge className="size-4 text-cyan-300" />}>
            <div className="flex items-end justify-between gap-3">
              <span className="text-sm text-zinc-500">{completeCount} / {requiredChecks.length}</span>
              <strong className="font-display text-3xl text-cyan-300">{qualityReport.completenessScore}</strong>
            </div>
            <div className="mt-3 h-2 rounded bg-white/10">
              <div className="h-full rounded bg-cyan-400" style={{ width: `${qualityReport.completenessScore}%` }} />
            </div>
            <div className="mt-4 space-y-2">
              {requiredChecks.map(([label, done]) => (
                <div key={label} className="flex items-center justify-between gap-3 text-xs">
                  <span className={done ? "text-zinc-300" : "text-zinc-600"}>{label}</span>
                  {done ? <Check className="size-3.5 text-emerald-300" /> : <AlertTriangle className="size-3.5 text-amber-300" />}
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="自动匹配" icon={<Sparkles className="size-4 text-amber-300" />}>
            <MatchGroup title="知识点" items={knowledgeNodes.map((node) => node.title)} />
            <MatchGroup title="思路触发器" items={insightNodes.map((node) => node.title)} />
            <div className="mt-4 space-y-2">
              {matches.slice(0, 5).map((match) => (
                <div key={match.tag} className="flex items-center justify-between gap-3 rounded border border-white/10 px-3 py-2 text-xs">
                  <span className="text-zinc-300">#{match.tag}</span>
                  <span className="font-mono text-cyan-300">{confidenceLabel(match.confidence)}</span>
                </div>
              ))}
              {matches.length === 0 && <p className="text-xs leading-6 text-zinc-600">暂无匹配</p>}
            </div>
          </Panel>

          <Panel title="质量提示" icon={<Tags className="size-4 text-emerald-300" />}>
            <QualityList items={qualityReport.suggestions} emptyText="暂无改进建议" />
            <QualityList items={qualityReport.strengths} emptyText="暂未识别到亮点" tone="emerald" />
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded border border-white/10 bg-zinc-950 p-4">
      <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

function scoreTone(index: number) {
  return index === 1 ? "red" : index === 2 ? "amber" : "cyan";
}

function splitProcess(value: string) {
  const lines = value
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:\d+[.)、]|[-*])\s*/, "").trim())
    .filter(Boolean);

  if (lines.length > 1) return lines;
  if (!value.trim()) return [];

  return value
    .split(/(?<=[。！？；])/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function StudioSolutionPreview({
  state,
  problem,
  knowledgeTitles,
  insightTitles,
}: {
  state: StudioState;
  problem?: ProblemOption;
  knowledgeTitles: string[];
  insightTitles: string[];
}) {
  const [expanded, setExpanded] = useState(true);
  const meta = getSolutionKindMeta(state.kind);
  const processSteps = splitProcess(state.fullProcess);
  const suitableFor = splitList(state.suitableFor);
  const tradeoffs = splitList(state.tradeoffs);
  const pitfalls = splitList(state.pitfalls);
  const verifiableSteps = splitList(state.verifiableSteps);
  const tags = splitList(state.solutionTags);

  return (
    <article className="overflow-hidden rounded border border-white/10 bg-zinc-950">
      <div className="border-b border-white/10 bg-black/20 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">题目页解法预览</p>
            <p className="mt-1 text-sm font-bold text-zinc-300">{problem ? `${problem.source} · ${problem.title}` : "未选择题目"}</p>
          </div>
          <span className="rounded border border-cyan-400/30 bg-cyan-400/5 px-3 py-1.5 text-xs font-bold text-cyan-200">
            审核通过后的展示样式
          </span>
        </div>
      </div>

      <div className="grid gap-px bg-white/10 lg:grid-cols-[1fr_18rem]">
        <div className="bg-zinc-950 p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-zinc-600">新稿</span>
            <span className={`border px-2.5 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span>
            <span className="text-xs text-zinc-600">{meta.description}</span>
            {tags.length ? tags.map((tag) => (
              <span key={tag} className="border border-white/10 px-2 py-1 text-xs text-zinc-500">
                {tag}
              </span>
            )) : (
              <span className="border border-white/10 px-2 py-1 text-xs text-zinc-600">待补标签</span>
            )}
          </div>
          <h3 className="mt-4 text-xl font-bold text-white">{state.title || "未命名解法"}</h3>
          <p className="mt-2 text-sm text-zinc-500">
            {state.author || "匿名投稿"} <span className="mx-2 text-zinc-700">/</span> {meta.label}
          </p>
          <p className="mt-4 text-sm leading-7 text-zinc-300">
            <MathBlock>{state.inspiration || "这里会展示这条解法最值得学习的观察。"}</MathBlock>
          </p>
        </div>

        <div className="flex flex-col justify-between bg-zinc-950 p-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
              <Lightbulb className="size-4" />
              核心转化
            </div>
            <p className="mt-3 line-clamp-5 text-sm leading-7 text-zinc-400">
              <MathBlock>{state.keyTransform || "这里会展示真正改变问题形态的关键一步。"}</MathBlock>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded border border-cyan-400/35 bg-cyan-400/5 px-4 text-sm font-bold text-cyan-200 transition hover:bg-cyan-400/10"
          >
            {expanded ? "收起解析" : "展开查看"}
            <ChevronDown className={`size-4 transition ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/10 p-5 md:p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
            <div className="space-y-5">
              <section className="rounded border border-cyan-400/20 bg-cyan-400/[0.04] p-4">
                <h4 className="flex items-center gap-2 text-sm font-bold text-white">
                  <Route className="size-4 text-cyan-300" />
                  为什么会想到
                </h4>
                <p className="mt-3 text-sm leading-7 text-zinc-300">
                  <MathBlock>{state.origin || "这里会展示你从题目条件中识别出的入口。"}</MathBlock>
                </p>
              </section>

              <section className="rounded border border-white/10 bg-black/20 p-4">
                <h4 className="flex items-center gap-2 text-sm font-bold text-white">
                  <ListChecks className="size-4 text-amber-300" />
                  完整解析摘要
                </h4>
                {processSteps.length ? (
                  <ol className="mt-4 space-y-4">
                    {processSteps.map((step, index) => (
                      <li key={`${step}-${index}`} className="grid grid-cols-[2rem_1fr] gap-3 text-sm leading-7 text-zinc-300">
                        <span className="font-mono text-cyan-300">{String(index + 1).padStart(2, "0")}</span>
                        <span><MathBlock>{step}</MathBlock></span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-sm leading-7 text-zinc-600">完整步骤会在这里按条展示。</p>
                )}
              </section>

              <section className="rounded border border-white/10 bg-black/20 p-4">
                <h4 className="text-sm font-bold text-white">解法画像</h4>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <PreviewBlock title="迁移价值" tone="amber" value={state.transferValue || "这条观察可以迁移到哪些题型，会显示在这里。"} />
                  <PreviewList title="适合场景" tone="emerald" items={suitableFor} emptyText="考场拿分、复盘训练、课堂讲解" />
                  <PreviewList title="代价与局限" tone="red" items={tradeoffs} emptyText="计算量、入口难度、适用限制会显示在这里" />
                  <PreviewList title="易错点" tone="red" items={pitfalls} emptyText="定义域、分类讨论、取等条件等风险会显示在这里" />
                </div>
              </section>

              {(knowledgeTitles.length > 0 || insightTitles.length > 0) && (
                <section className="rounded border border-white/10 bg-black/20 p-4">
                  <h4 className="text-sm font-bold text-white">本解法用到的思路</h4>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <PreviewChipGroup title="知识点" items={knowledgeTitles} tone="cyan" />
                    <PreviewChipGroup title="思路触发" items={insightTitles} tone="amber" />
                  </div>
                </section>
              )}
            </div>

            <aside className="space-y-5">
              <section className="rounded border border-white/10 bg-black/20">
                <div className="border-b border-white/10 px-4 py-3">
                  <h4 className="text-sm font-bold text-white">评分细节</h4>
                </div>
                <div className="space-y-3 p-4">
                  {scoreLabels.map(([key, label], index) => (
                    <ScoreBar key={key} label={label} value={state.scores[key]} tone={scoreTone(index)} />
                  ))}
                  <p className="pt-2 text-xs leading-6 text-zinc-500">
                    <MathBlock>{state.scoringReason || "评分理由会在这里解释这条解法的取舍。"}</MathBlock>
                  </p>
                </div>
              </section>

              <section className="rounded border border-emerald-400/20 bg-emerald-400/[0.035] p-4">
                <h4 className="text-sm font-bold text-white">可验证步骤</h4>
                {verifiableSteps.length ? (
                  <ul className="mt-3 space-y-2">
                    {verifiableSteps.map((item) => (
                      <li key={item} className="border-l border-emerald-400/40 pl-3 text-xs leading-6 text-zinc-300">
                        <MathBlock>{item}</MathBlock>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs leading-6 text-zinc-600">可代入、作图或数值复核的位置会显示在这里。</p>
                )}
              </section>
            </aside>
          </div>
        </div>
      )}
    </article>
  );
}

function PreviewBlock({ title, value, tone }: { title: string; value: string; tone: "amber" }) {
  const className = tone === "amber" ? "text-amber-300" : "text-zinc-300";
  return (
    <div>
      <h5 className={`text-xs font-bold ${className}`}>{title}</h5>
      <p className="mt-2 text-sm leading-7 text-zinc-300">
        <MathBlock>{value}</MathBlock>
      </p>
    </div>
  );
}

function PreviewList({
  title,
  items,
  emptyText,
  tone,
}: {
  title: string;
  items: string[];
  emptyText: string;
  tone: "emerald" | "red";
}) {
  const titleClass = tone === "emerald" ? "text-emerald-300" : "text-red-300";
  const chipClass = tone === "emerald"
    ? "border-emerald-400/20 bg-emerald-400/5"
    : "border-red-400/20 bg-red-400/5";

  return (
    <div>
      <h5 className={`text-xs font-bold ${titleClass}`}>{title}</h5>
      {items.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item} className={`border px-2.5 py-1.5 text-xs text-zinc-300 ${chipClass}`}>
              <MathBlock>{item}</MathBlock>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm leading-6 text-zinc-600">{emptyText}</p>
      )}
    </div>
  );
}

function PreviewChipGroup({ title, items, tone }: { title: string; items: string[]; tone: "cyan" | "amber" }) {
  const className = tone === "cyan"
    ? "border-cyan-400/20 bg-cyan-400/5 text-cyan-100"
    : "border-amber-400/20 bg-amber-400/5 text-amber-100";

  return (
    <div>
      <h5 className="text-xs font-bold text-zinc-500">{title}</h5>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.slice(0, 8).map((item) => (
          <span key={item} className={`border px-2.5 py-1.5 text-xs ${className}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-bold text-white">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 rounded border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-cyan-400/60"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-bold text-white">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="resize-y rounded border border-white/10 bg-black/20 px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-700 focus:border-cyan-400/60"
      />
    </label>
  );
}

function MatchGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-bold text-zinc-500">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.length ? items.slice(0, 6).map((item) => (
          <span key={item} className="rounded border border-cyan-400/20 bg-cyan-400/5 px-2.5 py-1 text-xs text-cyan-200">
            {item}
          </span>
        )) : (
          <span className="text-xs text-zinc-600">暂无</span>
        )}
      </div>
    </div>
  );
}

function QualityList({ items, emptyText, tone = "amber" }: { items: string[]; emptyText: string; tone?: "amber" | "emerald" }) {
  const itemClass = tone === "emerald"
    ? "border-emerald-400/20 bg-emerald-400/5 text-emerald-200"
    : "border-amber-400/20 bg-amber-400/5 text-amber-200";

  return (
    <div className="mt-3 space-y-2">
      {items.length ? items.slice(0, 3).map((item) => (
        <div key={item} className={`rounded border px-3 py-2 text-xs leading-5 ${itemClass}`}>
          {item}
        </div>
      )) : (
        <p className="text-xs leading-6 text-zinc-600">{emptyText}</p>
      )}
    </div>
  );
}
