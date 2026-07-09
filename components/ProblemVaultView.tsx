"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Archive,
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  ListChecks,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { promoteProblemDraft } from "@/lib/promote-problem-draft";
import { contestProblemPhaseMeta } from "@/lib/contest-meta";
import { MathBlock } from "@/components/MathBlock";
import { MathPreviewTextArea } from "@/components/MathPreviewTextArea";
import type { ContestProblemPhase } from "@/lib/types";

type DraftStatus = "drafting" | "promoted";

type LearningGuideData = {
  observation?: string[];
  triggers?: string[];
  pitfalls?: string[];
  readingPath?: string[];
  recommendation?: string;
};

export interface ProblemDraft {
  id: string;
  title: string;
  year: number;
  region: string;
  paper: string;
  number: string;
  difficulty: string;
  question_type: string;
  tags: string[];
  statement: string[];
  answer: string;
  source_pdf: string | null;
  source_page: number | null;
  answer_pdf: string | null;
  learning_guide: LearningGuideData | null;
  notes: string;
  status: DraftStatus;
  promoted_problem_id: string | null;
  created_at: string;
  updated_at: string;
}

// One contest_problems row that points at a draft via draft_problem_id.
// hasAnswerKey is existence-only — the server page never selects answer_key
// content, so the key itself can never end up serialized into this page.
export interface DraftContestRef {
  contestProblemId: string;
  draftId: string;
  contestSlug: string;
  contestTitle: string;
  dayIndex: number;
  phase: string;
  slotTitle: string;
  answerType: string | null;
  timedModeEnabled: boolean;
  hasAnswerKey: boolean;
}

export interface ContestAuditOption {
  slug: string;
  title: string;
}

type StatusFilter = "all" | "drafting" | "promoted";

type DraftEditForm = {
  title: string;
  paper: string;
  number: string;
  difficulty: string;
  question_type: string;
  tags: string;
  statement: string;
  answer: string;
  notes: string;
};

type WeeklyAuditItem = {
  draft: ProblemDraft;
  ref: DraftContestRef | null;
  phase: string;
  dayIndex: number;
  slotTitle: string;
  issues: string[];
};

type ContestAuditData = {
  contest: ContestAuditOption | null;
  draftPrefix: string | null;
  total: number;
  bound: number;
  issueCount: number;
  sprintTotal: number;
  sprintReady: number;
  grouped: Map<string, WeeklyAuditItem[]>;
};

const ANSWER_TYPE_LABELS: Record<string, string> = {
  single_choice: "单选",
  multiple_choice: "多选",
  fill_blank: "填空",
};

function phaseMeta(phase: string) {
  return (
    contestProblemPhaseMeta[phase as ContestProblemPhase] ?? {
      label: phase,
      className: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
    }
  );
}

