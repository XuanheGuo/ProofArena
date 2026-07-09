"use client";

import { useState } from "react";
import {
  ChevronDown,
  KeyRound,
  Lightbulb,
  ListChecks,
  Route,
} from "lucide-react";
import { MathBlock } from "@/components/MathBlock";
import { ScoreBar } from "@/components/ScoreBar";
import { contestSolutionTypeMeta } from "@/lib/contest-meta";
import { getSolutionKindMeta } from "@/lib/solution-kinds";
import {
  answerKeyToText,
  answerTypeLabels,
  scoreLabels,
  splitList,
  splitProcess,
  type ContestProblemAnswerHint,
  type ReviewForm,
  type Submission,
} from "./model";

function scoreTone(index: number) {
  return index === 1 ? "red" : index === 2 ? "amber" : "cyan";
}

function renderContestValue(value: unknown) {
  if (value == null || value === "") return null;
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item)).filter(Boolean);
    if (items.length === 0) return null;
    return (
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li
            key={`${item}-${index}`}
            className="border-l border-cyan-400/30 pl-3 text-sm leading-7 text-zinc-300"
          >
            <MathBlock>{item}</MathBlock>
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    return (
      <pre className="overflow-auto border border-white/10 bg-black/20 p-3 text-xs leading-6 text-zinc-400">
        <code>{JSON.stringify(value, null, 2)}</code>
      </pre>
    );
  }
  return (
    <div className="text-sm leading-7 text-zinc-300">
      <MathBlock>{String(value)}</MathBlock>
    </div>
  );
}

export function StandardAnswerHintPanel({
  hint,
  compact = false,
}: {
  hint?: ContestProblemAnswerHint;
  compact?: boolean;
}) {
  if (!hint) {
    return (
      <section className="border border-amber-400/25 bg-amber-400/[0.055] p-3">
        <div className="flex items-center gap-2 text-sm font-bold text-amber-200">
          <KeyRound className="size-4" />
          标准答案未载入
        </div>
        <p className="mt-2 text-xs leading-5 text-zinc-500">
          未找到这条投稿对应的赛题答案。可以检查 contest_problem_key
          或赛题绑定。
        </p>
      </section>
    );
  }

  const answerKeyText = answerKeyToText(hint.answerKey);

  return (
    <section className="border border-emerald-400/25 bg-emerald-400/[0.045] p-3 sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-200">
          <KeyRound className="size-4" />
          标准答案指示
        </span>
        {hint.answerType && (
          <span className="border border-emerald-400/25 px-2 py-0.5 text-[11px] font-bold text-emerald-200">
            {answerTypeLabels[hint.answerType]}
          </span>
        )}
      </div>

      <p className="mt-2 text-xs leading-5 text-zinc-500">
        {hint.contestProblemTitle}
      </p>

      {answerKeyText && (
        <div className="mt-3 border border-white/10 bg-zinc-950/70 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            答案 key
          </p>
          <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-6 text-emerald-100">
            {answerKeyText}
          </pre>
          {hint.answerFormatNote && (
            <p className="mt-2 text-xs leading-5 text-zinc-500">
              {hint.answerFormatNote}
            </p>
          )}
        </div>
      )}

      {hint.referenceAnswer && (
        <div className="mt-3 border border-white/10 bg-black/20 p-3">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-500">
            参考解析
          </p>
          <div
            className={`${compact ? "max-h-44" : "max-h-72"} overflow-auto pr-1 text-sm leading-7 text-zinc-300`}
          >
            <MathBlock>{hint.referenceAnswer}</MathBlock>
          </div>
        </div>
      )}

      {!answerKeyText && !hint.referenceAnswer && (
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          这道赛题还没有配置可展示的答案 key 或参考解析。
        </p>
      )}
    </section>
  );
}

