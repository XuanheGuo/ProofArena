"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Check, ClipboardCopy, ExternalLink, FileJson2, Gauge, Hammer, MessageSquareText, Sparkles, Tags } from "lucide-react";
import { getInsightNode } from "@/data/insights";
import { getKnowledgeNode } from "@/data/knowledge";
import { matchTagsToKnowledge } from "@/data/tag-matcher";
import { checkSolutionQuality } from "@/lib/quality-checker";
import type { TagMatch } from "@/lib/types";

type StudioState = {
  problemTitle: string;
  source: string;
  number: string;
  difficulty: "B" | "A" | "S";
  problemTags: string;
  statement: string;
  solutionTitle: string;
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
};

const initialState: StudioState = {
  problemTitle: "导数中的双根参数问题",
  source: "2026 天津卷",
  number: "第 20 题",
  difficulty: "S",
  problemTags: "导数、函数不等式、乘积估计",
  statement: "已知 $f(x)=e^x-\\dfrac23\\sin x$，证明相关不等式并求最佳指数。",
  solutionTitle: "差函数导数法 + 望远镜乘积",
  author: "ProofArena Studio",
  solutionTags: "标准解、差函数、导数、望远镜",
  origin: "切线给出了候选下界，后续乘积问题可以逐项放缩。",
  keyTransform: "令 $g(x)=f(x)-1-\\dfrac x3$，再使用 $1+\\dfrac1{3k}\\ge((k+1)/k)^{1/3}$。",
  fullProcess: "1. 求切线。\\n2. 构造差函数并证明非负。\\n3. 逐项代入连乘积。\\n4. 证明更大的指数不可能。",
  inspiration: "第一问的切线往往不是孤立计算，而是后续下界的信号。",
  transferValue: "可迁移到导数切线不等式、连乘积估计和最优常数问题。",
  suitableFor: "考场拿分、标准证明、课堂讲解",
  tradeoffs: "上界证明较长；负区间导数符号需要写细。",
  pitfalls: "只证可行忘记证明最大性；分段单调方向看反。",
  verifiableSteps: "切线斜率；差函数导数符号；望远镜乘积下界。",
  scoringReason: "考场性高，因为主线是常规导数；结构美感较强，因为切线下界与望远镜乘积前后呼应。",
};

const difficultyMap = {
  B: "基础",
  A: "中档",
  S: "压轴",
} as const;

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