function draftSourceLabel(
  draft: Pick<ProblemDraft, "year" | "region" | "paper" | "number">,
) {
  return [
    draft.region,
    draft.paper,
    draft.number,
    draft.year ? String(draft.year) : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function draftWarnings(draft: ProblemDraft): string[] {
  const warnings: string[] = [];
  if (
    !draft.statement ||
    draft.statement.filter((line) => line.trim()).length === 0
  )
    warnings.push("缺题干");
  if (!draft.answer?.trim()) warnings.push("缺答案");
  if (!draft.source_pdf?.trim()) warnings.push("缺来源 PDF");
  return warnings;
}

function isSprintRef(ref: DraftContestRef) {
  return ref.phase === "sprint" || ref.timedModeEnabled;
}

function buildEditForm(draft: ProblemDraft): DraftEditForm {
  return {
    title: draft.title,
    paper: draft.paper,
    number: draft.number,
    difficulty: draft.difficulty,
    question_type: draft.question_type,
    tags: (draft.tags ?? []).join("，"),
    statement: (draft.statement ?? []).join("\n\n"),
    answer: draft.answer ?? "",
    notes: draft.notes ?? "",
  };
}

const LEARNING_GUIDE_SECTIONS: Array<{
  key: keyof LearningGuideData;
  label: string;
}> = [
  { key: "observation", label: "观察" },
  { key: "triggers", label: "触发条件" },
  { key: "pitfalls", label: "易错点" },
  { key: "readingPath", label: "阅读路径" },
];

const WEEKLY_PHASE_ORDER = ["daily", "sprint", "challenge", "major"];

function weeklyPhaseSortKey(phase: string) {
  const index = WEEKLY_PHASE_ORDER.indexOf(phase);
  return index === -1 ? WEEKLY_PHASE_ORDER.length : index;
}

function contestDraftPrefix(slug: string) {
  const weekly = slug.match(/^weekly-arena-(\d+)$/);
  if (weekly) return `pa-weekly${weekly[1]}-`;
  return null;
}

function contestDraftSortKey(id: string) {
  const match = id.match(/^pa-weekly\d+-([dscm])(\d+)$/);
  if (!match) return id;
  const groupRank: Record<string, string> = { d: "1", s: "2", c: "3", m: "4" };
  return `${groupRank[match[1]] ?? "9"}-${match[2].padStart(2, "0")}`;
}

export function ProblemVaultView({
  initialDrafts,
  contestRefs,
  contests,
}: {
  initialDrafts: ProblemDraft[];
  contestRefs: DraftContestRef[];
  contests: ContestAuditOption[];
}) {
  const contestOptions = useMemo(() => {
    const map = new Map<string, ContestAuditOption>();
    for (const contest of contests) {
      if (contest.slug) map.set(contest.slug, contest);
    }
    for (const ref of contestRefs) {
      if (ref.contestSlug && !map.has(ref.contestSlug)) {
        map.set(ref.contestSlug, {
          slug: ref.contestSlug,
          title: ref.contestTitle || ref.contestSlug,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.slug.localeCompare(a.slug));
  }, [contestRefs, contests]);
  const [auditContestSlug, setAuditContestSlug] = useState<string>(
    contestOptions.find((contest) => contest.slug.startsWith("weekly-arena-"))
      ?.slug ??
      contestOptions[0]?.slug ??
      "",
  );
  const [drafts, setDrafts] = useState<ProblemDraft[]>(initialDrafts);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialDrafts.find((d) => d.status === "drafting")?.id ??
      initialDrafts[0]?.id ??
      null,
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [editForm, setEditForm] = useState<DraftEditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refsByDraft = useMemo(() => {
    const map = new Map<string, DraftContestRef[]>();
    for (const ref of contestRefs) {
      if (!map.has(ref.draftId)) map.set(ref.draftId, []);
      map.get(ref.draftId)!.push(ref);
    }
    return map;
  }, [contestRefs]);

  const filteredDrafts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return drafts
      .filter((draft) => {
        if (statusFilter !== "all" && draft.status !== statusFilter)
          return false;
        if (!query) return true;
        const haystack = [
          draft.title,
          draft.paper,
          draft.id,
          ...(draft.tags ?? []),
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        // drafting 排在 promoted 前面，同状态按创建时间倒序
        if (a.status !== b.status) return a.status === "drafting" ? -1 : 1;
        return b.created_at.localeCompare(a.created_at);
      });
  }, [drafts, statusFilter, search]);

  const selected = drafts.find((draft) => draft.id === selectedId) ?? null;
  const selectedRefs = selected ? (refsByDraft.get(selected.id) ?? []) : [];
  const selectedAuditContest =
    contestOptions.find((contest) => contest.slug === auditContestSlug) ?? null;
  const isAuditContestBound = Boolean(
    auditContestSlug &&
    selectedRefs.some((ref) => ref.contestSlug === auditContestSlug),
  );

  const contestAudit = useMemo<ContestAuditData>(() => {
    const contest =
      contestOptions.find((option) => option.slug === auditContestSlug) ?? null;
    if (!contest) {
      return {
        contest: null,
        draftPrefix: null,
        total: 0,
        bound: 0,
        issueCount: 0,
        sprintTotal: 0,
        sprintReady: 0,
        grouped: new Map(),
      };
    }

    const draftPrefix = contestDraftPrefix(contest.slug);
    const contestSpecificRefs = contestRefs.filter(
      (ref) => ref.contestSlug === contest.slug,
    );
    const contestRefByDraft = new Map(
      contestSpecificRefs.map((ref) => [ref.draftId, ref]),
    );
    const contestDrafts = drafts
      .filter(
        (draft) =>
          (draftPrefix ? draft.id.startsWith(draftPrefix) : false) ||
          contestRefByDraft.has(draft.id),
      )
      .sort((a, b) =>
        contestDraftSortKey(a.id).localeCompare(contestDraftSortKey(b.id)),
      );

    const items: WeeklyAuditItem[] = contestDrafts.map((draft) => {
      const ref = contestRefByDraft.get(draft.id) ?? null;
      const issues = [...draftWarnings(draft)];
      if (!ref) issues.push(`未绑定 ${contest.slug}`);
      if (draft.status !== "drafting") issues.push("不是草稿中");
      if (ref && isSprintRef(ref)) {
        if (!ref.answerType) issues.push("缺 answer_type");
        if (!ref.hasAnswerKey) issues.push("缺答案 key");
      }

      return {
        draft,
        ref,
        phase: ref?.phase ?? "unbound",
        dayIndex: ref?.dayIndex ?? 99,
        slotTitle: ref?.slotTitle ?? "未绑定槽位",
        issues,
      };
    });

    const grouped = new Map<string, WeeklyAuditItem[]>();
    for (const item of items) {
      if (!grouped.has(item.phase)) grouped.set(item.phase, []);
      grouped.get(item.phase)!.push(item);
    }

    return {
      contest,
      draftPrefix,
      total: items.length,
      bound: items.filter((item) => item.ref).length,
      issueCount: items.reduce((sum, item) => sum + item.issues.length, 0),
      sprintTotal: items.filter((item) => item.phase === "sprint").length,
      sprintReady: items.filter(
        (item) =>
          item.phase === "sprint" &&
          item.ref?.answerType &&
          item.ref.hasAnswerKey,
      ).length,
      grouped,
    };
  }, [auditContestSlug, contestOptions, contestRefs, drafts]);

  function selectDraft(id: string) {
    if (id === selectedId) return;
    if (
      editForm &&
      !confirm("当前正在编辑，切换草稿将丢弃未保存的修改，确定？")
    )
      return;
    setSelectedId(id);
    setEditForm(null);
    setError(null);
    setMessage(null);
  }

  async function handleSave() {
    if (!selected || !editForm) return;
    if (!editForm.title.trim()) {
      setError("标题不能为空");
      return;
    }

    const statement = editForm.statement
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const tags = editForm.tags
      .split(/[,，、\n]/)
      .map((tag) => tag.trim())
      .filter(Boolean);

    setSaving(true);
    setError(null);
    setMessage(null);

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("problem_drafts")
      .update({
        title: editForm.title.trim(),
        paper: editForm.paper.trim(),
        number: editForm.number.trim(),
        difficulty: editForm.difficulty,
        question_type: editForm.question_type,
        tags,
        statement,
        answer: editForm.answer,
        notes: editForm.notes,
      })
      .eq("id", selected.id);

    setSaving(false);
    if (updateError) {
      setError(`保存失败：${updateError.message}`);
      return;
    }

    setDrafts((current) =>
      current.map((draft) =>
        draft.id === selected.id
          ? {
              ...draft,
              title: editForm.title.trim(),
              paper: editForm.paper.trim(),
              number: editForm.number.trim(),
              difficulty: editForm.difficulty,
              question_type: editForm.question_type,
              tags,
              statement,
              answer: editForm.answer,
              notes: editForm.notes,
            }
          : draft,
      ),
    );
    setEditForm(null);
    setMessage("已保存。");
  }

  async function handlePromote() {
    if (!selected) return;
    if (
      !confirm(
        `确认将「${selected.title || selected.id}」发布到公开题库？此操作不可逆。`,
      )
    )
      return;

    setPromoting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await promoteProblemDraft(selected.id);
      if (result.error) {
        setError(result.error);
      } else {
        setDrafts((current) =>
          current.map((draft) =>
            draft.id === selected.id
              ? {
                  ...draft,
                  status: "promoted",
                  promoted_problem_id:
                    result.problemId ?? draft.promoted_problem_id,
                }
              : draft,
          ),
        );
        setMessage("已发布到公开题库。");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "发布失败");
    } finally {
      setPromoting(false);
    }
  }

  async function handleDelete() {
    if (!selected) return;
    const refs = refsByDraft.get(selected.id) ?? [];
    if (selected.status === "promoted") {
      setError("已发布的草稿不能删除。");
      return;
    }
    if (refs.length > 0) {
      setError("这个草稿已被比赛引用，请先在比赛配置中解绑后再删除。");
      return;
    }

    const supabase = createClient();
    const { count: submissionCount, error: submissionLookupError } =
      await supabase
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .eq("draft_problem_id", selected.id);

    if (submissionLookupError) {
      setError(`删除前检查投稿引用失败：${submissionLookupError.message}`);
      return;
    }
    if ((submissionCount ?? 0) > 0) {
      setError(
        `这个草稿已有 ${submissionCount} 条投稿引用，不能直接删除。请先处理或迁移这些投稿。`,
      );
      return;
    }

    if (
      !confirm(
        `确认删除草稿「${selected.title || selected.id}」？删除后无法恢复。`,
      )
    )
      return;

    setDeleting(true);
    setError(null);
    setMessage(null);

    const { error: deleteError } = await supabase
      .from("problem_drafts")
      .delete()
      .eq("id", selected.id)
      .eq("status", "drafting");

    setDeleting(false);
    if (deleteError) {
      setError(`删除失败：${deleteError.message}`);
      return;
    }

    const remaining = drafts.filter((draft) => draft.id !== selected.id);
    setDrafts(remaining);
    setSelectedId(
      remaining.find((draft) => draft.status === "drafting")?.id ??
        remaining[0]?.id ??
        null,
    );
    setEditForm(null);
    setMessage("草稿已删除。");
  }

  const draftingCount = drafts.filter((d) => d.status === "drafting").length;
  const promotedCount = drafts.filter((d) => d.status === "promoted").length;

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Archive className="size-5 text-violet-400" />
            <h2 className="text-xl font-black text-white">题目草稿箱</h2>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {draftingCount > 0 ? `${draftingCount} 个草稿` : "暂无草稿"}
            {promotedCount > 0 ? ` · ${promotedCount} 个已发布` : ""}
          </p>
        </div>
        <Link
          href="/admin/problem-vault/new"
          className="inline-flex items-center gap-2 border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-bold text-violet-200 transition hover:border-violet-400/50 hover:bg-violet-500/20"
        >
          <Plus className="size-4" />
          新建草稿题目
        </Link>
      </div>

      {error && (
        <div className="mb-3 border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {message && (
        <div className="mb-3 border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">
          {message}
        </div>
      )}

      <WeeklyAuditPanel
        audit={contestAudit}
        contestOptions={contestOptions}
        selectedContestSlug={auditContestSlug}
        onSelectContest={setAuditContestSlug}
        selectedId={selectedId}
        onSelectDraft={selectDraft}
      />

      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* 左侧：筛选 + 草稿列表 */}
        <div className="min-w-0">
          <div className="flex gap-1">
            {(
              [
                { value: "drafting", label: "草稿中" },
                { value: "promoted", label: "已发布" },
                { value: "all", label: "全部" },
              ] as Array<{ value: StatusFilter; label: string }>
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatusFilter(option.value)}
                className={`h-8 border px-3 text-xs font-bold transition ${
                  statusFilter === option.value
                    ? "border-violet-400/50 bg-violet-500/15 text-violet-200"
                    : "border-white/10 bg-black/20 text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-600" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索 title / paper / id / 标签"
              className="h-9 w-full border border-white/10 bg-black/20 pl-8 pr-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-400/50"
            />
          </div>

          <div className="mt-2 max-h-[70vh] overflow-y-auto border border-white/10 bg-black/20">
            {filteredDrafts.length === 0 ? (
              <div className="p-6 text-center">
                <Archive className="mx-auto mb-2 size-6 text-zinc-600" />
                <p className="text-sm text-zinc-500">
                  {drafts.length === 0 ? "草稿箱为空" : "没有匹配的草稿"}
                </p>
              </div>
            ) : (
              filteredDrafts.map((draft) => {
                const warnings = draftWarnings(draft);
                const bound = Boolean(
                  auditContestSlug &&
                  (refsByDraft.get(draft.id) ?? []).some(
                    (ref) => ref.contestSlug === auditContestSlug,
                  ),
                );
                const active = draft.id === selectedId;
                return (
                  <button
                    key={draft.id}
                    type="button"
                    onClick={() => selectDraft(draft.id)}
                    className={`block w-full border-b border-white/5 px-3 py-2.5 text-left transition ${
                      active ? "bg-violet-500/10" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <p
                        className={`min-w-0 flex-1 truncate text-sm font-bold ${active ? "text-violet-200" : "text-white"}`}
                      >
                        {draft.title || (
                          <span className="text-zinc-500">（无标题）</span>
                        )}
                      </p>
                      <span
                        className={`shrink-0 border px-1.5 py-0.5 text-[10px] font-bold ${
                          draft.status === "promoted"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                            : "border-amber-400/30 bg-amber-400/10 text-amber-300"
                        }`}
                      >
                        {draft.status === "promoted" ? "已发布" : "草稿中"}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {draftSourceLabel(draft)}
                      {draft.difficulty ? ` · ${draft.difficulty}` : ""}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="truncate font-mono text-[10px] text-zinc-600">
                        {draft.id}
                      </span>
                      {bound && (
                        <span className="shrink-0 border border-cyan-400/30 bg-cyan-400/10 px-1 text-[10px] font-bold text-cyan-300">
                          {auditContestSlug.replace(/^weekly-arena-/, "W")}
                        </span>
                      )}
                      {warnings.length > 0 && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-amber-400">
                          <AlertTriangle className="size-3" />
                          {warnings.length}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 右侧：详情 / 编辑面板 */}
        <div className="min-w-0 border border-white/10 bg-black/20">
          {!selected ? (
            <div className="p-10 text-center text-sm text-zinc-500">
              从左侧选择一个草稿查看完整内容
            </div>
          ) : editForm ? (
            <DraftEditor
              form={editForm}
              onChange={setEditForm}
              onCancel={() => setEditForm(null)}
              onSave={handleSave}
              saving={saving}
            />
          ) : (
            <DraftDetail
              draft={selected}
              refs={selectedRefs}
              isAuditContestBound={isAuditContestBound}
              auditContestLabel={
                selectedAuditContest?.title ||
                selectedAuditContest?.slug ||
                "当前比赛"
              }
              promoting={promoting}
              deleting={deleting}
              onEdit={() => {
                setEditForm(buildEditForm(selected));
                setError(null);
                setMessage(null);
              }}
              onPromote={handlePromote}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function WeeklyAuditPanel({
  audit,
  contestOptions,
  selectedContestSlug,
  onSelectContest,
  selectedId,
  onSelectDraft,
}: {
  audit: ContestAuditData;
  contestOptions: ContestAuditOption[];
  selectedContestSlug: string;
  onSelectContest: (slug: string) => void;
  selectedId: string | null;
  onSelectDraft: (id: string) => void;
}) {
  const groups = [...audit.grouped.entries()].sort(([phaseA], [phaseB]) => {
    const phaseDiff = weeklyPhaseSortKey(phaseA) - weeklyPhaseSortKey(phaseB);
    return phaseDiff || phaseA.localeCompare(phaseB);
  });
  const ready =
    audit.total > 0 &&
    audit.bound === audit.total &&
    audit.issueCount === 0 &&
    audit.sprintReady === audit.sprintTotal;

  return (
    <section className="mb-4 border border-cyan-400/20 bg-cyan-400/[0.04] p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ListChecks className="size-4 text-cyan-300" />
            <h3 className="text-sm font-black text-white">赛前检查</h3>
            <span
              className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[11px] font-bold ${
                ready
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-400/40 bg-amber-400/10 text-amber-300"
              }`}
            >
              {ready ? (
                <CheckCircle2 className="size-3" />
              ) : (
                <AlertTriangle className="size-3" />
              )}
              {ready ? "可开赛" : "需复核"}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {audit.contest
              ? `${audit.contest.title || audit.contest.slug} · `
              : ""}
            {audit.bound}/{audit.total} 已绑定 · sprint key {audit.sprintReady}/
            {audit.sprintTotal} · {audit.issueCount} 个检查项
          </p>
        </div>

        <div className="grid gap-2 text-xs sm:grid-cols-[minmax(12rem,1fr)_repeat(4,auto)]">
          <label className="grid gap-1">
            <span className="text-[10px] uppercase tracking-wide text-zinc-600">
              检查比赛
            </span>
            <select
              value={selectedContestSlug}
              onChange={(event) => onSelectContest(event.target.value)}
              className="h-9 min-w-0 border border-white/10 bg-zinc-950 px-2 text-xs font-bold text-zinc-200 outline-none focus:border-cyan-400/50"
            >
              {contestOptions.length === 0 ? (
                <option value="">暂无比赛</option>
              ) : (
                contestOptions.map((contest) => (
                  <option key={contest.slug} value={contest.slug}>
                    {contest.title || contest.slug}
                  </option>
                ))
              )}
            </select>
          </label>
          <AuditMetric label="草稿" value={String(audit.total)} />
          <AuditMetric label="已绑定" value={`${audit.bound}/${audit.total}`} />
          <AuditMetric
            label="计时 key"
            value={`${audit.sprintReady}/${audit.sprintTotal}`}
          />
          <AuditMetric
            label="问题项"
            value={String(audit.issueCount)}
            tone={audit.issueCount > 0 ? "warn" : "ok"}
          />
        </div>
      </div>

      {!audit.contest ? (
        <p className="mt-3 text-xs text-zinc-500">暂无可检查的比赛。</p>
      ) : audit.total === 0 ? (
        <p className="mt-3 text-xs text-zinc-500">
          没有检测到{audit.draftPrefix ? ` ${audit.draftPrefix}* 草稿或` : ""}
          绑定到该比赛的草稿。
        </p>
      ) : (
        <div className="mt-3 grid gap-2 xl:grid-cols-4">
          {groups.map(([phase, items]) => {
            const meta = phaseMeta(phase);
            const sorted = [...items].sort(
              (a, b) =>
                a.dayIndex - b.dayIndex ||
                contestDraftSortKey(a.draft.id).localeCompare(
                  contestDraftSortKey(b.draft.id),
                ),
            );
            return (
              <div key={phase} className="border border-white/10 bg-black/25">
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                  <span
                    className={`border px-1.5 py-0.5 text-[10px] font-bold ${meta.className}`}
                  >
                    {meta.label}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {sorted.filter((item) => item.issues.length === 0).length}/
                    {sorted.length} OK
                  </span>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {sorted.map((item) => {
                    const active = item.draft.id === selectedId;
                    const good = item.issues.length === 0;
                    return (
                      <button
                        key={item.draft.id}
                        type="button"
                        onClick={() => onSelectDraft(item.draft.id)}
                        className={`block w-full border-b border-white/5 px-3 py-2 text-left transition last:border-b-0 ${
                          active ? "bg-violet-500/15" : "hover:bg-white/[0.03]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 font-mono text-[10px] text-zinc-500">
                            {item.ref ? `D${item.dayIndex}` : "--"}
                          </span>
                          <span
                            className={`min-w-0 flex-1 truncate text-xs font-bold ${active ? "text-violet-200" : "text-zinc-200"}`}
                          >
                            {item.draft.title || item.draft.id}
                          </span>
                          <span
                            className={`shrink-0 border px-1 py-0.5 text-[10px] font-bold ${
                              good
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                : "border-amber-400/40 bg-amber-400/10 text-amber-300"
                            }`}
                          >
                            {good ? "OK" : item.issues.length}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-[10px] text-zinc-600">
                          {item.slotTitle}
                        </p>
                        {item.issues.length > 0 && (
                          <p className="mt-1 truncate text-[10px] text-amber-300">
                            {item.issues.join(" · ")}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AuditMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "ok" | "warn";
}) {
  return (
    <div className="border border-white/10 bg-black/30 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-zinc-600">
        {label}
      </p>
      <p
        className={`mt-0.5 font-mono text-sm font-bold ${
          tone === "ok"
            ? "text-emerald-300"
            : tone === "warn"
              ? "text-amber-300"
              : "text-zinc-200"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function DraftDetail({
  draft,
  refs,
  isAuditContestBound,
  auditContestLabel,
  promoting,
  deleting,
  onEdit,
  onPromote,
  onDelete,
}: {
  draft: ProblemDraft;
  refs: DraftContestRef[];
  isAuditContestBound: boolean;
  auditContestLabel: string;
  promoting: boolean;
  deleting: boolean;
  onEdit: () => void;
  onPromote: () => void;
  onDelete: () => void;
}) {
  const warnings = draftWarnings(draft);
  const guide = draft.learning_guide;
  const hasGuide =
    guide &&
    (LEARNING_GUIDE_SECTIONS.some(
      ({ key }) =>
        Array.isArray(guide[key]) && (guide[key] as string[]).length > 0,
    ) ||
      (guide.recommendation ?? "").trim());

  return (
    <div className="p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-black text-white">
            {draft.title || <span className="text-zinc-500">（无标题）</span>}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            {draftSourceLabel(draft)}
            {draft.difficulty ? ` · ${draft.difficulty}` : ""}
            {draft.question_type ? ` · ${draft.question_type}` : ""}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-zinc-600">
            {draft.id}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span
            className={`border px-2 py-0.5 text-xs font-bold ${
              isAuditContestBound
                ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                : "border-zinc-500/30 bg-zinc-500/10 text-zinc-400"
            }`}
          >
            {auditContestLabel} {isAuditContestBound ? "已绑定" : "未绑定"}
          </span>
          <span
            className={`border px-2 py-0.5 text-xs font-bold ${
              draft.status === "promoted"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                : "border-amber-400/30 bg-amber-400/10 text-amber-300"
            }`}
          >
            {draft.status === "promoted" ? "已发布" : "草稿中"}
          </span>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {warnings.map((warning) => (
            <span
              key={warning}
              className="inline-flex items-center gap-1 border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-bold text-amber-300"
            >
              <AlertTriangle className="size-3" />
              {warning}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-8 items-center gap-1.5 border border-cyan-400/30 px-3 text-xs font-bold text-cyan-300 transition hover:bg-cyan-400/10"
        >
          <Pencil className="size-3.5" />
          编辑
        </button>
        {draft.status === "promoted" && draft.promoted_problem_id ? (
          <Link
            href={`/problems/${draft.promoted_problem_id}`}
            className="inline-flex h-8 items-center gap-1.5 border border-emerald-500/30 px-3 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/10"
          >
            查看正式题目 <ExternalLink className="size-3" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={onPromote}
            disabled={promoting}
            className="inline-flex h-8 items-center gap-1.5 border border-violet-500/30 bg-violet-500/10 px-3 text-xs font-bold text-violet-300 transition hover:border-violet-400/50 hover:bg-violet-500/20 disabled:opacity-50"
          >
            {promoting ? (
              "发布中…"
            ) : (
              <>
                发布到公开题库 <ArrowUpRight className="size-3" />
              </>
            )}
          </button>
        )}
        {draft.status !== "promoted" && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting || refs.length > 0}
            title={
              refs.length > 0 ? "这个草稿已被比赛引用，请先解绑" : "删除草稿"
            }
            className="inline-flex h-8 items-center gap-1.5 border border-red-500/30 px-3 text-xs font-bold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="size-3.5" />
            {deleting ? "删除中…" : "删除草稿"}
          </button>
        )}
      </div>

      {/* 比赛引用 */}
      <section className="mt-5">
        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-500">
          比赛引用
        </h4>
        {refs.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">未被任何比赛引用</p>
        ) : (
          <div className="mt-2 grid gap-2">
            {refs.map((ref) => {
              const phase = phaseMeta(ref.phase);
              return (
                <div
                  key={ref.contestProblemId}
                  className="border border-white/10 bg-white/[0.02] p-3"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Link
                      href={`/contests/${ref.contestSlug}`}
                      className="font-mono font-bold text-violet-300 hover:underline"
                    >
                      {ref.contestSlug}
                    </Link>
                    <span className="text-zinc-500">Day {ref.dayIndex}</span>
                    <span
                      className={`border px-1.5 py-0.5 text-[10px] font-bold ${phase.className}`}
                    >
                      {phase.label}
                    </span>
                    <span className="text-zinc-300">{ref.slotTitle}</span>
                  </div>
                  {isSprintRef(ref) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span
                        className={`border px-1.5 py-0.5 text-[10px] font-bold ${
                          ref.answerType
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                            : "border-red-500/40 bg-red-500/10 text-red-300"
                        }`}
                      >
                        answer_type{" "}
                        {ref.answerType
                          ? `已配置（${ANSWER_TYPE_LABELS[ref.answerType] ?? ref.answerType}）`
                          : "未配置"}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-bold ${
                          ref.hasAnswerKey
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                            : "border-red-500/40 bg-red-500/10 text-red-300"
                        }`}
                      >
                        <KeyRound className="size-3" />
                        答案 key {ref.hasAnswerKey ? "已存在" : "缺失"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 题干 */}
      <section className="mt-5">
        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-500">
          题干
        </h4>
        {draft.statement && draft.statement.length > 0 ? (
          <div className="mt-2 space-y-2 border border-white/10 bg-white/[0.02] p-4 text-sm leading-7 text-zinc-200">
            {draft.statement.map((paragraph, index) => (
              <p key={index}>
                <MathBlock>{paragraph}</MathBlock>
              </p>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-amber-400/80">（题干为空）</p>
        )}
      </section>

      {/* 答案 */}
      <section className="mt-5">
        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-500">
          答案
        </h4>
        {draft.answer?.trim() ? (
          <div className="mt-2 border border-white/10 bg-white/[0.02] p-4 text-sm leading-7 text-zinc-200">
            <MathBlock>{draft.answer}</MathBlock>
          </div>
        ) : (
          <p className="mt-2 text-sm text-amber-400/80">（答案为空）</p>
        )}
      </section>

      {/* 标签 */}
      <section className="mt-5">
        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-500">
          标签
        </h4>
        {draft.tags && draft.tags.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {draft.tags.map((tag) => (
              <span
                key={tag}
                className="border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-zinc-300"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-600">（无标签）</p>
        )}
      </section>

      {/* 来源 */}
      <section className="mt-5">
        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-500">
          来源
        </h4>
        <p className="mt-2 text-sm text-zinc-400">
          {draft.source_pdf?.trim() ? (
            <>
              <span className="font-mono text-xs">{draft.source_pdf}</span>
              {draft.source_page ? (
                <span className="text-zinc-500">
                  （第 {draft.source_page} 页）
                </span>
              ) : null}
            </>
          ) : (
            <span className="text-zinc-600">（无来源 PDF）</span>
          )}
        </p>
        {draft.answer_pdf?.trim() && (
          <p className="mt-1 text-sm text-zinc-500">
            答案 PDF：
            <span className="font-mono text-xs">{draft.answer_pdf}</span>
          </p>
        )}
      </section>

      {/* 备注 */}
      {draft.notes?.trim() && (
        <section className="mt-5">
          <h4 className="text-xs font-black uppercase tracking-wider text-zinc-500">
            备注
          </h4>
          <p className="mt-2 whitespace-pre-wrap border border-white/10 bg-white/[0.02] p-3 text-sm leading-6 text-zinc-400">
            {draft.notes}
          </p>
        </section>
      )}

      {/* 学习指南 */}
      {hasGuide && (
        <section className="mt-5">
          <h4 className="text-xs font-black uppercase tracking-wider text-zinc-500">
            学习指南
          </h4>
          <div className="mt-2 grid gap-3 border border-white/10 bg-white/[0.02] p-4">
            {LEARNING_GUIDE_SECTIONS.map(({ key, label }) => {
              const items = guide?.[key];
              if (!Array.isArray(items) || items.length === 0) return null;
              return (
                <div key={key}>
                  <p className="text-xs font-bold text-zinc-400">{label}</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-300">
                    {items.map((item, index) => (
                      <li key={index}>
                        <MathBlock>{item}</MathBlock>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            {(guide?.recommendation ?? "").trim() && (
              <div>
                <p className="text-xs font-bold text-zinc-400">推荐</p>
                <p className="mt-1 text-sm leading-6 text-zinc-300">
                  <MathBlock>{guide!.recommendation!}</MathBlock>
                </p>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function DraftEditor({
  form,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  form: DraftEditForm;
  onChange: (form: DraftEditForm) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="grid gap-4 p-4 md:p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-black text-white">编辑草稿</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="inline-flex h-8 items-center gap-1.5 border border-white/10 px-3 text-xs font-bold text-zinc-400 transition hover:text-white disabled:opacity-50"
          >
            <X className="size-3.5" />
            取消
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex h-8 items-center gap-1.5 border border-cyan-400/30 bg-cyan-400/10 px-3 text-xs font-bold text-cyan-300 transition hover:bg-cyan-400/20 disabled:opacity-50"
          >
            <Save className="size-3.5" />
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="font-bold text-white">标题</span>
        <input
          type="text"
          value={form.title}
          onChange={(e) => onChange({ ...form, title: e.target.value })}
          className="h-10 border border-white/10 bg-white/5 px-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-bold text-white">试卷（paper）</span>
          <input
            type="text"
            value={form.paper}
            onChange={(e) => onChange({ ...form, paper: e.target.value })}
            className="h-10 border border-white/10 bg-white/5 px-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-bold text-white">题号（number）</span>
          <input
            type="text"
            value={form.number}
            onChange={(e) => onChange({ ...form, number: e.target.value })}
            className="h-10 border border-white/10 bg-white/5 px-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-bold text-white">难度</span>
          <select
            value={form.difficulty}
            onChange={(e) => onChange({ ...form, difficulty: e.target.value })}
            className="h-10 border border-white/10 bg-zinc-950 px-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
          >
            <option value="基础">基础</option>
            <option value="中档">中档</option>
            <option value="压轴">压轴</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-bold text-white">题型</span>
          <select
            value={form.question_type}
            onChange={(e) =>
              onChange({ ...form, question_type: e.target.value })
            }
            className="h-10 border border-white/10 bg-zinc-950 px-3 text-sm text-white outline-none transition focus:border-cyan-400/50"
          >
            <option value="单选">单选</option>
            <option value="多选">多选</option>
            <option value="填空">填空</option>
            <option value="解答">解答</option>
          </select>
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="font-bold text-white">
          标签（用逗号、顿号或换行分隔）
        </span>
        <input
          type="text"
          value={form.tags}
          onChange={(e) => onChange({ ...form, tags: e.target.value })}
          placeholder="导数、圆锥曲线、数列"
          className="h-10 border border-white/10 bg-white/5 px-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-cyan-400/50"
        />
      </label>

      <MathPreviewTextArea
        label="题干（每个自然段一行，空行分段）"
        value={form.statement}
        onChange={(statement) => onChange({ ...form, statement })}
        rows={10}
        placeholder="在此输入题目，支持行内公式 $...$ 和块公式 $$...$$"
      />

      <MathPreviewTextArea
        label="答案"
        value={form.answer}
        onChange={(answer) => onChange({ ...form, answer })}
        rows={4}
      />

      <label className="grid gap-1 text-sm">
        <span className="font-bold text-white">备注（notes，不对外展示）</span>
        <textarea
          rows={4}
          value={form.notes}
          onChange={(e) => onChange({ ...form, notes: e.target.value })}
          className="resize-y border border-white/10 bg-white/5 px-3 py-2 text-sm leading-6 text-white outline-none transition focus:border-cyan-400/50"
        />
      </label>
    </div>
  );
}