export function ContestSubmissionReviewPreview({
  submission,
  answerHint,
}: {
  submission: Submission;
  answerHint?: ContestProblemAnswerHint;
}) {
  const solution = submission.content.json?.solution ?? {};
  const rawSections: Array<[string, unknown]> = [
    [
      "我的思路",
      submission.content.thought ??
        submission.content.approach ??
        solution.origin,
    ],
    ["关键转化", submission.content.keyTransform ?? solution.keyTransform],
    ["完整过程", submission.content.steps ?? solution.process],
    ["启发点", submission.content.insight ?? solution.inspiration],
    ["可验证位置", submission.content.verification ?? solution.verifiableSteps],
  ];
  const sections = rawSections.filter(
    ([, value]) => value != null && value !== "",
  );
  const rawMarkdown =
    typeof submission.content.markdown === "string"
      ? submission.content.markdown
      : "";

  return (
    <div className="space-y-5">
      <section className="border border-amber-400/25 bg-amber-400/[0.055] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="border border-amber-400/30 px-2.5 py-1 text-xs font-bold text-amber-200">
            {submission.contest_slug}
          </span>
          {submission.contest_solution_type && (
            <span className="border border-cyan-400/25 px-2.5 py-1 text-xs font-bold text-cyan-200">
              {contestSolutionTypeMeta[submission.contest_solution_type]
                ?.label ?? submission.contest_solution_type}
            </span>
          )}
          {submission.is_post_contest && (
            <span className="border border-white/10 px-2.5 py-1 text-xs font-bold text-zinc-400">
              赛后补充
            </span>
          )}
        </div>
        <h3 className="mt-4 text-xl font-black text-white">
          {submission.title || "未命名比赛投稿"}
        </h3>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          {submission.problem_source ??
            submission.problem_id ??
            submission.draft_problem_id ??
            "未绑定题目"}
          {submission.contest_problem_key
            ? ` · 赛题 ${submission.contest_problem_key}`
            : ""}
        </p>
      </section>

      <StandardAnswerHintPanel hint={answerHint} />

      {sections.length > 0 ? (
        <div className="space-y-4">
          {sections.map(([label, value]) => (
            <section
              key={label}
              className="border border-white/10 bg-black/20 p-4"
            >
              <h4 className="mb-3 text-sm font-bold text-white">{label}</h4>
              {renderContestValue(value)}
            </section>
          ))}
        </div>
      ) : rawMarkdown ? (
        <section className="border border-white/10 bg-black/20 p-4">
          <h4 className="mb-3 text-sm font-bold text-white">原始投稿</h4>
          <div className="text-sm leading-7 text-zinc-300">
            <MathBlock>{rawMarkdown}</MathBlock>
          </div>
        </section>
      ) : (
        <section className="border border-white/10 bg-black/20 p-8 text-center text-sm text-zinc-500">
          这条比赛投稿没有可展示的文本内容。
        </section>
      )}

      {submission.attachment_urls && submission.attachment_urls.length > 0 && (
        <section className="border border-white/10 bg-black/20 p-4">
          <h4 className="text-sm font-bold text-white">投稿图片</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {submission.attachment_urls.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden border border-white/10 bg-zinc-950"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt="投稿图片"
                  className="max-h-96 w-full object-contain"
                />
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function ReviewCardPreview({
  submission,
  form,
}: {
  submission: Submission;
  form: ReviewForm;
}) {
  const [expanded, setExpanded] = useState(true);
  const meta = getSolutionKindMeta(form.kind);
  const tags = splitList(form.tags);
  const processSteps = splitProcess(form.process);
  const suitableFor = splitList(form.suitableFor);
  const tradeoffs = splitList(form.tradeoffs);
  const pitfalls = splitList(form.pitfalls);
  const verifiableSteps = splitList(form.verifiableSteps);
  const target = submission.problem_source
    ? `${submission.problem_source}${submission.problem_id ? ` · ${submission.problem_id}` : submission.draft_problem_id ? ` · ${submission.draft_problem_id} [未公开]` : ""}`
    : submission.draft_problem_id
      ? `未公开题目 · ${submission.draft_problem_id}`
      : (submission.problem_id ?? "未绑定题目");

  return (
    <article className="overflow-hidden border border-white/10 bg-zinc-950">
      <div className="border-b border-white/10 bg-black/20 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              审核真实卡片预览
            </p>
            <p className="mt-1 text-sm font-bold text-zinc-300">{target}</p>
          </div>
          <span className="border border-cyan-400/30 bg-cyan-400/5 px-3 py-1.5 text-xs font-bold text-cyan-200">
            按当前编辑内容实时渲染
          </span>
        </div>
      </div>

      <div className="grid gap-px bg-white/10 lg:grid-cols-[1fr_18rem]">
        <div className="bg-zinc-950 p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-zinc-600">审核稿</span>
            <span
              className={`border px-2.5 py-1 text-xs font-bold ${meta.className}`}
            >
              {meta.label}
            </span>
            <span className="text-xs text-zinc-600">{meta.description}</span>
            {tags.length ? (
              tags.map((tag) => (
                <span
                  key={tag}
                  className="border border-white/10 px-2 py-1 text-xs text-zinc-500"
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="border border-white/10 px-2 py-1 text-xs text-zinc-600">
                待补标签
              </span>
            )}
          </div>
          <h3 className="mt-4 text-xl font-bold text-white">
            {form.title || "未命名解法"}
          </h3>
          <p className="mt-2 text-sm text-zinc-500">
            投稿内容 <span className="mx-2 text-zinc-700">/</span> {meta.label}
          </p>
          {form.challengeTargetSolutionId && (
            <div className="mt-4 border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2">
              <p className="text-xs font-bold text-amber-200">
                挑战{" "}
                {form.challengeTargetSolutionTitle ||
                  form.challengeTargetSolutionId}
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-400">
                {form.challengeClaim || "待补一句话优势"}
              </p>
            </div>
          )}
          <p className="mt-4 text-sm leading-7 text-zinc-300">
            <MathBlock>
              {form.inspiration || "这里会展示这条解法最值得学习的观察。"}
            </MathBlock>
          </p>
        </div>

        <div className="flex flex-col justify-between bg-zinc-950 p-5">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
              <Lightbulb className="size-4" />
              核心转化
            </div>
            <p className="mt-3 line-clamp-5 text-sm leading-7 text-zinc-400">
              <MathBlock>
                {form.keyTransform || "这里会展示真正改变问题形态的关键一步。"}
              </MathBlock>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="mt-5 inline-flex h-10 items-center justify-center gap-2 border border-cyan-400/35 bg-cyan-400/5 px-4 text-sm font-bold text-cyan-200 transition hover:bg-cyan-400/10"
          >
            {expanded ? "收起解析" : "展开查看"}
            <ChevronDown
              className={`size-4 transition ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/10 p-5 md:p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_18rem]">
            <div className="space-y-5">
              <section className="border border-cyan-400/20 bg-cyan-400/[0.04] p-4">
                <h4 className="flex items-center gap-2 text-sm font-bold text-white">
                  <Route className="size-4 text-cyan-300" />
                  为什么会想到
                </h4>
                <p className="mt-3 text-sm leading-7 text-zinc-300">
                  <MathBlock>
                    {form.origin || "这里会展示你从题目条件中识别出的入口。"}
                  </MathBlock>
                </p>
              </section>

              <section className="border border-white/10 bg-black/20 p-4">
                <h4 className="flex items-center gap-2 text-sm font-bold text-white">
                  <ListChecks className="size-4 text-amber-300" />
                  完整解析摘要
                </h4>
                {processSteps.length ? (
                  <ol className="mt-4 space-y-4">
                    {processSteps.map((step, index) => (
                      <li
                        key={`${step}-${index}`}
                        className="grid grid-cols-[2rem_1fr] gap-3 text-sm leading-7 text-zinc-300"
                      >
                        <span className="font-mono text-cyan-300">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span>
                          <MathBlock>{step}</MathBlock>
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-sm leading-7 text-zinc-600">
                    完整步骤会在这里按条展示。
                  </p>
                )}
              </section>

              <section className="border border-white/10 bg-black/20 p-4">
                <h4 className="text-sm font-bold text-white">解法画像</h4>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <ReviewPreviewBlock
                    title="迁移价值"
                    value={
                      form.transferValue ||
                      "这条观察可以迁移到哪些题型，会显示在这里。"
                    }
                  />
                  <ReviewPreviewList
                    title="适合场景"
                    tone="emerald"
                    items={suitableFor}
                    emptyText="考场拿分、复盘训练、课堂讲解"
                  />
                  <ReviewPreviewList
                    title="代价与局限"
                    tone="red"
                    items={tradeoffs}
                    emptyText="计算量、入口难度、适用限制会显示在这里"
                  />
                  <ReviewPreviewList
                    title="易错点"
                    tone="red"
                    items={pitfalls}
                    emptyText="定义域、分类讨论、取等条件等风险会显示在这里"
                  />
                </div>
              </section>

              {form.moderatorNotes.trim() && (
                <section className="border border-amber-400/20 bg-amber-400/[0.04] p-4">
                  <h4 className="text-sm font-bold text-white">审核评语</h4>
                  <p className="mt-3 text-sm leading-7 text-zinc-300">
                    <MathBlock>{form.moderatorNotes}</MathBlock>
                  </p>
                </section>
              )}
            </div>

            <aside className="space-y-5">
              <section className="border border-white/10 bg-black/20">
                <div className="border-b border-white/10 px-4 py-3">
                  <h4 className="text-sm font-bold text-white">评分细节</h4>
                </div>
                <div className="space-y-3 p-4">
                  {scoreLabels.map(([key, label], index) => (
                    <ScoreBar
                      key={key}
                      label={label}
                      value={form.scores[key]}
                      tone={scoreTone(index)}
                    />
                  ))}
                  <p className="pt-2 text-xs leading-6 text-zinc-500">
                    <MathBlock>
                      {form.scoringReason ||
                        "评分理由会在这里解释这条解法的取舍。"}
                    </MathBlock>
                  </p>
                </div>
              </section>

              <section className="border border-emerald-400/20 bg-emerald-400/[0.035] p-4">
                <h4 className="text-sm font-bold text-white">可验证步骤</h4>
                {verifiableSteps.length ? (
                  <ul className="mt-3 space-y-2">
                    {verifiableSteps.map((item) => (
                      <li
                        key={item}
                        className="border-l border-emerald-400/40 pl-3 text-xs leading-6 text-zinc-300"
                      >
                        <MathBlock>{item}</MathBlock>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-xs leading-6 text-zinc-600">
                    可代入、作图或数值复核的位置会显示在这里。
                  </p>
                )}
              </section>
            </aside>
          </div>
        </div>
      )}
    </article>
  );
}

function ReviewPreviewBlock({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div>
      <h5 className="text-xs font-bold text-amber-300">{title}</h5>
      <p className="mt-2 text-sm leading-7 text-zinc-300">
        <MathBlock>{value}</MathBlock>
      </p>
    </div>
  );
}

function ReviewPreviewList({
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
  const chipClass =
    tone === "emerald"
      ? "border-emerald-400/20 bg-emerald-400/5"
      : "border-red-400/20 bg-red-400/5";

  return (
    <div>
      <h5 className={`text-xs font-bold ${titleClass}`}>{title}</h5>
      {items.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className={`border px-2.5 py-1.5 text-xs text-zinc-300 ${chipClass}`}
            >
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