export function StudioWorkspace() {
  const [state, setState] = useState<StudioState>(initialState);
  const [copiedTarget, setCopiedTarget] = useState<"json" | "issue" | null>(null);
  const [exportTab, setExportTab] = useState<"json" | "issue">("json");

  const problemTags = useMemo(() => splitList(state.problemTags), [state.problemTags]);
  const solutionTags = useMemo(() => splitList(state.solutionTags), [state.solutionTags]);
  const matches = useMemo(() => {
    const all = [...matchTagsToKnowledge(problemTags), ...matchTagsToKnowledge(solutionTags)];
    const merged = new Map<string, TagMatch>();

    for (const match of all) {
      const current = merged.get(match.tag);
      merged.set(match.tag, current ? {
        ...current,
        matchedKnowledgeIds: unique([...current.matchedKnowledgeIds, ...match.matchedKnowledgeIds]),
        matchedInsightIds: unique([...current.matchedInsightIds, ...match.matchedInsightIds]),
        confidence: Math.max(current.confidence, match.confidence),
      } : match);
    }

    return [...merged.values()];
  }, [problemTags, solutionTags]);

  const knowledgeNodes = useMemo(
    () => unique(matches.flatMap((match) => match.matchedKnowledgeIds)).map(getKnowledgeNode).filter((node): node is NonNullable<ReturnType<typeof getKnowledgeNode>> => Boolean(node)),
    [matches]
  );
  const insightNodes = useMemo(
    () => unique(matches.flatMap((match) => match.matchedInsightIds)).map(getInsightNode).filter((node): node is NonNullable<ReturnType<typeof getInsightNode>> => Boolean(node)),
    [matches]
  );

  const missingFields = [
    ["题目标题", state.problemTitle],
    ["题干", state.statement],
    ["至少一个标签", problemTags.length > 0 || solutionTags.length > 0 ? "ok" : ""],
    ["解法标题", state.solutionTitle],
    ["思路来源", state.origin],
    ["关键转化", state.keyTransform],
    ["完整过程", state.fullProcess],
    ["启发点", state.inspiration],
  ].filter(([, value]) => !value).map(([label]) => label);

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

  const exportJson = useMemo(() => {
    const solutionId = state.solutionTitle
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-|-$/g, "") || "studio-solution";
    const problemId = state.problemTitle
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
      .replace(/^-|-$/g, "") || "studio-problem";

    return {
      id: `studio-${problemId}`,
      title: state.problemTitle,
      source: state.source,
      number: state.number,
      difficultyLabel: state.difficulty,
      difficulty: difficultyMap[state.difficulty],
      tags: problemTags,
      statement: state.statement.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean),
      knowledgeIds: unique(matches.flatMap((match) => match.matchedKnowledgeIds)),
      insightIds: unique(matches.flatMap((match) => match.matchedInsightIds)),
      autoMatches: matches,
      qualityReport,
      solutions: [
        {
          id: solutionId,
          kind: "standard",
          title: state.solutionTitle,
          author: state.author,
          authorRole: "标准解",
          tags: solutionTags,
          badge: "标准解",
          origin: state.origin,
          keyTransform: state.keyTransform,
          inspiration: state.inspiration,
          transferValue: state.transferValue,
          suitableFor: splitList(state.suitableFor),
          tradeoffs: splitList(state.tradeoffs),
          limitations: splitList(state.pitfalls),
          scoringReason: state.scoringReason,
          summary: state.fullProcess.split(/\n+/).map((item) => item.trim()).filter(Boolean),
          verificationDraft: splitList(state.verifiableSteps),
          knowledgeIds: unique(matches.flatMap((match) => match.matchedKnowledgeIds)),
          insightIds: unique(matches.flatMap((match) => match.matchedInsightIds)),
          autoMatches: matches,
        },
      ],
    };
  }, [matches, problemTags, qualityReport, solutionTags, state]);

  const jsonPreview = useMemo(() => JSON.stringify(exportJson, null, 2), [exportJson]);
  const issueMarkdown = useMemo(() => {
    return `# 解法投稿：${state.problemTitle || "未命名题目"}

## 题目来源
${state.source || "（请填写来源）"}${state.number ? ` · ${state.number}` : ""}

## 题目标题
${state.problemTitle || "（请填写题目标题）"}

## 题干
${state.statement || "（请填写题干）"}

## 标签
${[...problemTags, ...solutionTags].length ? [...problemTags, ...solutionTags].map((tag) => `- ${tag}`).join("\n") : "（请填写标签）"}

## 解法标题
${state.solutionTitle || "（请填写解法标题）"}

## 作者
${state.author || "（请填写作者）"}

## 思路来源
${state.origin || "（请填写思路来源）"}

## 关键转化
${state.keyTransform || "（请填写关键转化）"}

## 完整过程
${state.fullProcess || "（请填写完整过程）"}

## 启发点
${state.inspiration || "（请填写启发点）"}

## 迁移价值
${state.transferValue || "（请填写迁移价值）"}

## 适用场景
${splitList(state.suitableFor).length ? splitList(state.suitableFor).map((item) => `- ${item}`).join("\n") : "（请填写适用场景）"}

## 代价与局限
${splitList(state.tradeoffs).length ? splitList(state.tradeoffs).map((item) => `- ${item}`).join("\n") : "（请填写代价与局限）"}

## 易错点
${splitList(state.pitfalls).length ? splitList(state.pitfalls).map((item) => `- ${item}`).join("\n") : "（请填写易错点）"}

## 可验证步骤
${splitList(state.verifiableSteps).length ? splitList(state.verifiableSteps).map((item) => `- ${item}`).join("\n") : "（请填写可验证步骤）"}
`;
  }, [problemTags, solutionTags, state]);

  function updateField<K extends keyof StudioState>(key: K, value: StudioState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function fallbackCopy(value: string) {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const copiedResult = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copiedResult;
  }

  async function copyText(value: string, target: "json" | "issue") {
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
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-12">
      <div className="grid gap-6 xl:grid-cols-[1fr_.9fr]">
        <div className="space-y-6">
          <StudioSection title="题目信息" label="题目录入">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="题目标题" value={state.problemTitle} onChange={(value) => updateField("problemTitle", value)} />
              <TextField label="来源" value={state.source} onChange={(value) => updateField("source", value)} placeholder="例如 2026 天津卷" />
              <TextField label="题号" value={state.number} onChange={(value) => updateField("number", value)} />
              <label className="grid gap-2 text-sm">
                <span className="font-bold text-zinc-300">难度</span>
                <select
                  value={state.difficulty}
                  onChange={(event) => updateField("difficulty", event.target.value as StudioState["difficulty"])}
                  className="h-11 border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-cyan-400/60"
                >
                  <option value="B">B · 基础</option>
                  <option value="A">A · 中档</option>
                  <option value="S">S · 压轴</option>
                </select>
              </label>
              <TextField className="md:col-span-2" label="标签输入" value={state.problemTags} onChange={(value) => updateField("problemTags", value)} placeholder="导数、零点、参数、双根" />
              <TextArea className="md:col-span-2" label="题干 Markdown / LaTeX" value={state.statement} onChange={(value) => updateField("statement", value)} rows={6} />
            </div>
          </StudioSection>

          <StudioSection title="解法信息" label="解法整理">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField label="解法标题" value={state.solutionTitle} onChange={(value) => updateField("solutionTitle", value)} />
              <TextField label="作者" value={state.author} onChange={(value) => updateField("author", value)} />
              <TextField className="md:col-span-2" label="解法类型标签" value={state.solutionTags} onChange={(value) => updateField("solutionTags", value)} />
              <TextArea label="思路来源" value={state.origin} onChange={(value) => updateField("origin", value)} rows={4} />
              <TextArea label="关键转化" value={state.keyTransform} onChange={(value) => updateField("keyTransform", value)} rows={4} />
              <TextArea className="md:col-span-2" label="完整过程" value={state.fullProcess} onChange={(value) => updateField("fullProcess", value)} rows={6} />
              <TextArea label="启发点" value={state.inspiration} onChange={(value) => updateField("inspiration", value)} rows={4} />
              <TextArea label="迁移价值" value={state.transferValue} onChange={(value) => updateField("transferValue", value)} rows={4} />
              <TextArea label="适用场景" value={state.suitableFor} onChange={(value) => updateField("suitableFor", value)} rows={3} />
              <TextArea label="代价与局限" value={state.tradeoffs} onChange={(value) => updateField("tradeoffs", value)} rows={3} />
              <TextArea label="易错点" value={state.pitfalls} onChange={(value) => updateField("pitfalls", value)} rows={3} />
              <TextArea label="可验证步骤" value={state.verifiableSteps} onChange={(value) => updateField("verifiableSteps", value)} rows={3} />
              <TextArea className="md:col-span-2" label="评分理由" value={state.scoringReason} onChange={(value) => updateField("scoringReason", value)} rows={3} />
            </div>
          </StudioSection>
        </div>

        <aside className="space-y-6">
          <StudioSection title="内容质量检查" label="收录检查">
            <div className="border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Gauge className="size-4 text-cyan-300" />
                  总完整度
                </div>
                <strong className="font-display text-3xl font-black text-cyan-300">{qualityReport.completenessScore}</strong>
              </div>
              <div className="mt-4 h-2 bg-white/10">
                <div className="h-full bg-cyan-400" style={{ width: `${qualityReport.completenessScore}%` }} />
              </div>
              <p className="mt-3 text-xs leading-6 text-zinc-500">
                这个分数只检查结构完整度，不代表数学正确性；正式收录仍需要人工审核。
              </p>
            </div>

            <QualityList title="缺失字段" tone="red" items={qualityReport.missingFields} emptyText="暂无缺失字段" />
            <QualityList title="改进建议" tone="amber" items={qualityReport.suggestions} emptyText="暂无改进建议" />
            <QualityList title="当前亮点" tone="emerald" items={qualityReport.strengths} emptyText="暂未识别到亮点" />
          </StudioSection>

          <StudioSection title="自动匹配与导出" label="Matcher / JSON">
            <div className={missingFields.length ? "border border-amber-400/25 bg-amber-400/5 p-4" : "border border-emerald-400/25 bg-emerald-400/5 p-4"}>
              <div className="flex items-center gap-2 text-sm font-bold text-white">
                {missingFields.length ? <AlertTriangle className="size-4 text-amber-300" /> : <Check className="size-4 text-emerald-300" />}
                内容完整度检查
              </div>
              <p className="mt-2 text-xs leading-6 text-zinc-500">
                {missingFields.length ? `还缺：${missingFields.join("、")}` : "关键字段已齐，可以进入人工审核。"}
              </p>
            </div>

            <div className="grid gap-4">
              <MatchGroup title="自动匹配的知识点" tone="cyan" items={knowledgeNodes.map((node) => node.title)} />
              <MatchGroup title="自动匹配的思路触发器" tone="amber" items={insightNodes.map((node) => node.title)} />
              <div className="border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-zinc-400">
                  <Tags className="size-4" />
                  匹配来源与置信度
                </div>
                <div className="mt-3 space-y-2">
                  {matches.length ? matches.map((match) => (
                    <div key={match.tag} className="flex items-center justify-between gap-3 border border-white/10 px-3 py-2 text-xs">
                      <span className="text-zinc-300">#{match.tag}</span>
                      <span className="font-mono text-cyan-300">{match.source === "auto" ? "自动" : "手动"} · {confidenceLabel(match.confidence)}</span>
                    </div>
                  )) : (
                    <p className="text-xs leading-6 text-zinc-600">暂无匹配。试试输入“导数、圆锥曲线、数列、分块求和”等标签。</p>
                  )}
                </div>
              </div>
            </div>

            <div className="border border-white/10 bg-black/20">
              <div className="border-b border-white/10 p-3">
                <div className="flex gap-2 overflow-x-auto">
                  {[
                    ["json", FileJson2, "JSON 导出"],
                    ["issue", MessageSquareText, "GitHub Issue 投稿"],
                  ].map(([value, Icon, label]) => {
                    const TabIcon = Icon as typeof FileJson2;
                    const active = exportTab === value;
                    return (
                      <button
                        key={value as string}
                        type="button"
                        onClick={() => setExportTab(value as typeof exportTab)}
                        className={`inline-flex h-10 shrink-0 items-center gap-2 border px-3 text-xs font-bold transition ${
                          active
                            ? "border-cyan-400 bg-cyan-400 text-zinc-950"
                            : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-white"
                        }`}
                      >
                        <TabIcon className="size-3.5" />
                        {label as string}
                      </button>
                    );
                  })}
                </div>
              </div>
              {exportTab === "json" ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                      <FileJson2 className="size-4 text-cyan-300" />
                      结构化 JSON 预览
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText(jsonPreview, "json")}
                      className="inline-flex h-9 items-center gap-2 border border-white/10 px-3 text-xs font-bold text-zinc-300 transition hover:border-cyan-400/40 hover:text-cyan-200"
                    >
                      {copiedTarget === "json" ? <Check className="size-3.5 text-emerald-300" /> : <ClipboardCopy className="size-3.5" />}
                      {copiedTarget === "json" ? "已复制 JSON" : "复制 JSON"}
                    </button>
                  </div>
                  <pre className="math-scroll max-h-[34rem] p-4 text-xs leading-6 text-zinc-300">
                    <code>{jsonPreview}</code>
                  </pre>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-zinc-300">
                      <MessageSquareText className="size-4 text-amber-300" />
                      GitHub Issue Markdown
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => copyText(issueMarkdown, "issue")}
                        className="inline-flex h-9 items-center gap-2 border border-white/10 px-3 text-xs font-bold text-zinc-300 transition hover:border-amber-400/40 hover:text-amber-200"
                      >
                        {copiedTarget === "issue" ? <Check className="size-3.5 text-emerald-300" /> : <ClipboardCopy className="size-3.5" />}
                        {copiedTarget === "issue" ? "已复制 Issue Markdown" : "复制 Issue Markdown"}
                      </button>
                      <a
                        href="https://github.com/XuanheGuo/ProofArena/issues"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center gap-2 bg-cyan-400 px-3 text-xs font-bold text-zinc-950 transition hover:bg-cyan-300"
                      >
                        打开 GitHub Issues
                        <ExternalLink className="size-3.5" />
                      </a>
                    </div>
                  </div>
                  <pre className="math-scroll max-h-[34rem] p-4 text-xs leading-6 text-zinc-300">
                    <code>{issueMarkdown}</code>
                  </pre>
                </>
              )}
            </div>
          </StudioSection>
        </aside>
      </div>
    </div>
  );
}

function StudioSection({ title, label, children }: { title: string; label: string; children: ReactNode }) {
  return (
    <section className="border border-white/10 bg-zinc-950">
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
        <span className="grid size-9 place-items-center bg-cyan-400 text-zinc-950">
          <Hammer className="size-5" />
        </span>
        <div>
          <h2 className="font-bold text-white">{title}</h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-zinc-600">{label}</p>
        </div>
      </div>
      <div className="p-5 md:p-6">{children}</div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className={`grid gap-2 text-sm ${className}`}>
      <span className="font-bold text-zinc-300">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 border border-white/10 bg-black/20 px-3 text-sm text-white outline-none transition placeholder:text-zinc-700 focus:border-cyan-400/60"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  className?: string;
}) {
  return (
    <label className={`grid gap-2 text-sm ${className}`}>
      <span className="font-bold text-zinc-300">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="resize-y border border-white/10 bg-black/20 px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-700 focus:border-cyan-400/60"
      />
    </label>
  );
}

function MatchGroup({ title, items, tone }: { title: string; items: string[]; tone: "cyan" | "amber" }) {
  const toneClass = tone === "cyan" ? "border-cyan-400/20 bg-cyan-400/5 text-cyan-200" : "border-amber-400/20 bg-amber-400/5 text-amber-200";

  return (
    <div className="border border-white/10 bg-black/20 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold text-zinc-400">
        <Sparkles className="size-4" />
        {title}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.length ? items.map((item) => (
          <span key={item} className={`border px-2.5 py-1.5 text-xs ${toneClass}`}>
            {item}
          </span>
        )) : (
          <span className="text-xs leading-6 text-zinc-600">暂无匹配</span>
        )}
      </div>
    </div>
  );
}

function QualityList({
  title,
  items,
  tone,
  emptyText,
}: {
  title: string;
  items: string[];
  tone: "red" | "amber" | "emerald";
  emptyText: string;
}) {
  const toneClass = {
    red: "border-red-400/20 bg-red-400/5 text-red-200",
    amber: "border-amber-400/20 bg-amber-400/5 text-amber-200",
    emerald: "border-emerald-400/20 bg-emerald-400/5 text-emerald-200",
  }[tone];

  return (
    <div className="mt-4 border border-white/10 bg-black/20 p-4">
      <h3 className="text-xs font-bold text-zinc-400">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.length ? items.map((item) => (
          <div key={item} className={`border px-3 py-2 text-xs leading-5 ${toneClass}`}>
            {item}
          </div>
        )) : (
          <p className="text-xs leading-6 text-zinc-600">{emptyText}</p>
        )}
      </div>
    </div>
  );
}
