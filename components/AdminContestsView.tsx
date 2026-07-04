"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Award, CalendarDays, CheckCircle2, Clock, Database, Lock, LockOpen, Plus, RefreshCw, Save, Trash2, Trophy } from "lucide-react";
import { contests as seededContests } from "@/data/contests";
import { contestAwardMeta, contestSolutionTypeMeta, contestStatusMeta } from "@/lib/contest-meta";
import type { ContestAwardType, ContestStatus } from "@/lib/types";
import { createClient } from "@/lib/supabase-client";

type ProblemOption = {
  id: string;
  title: string;
  source: string;
};

type DbContest = {
  id: string;
  slug: string;
  title: string;
  description: string;
  tagline: string;
  rules: string[];
  status: ContestStatus;
  start_at: string;
  end_at: string;
  discussion_start_at: string | null;
  discussion_end_at: string | null;
  contest_problems?: DbContestProblem[];
  awards?: DbAward[];
};

type DbContestProblem = {
  id: string;
  contest_id: string;
  problem_id: string | null;
  day_index: number;
  title: string;
  theme: string;
  open_at: string;
  close_at: string;
  weight: number;
  status: "locked" | "open" | "reviewing" | "closed";
  unlock_mode: "manual" | "auto_time";
};

type DbAward = {
  id: string;
  contest_id: string;
  problem_id: string | null;
  solution_id: string | null;
  user_id: string | null;
  type: ContestAwardType;
  title: string;
  reason: string;
  points: number;
  created_at: string;
};

const emptyContest = {
  slug: "",
  title: "",
  description: "",
  tagline: "",
  rules: "",
  status: "draft" as ContestStatus,
  startAt: "",
  endAt: "",
  discussionStartAt: "",
  discussionEndAt: "",
};

const emptyProblem = {
  problemId: "",
  dayIndex: 1,
  title: "",
  theme: "",
  openAt: "",
  closeAt: "",
  weight: 1,
  status: "locked" as DbContestProblem["status"],
  unlockMode: "manual" as DbContestProblem["unlock_mode"],
};

const emptyAward = {
  type: "best_overall" as ContestAwardType,
  title: "",
  reason: "",
  points: 0,
  problemId: "",
  solutionId: "",
  userId: "",
};

function toInputDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function fromInputDate(value: string) {
  return new Date(value).toISOString();
}

function splitRules(value: string) {
  return value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
}

export function AdminContestsView({ problems }: { problems: ProblemOption[] }) {
  const supabase = createClient();
  const [contests, setContests] = useState<DbContest[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [contestForm, setContestForm] = useState(emptyContest);
  const [problemForm, setProblemForm] = useState(emptyProblem);
  const [awardForm, setAwardForm] = useState(emptyAward);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedContest = useMemo(
    () => contests.find((contest) => contest.id === selectedId) ?? null,
    [contests, selectedId],
  );

  useEffect(() => {
    void loadContests();
  }, []);

  useEffect(() => {
    if (!selectedContest) return;
    setContestForm({
      slug: selectedContest.slug,
      title: selectedContest.title,
      description: selectedContest.description,
      tagline: selectedContest.tagline,
      rules: selectedContest.rules.join("\n"),
      status: selectedContest.status,
      startAt: toInputDate(selectedContest.start_at),
      endAt: toInputDate(selectedContest.end_at),
      discussionStartAt: toInputDate(selectedContest.discussion_start_at ?? ""),
      discussionEndAt: toInputDate(selectedContest.discussion_end_at ?? ""),
    });
  }, [selectedContest]);

  async function loadContests() {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("contests")
      .select("*, contest_problems(*), awards(*)")
      .order("start_at", { ascending: false });

    setLoading(false);
    if (loadError) {
      setError(loadError.message || "加载比赛失败。请确认已执行 004_contest_arena_mvp.sql。");
      return;
    }

    const rows = (data ?? []) as DbContest[];
    setContests(rows);
    if (!selectedId && rows[0]) setSelectedId(rows[0].id);
  }

  async function syncSeedContest() {
    const seed = seededContests[0];
    if (!seed) return;
    setSaving(true);
    setError("");
    setMessage("");

    const { data: existing } = await supabase
      .from("contests")
      .select("id")
      .eq("slug", seed.slug)
      .maybeSingle();

    const contestPatch = {
      slug: seed.slug,
      title: seed.title,
      description: seed.description,
      tagline: seed.tagline,
      rules: seed.rules,
      status: seed.status,
      start_at: seed.startAt,
      end_at: seed.endAt,
      discussion_start_at: seed.discussionStartAt ?? null,
      discussion_end_at: seed.discussionEndAt ?? null,
    };

    const result = existing?.id
      ? await supabase.from("contests").update(contestPatch).eq("id", existing.id).select("id").single()
      : await supabase.from("contests").insert(contestPatch).select("id").single();

    if (result.error || !result.data) {
      setSaving(false);
      setError(result.error?.message || "同步默认比赛失败。");
      return;
    }

    const contestId = result.data.id as string;
    for (const contestProblem of seed.problems) {
      const patch = {
        contest_id: contestId,
        problem_id: contestProblem.problemId,
        day_index: contestProblem.dayIndex,
        title: contestProblem.title,
        theme: contestProblem.theme,
        open_at: contestProblem.openAt,
        close_at: contestProblem.closeAt,
        weight: contestProblem.weight,
        status: contestProblem.status,
        unlock_mode: contestProblem.unlockMode ?? "manual",
      };
      await supabase
        .from("contest_problems")
        .upsert(patch, { onConflict: "contest_id,day_index" });
    }

    setSaving(false);
    setMessage("已同步默认比赛和题目安排。");
    await loadContests();
    setSelectedId(contestId);
  }

  async function saveContest() {
    setSaving(true);
    setError("");
    setMessage("");

    const patch = {
      slug: contestForm.slug.trim(),
      title: contestForm.title.trim(),
      description: contestForm.description.trim(),
      tagline: contestForm.tagline.trim(),
      rules: splitRules(contestForm.rules),
      status: contestForm.status,
      start_at: fromInputDate(contestForm.startAt),
      end_at: fromInputDate(contestForm.endAt),
      discussion_start_at: contestForm.discussionStartAt ? fromInputDate(contestForm.discussionStartAt) : null,
      discussion_end_at: contestForm.discussionEndAt ? fromInputDate(contestForm.discussionEndAt) : null,
    };

    const result = selectedContest
      ? await supabase.from("contests").update(patch).eq("id", selectedContest.id).select("id").single()
      : await supabase.from("contests").insert(patch).select("id").single();

    setSaving(false);
    if (result.error || !result.data) {
      setError(result.error?.message || "保存比赛失败。");
      return;
    }

    setMessage("比赛信息已保存。");
    await loadContests();
    setSelectedId(result.data.id as string);
  }

  async function addContestProblem() {
    if (!selectedContest) return;
    setSaving(true);
    setError("");
    setMessage("");

    const { error: insertError } = await supabase.from("contest_problems").insert({
      contest_id: selectedContest.id,
      problem_id: problemForm.problemId || null,
      day_index: Number(problemForm.dayIndex),
      title: problemForm.title.trim(),
      theme: problemForm.theme.trim(),
      open_at: fromInputDate(problemForm.openAt),
      close_at: fromInputDate(problemForm.closeAt),
      weight: Number(problemForm.weight),
      status: problemForm.status,
      unlock_mode: problemForm.unlockMode,
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message || "添加赛题失败。");
      return;
    }
    setProblemForm(emptyProblem);
    setMessage("赛题已添加。");
    await loadContests();
  }

  async function updateContestProblem(problem: DbContestProblem, patch: Partial<DbContestProblem>) {
    setSaving(true);
    setError("");
    const { error: updateError } = await supabase
      .from("contest_problems")
      .update(patch)
      .eq("id", problem.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message || "更新赛题失败。");
      return;
    }
    setMessage("赛题已更新。");
    await loadContests();
  }

  async function deleteContestProblem(problemId: string) {
    setSaving(true);
    setError("");
    const { error: deleteError } = await supabase.from("contest_problems").delete().eq("id", problemId);
    setSaving(false);
    if (deleteError) {
      setError(deleteError.message || "删除赛题失败。");
      return;
    }
    setMessage("赛题已删除。");
    await loadContests();
  }

  async function addAward() {
    if (!selectedContest) return;
    setSaving(true);
    setError("");
    setMessage("");

    const { error: insertError } = await supabase.from("awards").insert({
      contest_id: selectedContest.id,
      problem_id: awardForm.problemId || null,
      solution_id: awardForm.solutionId.trim() || null,
      user_id: awardForm.userId.trim() || null,
      type: awardForm.type,
      title: awardForm.title.trim() || contestAwardMeta[awardForm.type],
      reason: awardForm.reason.trim(),
      points: Number(awardForm.points),
    });

    setSaving(false);
    if (insertError) {
      setError(insertError.message || "添加奖项失败。");
      return;
    }
    setAwardForm(emptyAward);
    setMessage("奖项已添加。");
    await loadContests();
  }

  async function deleteAward(awardId: string) {
    setSaving(true);
    setError("");
    const { error: deleteError } = await supabase.from("awards").delete().eq("id", awardId);
    setSaving(false);
    if (deleteError) {
      setError(deleteError.message || "删除奖项失败。");
      return;
    }
    setMessage("奖项已删除。");
    await loadContests();
  }

  if (loading) {
    return (
      <div className="mt-10 space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse border border-white/10 bg-white/[0.03]" />)}
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
        {/* Quick actions */}
        <section className="border border-white/10 bg-zinc-950 p-4">
          <p className="mb-3 text-[11px] uppercase tracking-wide text-zinc-500">快捷操作</p>
          <button
            type="button"
            onClick={syncSeedContest}
            disabled={saving}
            className="inline-flex h-9 w-full items-center justify-center gap-2 bg-cyan-400 px-3 text-xs font-bold text-zinc-950 transition hover:bg-cyan-300 disabled:opacity-50"
          >
            <Database className="size-3.5" />
            同步默认比赛数据
          </button>
        </section>

        {/* Contest list */}
        <section className="border border-white/10 bg-zinc-950">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
            <span className="text-xs font-bold uppercase tracking-wide text-zinc-400">比赛列表</span>
            <span className="text-[11px] text-zinc-600">{contests.length} 场</span>
          </div>
          <div className="divide-y divide-white/[0.07]">
            {contests.map((contest) => {
              const status = contestStatusMeta[contest.status];
              const isSelected = selectedId === contest.id;
              return (
                <button
                  key={contest.id}
                  type="button"
                  onClick={() => setSelectedId(contest.id)}
                  className={`block w-full px-4 py-3 text-left transition ${
                    isSelected
                      ? "bg-cyan-400/10 border-l-2 border-l-cyan-400"
                      : "border-l-2 border-l-transparent hover:bg-white/[0.03]"
                  }`}
                >
                  <span className="block text-sm font-bold text-white">{contest.title}</span>
                  <span className={`mt-1.5 inline-flex items-center border px-2 py-0.5 text-[11px] font-bold ${status.className}`}>
                    {status.label}
                  </span>
                </button>
              );
            })}
            {contests.length === 0 && (
              <p className="px-4 py-6 text-sm text-zinc-500">还没有比赛。点击"同步默认比赛"开始。</p>
            )}
          </div>
        </section>

        <button
          type="button"
          onClick={() => { setSelectedId(""); setContestForm(emptyContest); }}
          className="inline-flex h-9 w-full items-center justify-center gap-2 border border-dashed border-white/15 text-sm text-zinc-400 transition hover:border-white/30 hover:text-white"
        >
          <Plus className="size-4" />
          新建比赛
        </button>
      </aside>

      <div className="min-w-0 space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-black text-white">
              {selectedContest ? selectedContest.title : "新建比赛"}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              {selectedContest ? `比赛 ID: ${selectedContest.id.slice(0, 8)}…` : "填写信息后保存"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link href="/admin/submissions" className="inline-flex h-7 items-center border border-white/15 px-3 text-zinc-300 transition hover:border-white/30 hover:text-white">
              投稿审核
            </Link>
            {selectedContest && (
              <>
                <Link href={`/contests/${selectedContest.slug}`} className="inline-flex h-7 items-center border border-white/15 px-3 text-zinc-300 transition hover:border-white/30 hover:text-white" target="_blank">
                  前台预览 ↗
                </Link>
                <Link
                  href={`/admin/submissions?contest=${selectedContest.slug}`}
                  className="inline-flex h-7 items-center border border-amber-400/40 bg-amber-400/10 px-3 font-bold text-amber-300 transition hover:bg-amber-400/15"
                >
                  查看比赛投稿
                </Link>
              </>
            )}
          </div>
        </header>

        {message && (
          <div className="flex items-center gap-2 border border-emerald-500/40 bg-emerald-500/[0.08] px-4 py-2.5">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
            <p className="text-sm text-emerald-300">{message}</p>
          </div>
        )}
        {error && (
          <div className="border border-red-500/40 bg-red-500/[0.08] px-4 py-2.5 text-sm text-red-300">{error}</div>
        )}

        <section className="border border-white/10 bg-zinc-950 p-5">
          <div className="mb-5 flex items-center gap-2 text-sm font-bold text-white">
            <Save className="size-4 text-cyan-300" />
            比赛信息
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="slug" value={contestForm.slug} onChange={(slug) => setContestForm({ ...contestForm, slug })} />
            <TextField label="标题" value={contestForm.title} onChange={(title) => setContestForm({ ...contestForm, title })} />
            <label className="grid gap-2 text-sm">
              <span className="font-bold text-white">状态</span>
              <select
                value={contestForm.status}
                onChange={(event) => setContestForm({ ...contestForm, status: event.target.value as ContestStatus })}
                className="h-11 border border-white/10 bg-black/20 px-3 text-white outline-none"
              >
                {Object.entries(contestStatusMeta).map(([value, meta]) => (
                  <option key={value} value={value}>{meta.label}</option>
                ))}
              </select>
            </label>
            <TextField label="简介" value={contestForm.description} onChange={(description) => setContestForm({ ...contestForm, description })} />
            <TextField label="开始时间" type="datetime-local" value={contestForm.startAt} onChange={(startAt) => setContestForm({ ...contestForm, startAt })} />
            <TextField label="结束时间" type="datetime-local" value={contestForm.endAt} onChange={(endAt) => setContestForm({ ...contestForm, endAt })} />
            <TextField label="讨论开始时间" type="datetime-local" value={contestForm.discussionStartAt} onChange={(discussionStartAt) => setContestForm({ ...contestForm, discussionStartAt })} />
            <TextField label="讨论结束时间" type="datetime-local" value={contestForm.discussionEndAt} onChange={(discussionEndAt) => setContestForm({ ...contestForm, discussionEndAt })} />
            <div className="md:col-span-2">
              <TextArea label="一句话定位" value={contestForm.tagline} onChange={(tagline) => setContestForm({ ...contestForm, tagline })} rows={3} />
            </div>
            <div className="md:col-span-2">
              <TextArea label="规则说明（一行一条）" value={contestForm.rules} onChange={(rules) => setContestForm({ ...contestForm, rules })} rows={6} />
            </div>
          </div>
          <button
            type="button"
            onClick={saveContest}
            disabled={saving || !contestForm.slug || !contestForm.title || !contestForm.startAt || !contestForm.endAt}
            className="mt-5 inline-flex h-11 items-center justify-center gap-2 bg-cyan-400 px-5 text-sm font-bold text-zinc-950 disabled:opacity-50"
          >
            <Save className="size-4" />
            保存比赛
          </button>
        </section>

        {selectedContest && (
          <>
            <section className="border border-white/10 bg-zinc-950 p-5">
              <div className="mb-5 flex items-center gap-2 text-sm font-bold text-white">
                <CalendarDays className="size-4 text-cyan-300" />
                赛题安排
              </div>
              <div className="space-y-2">
                {(selectedContest.contest_problems ?? []).sort((a, b) => a.day_index - b.day_index).map((item) => (
                  <div key={item.id} className="border border-white/10 bg-zinc-950">
                    <div className="flex flex-wrap items-start gap-3 p-4">
                      <span className="mt-0.5 shrink-0 border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 font-mono text-xs font-bold text-cyan-300">
                        Day {item.day_index}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-white">{item.title}</p>
                        <p className="mt-0.5 text-xs text-zinc-400">{item.theme}</p>
                        <p className="mt-1 text-xs text-zinc-500">{item.problem_id ?? <span className="text-zinc-600 italic">未关联题目</span>}</p>
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-500">
                          <Clock className="size-3" />
                          {toInputDate(item.open_at) || "未设置"} → {toInputDate(item.close_at) || "未设置"}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.07] px-4 py-2.5">
                      <select
                        value={item.unlock_mode ?? "manual"}
                        onChange={(event) => updateContestProblem(item, { unlock_mode: event.target.value as DbContestProblem["unlock_mode"] })}
                        className="h-8 border border-white/15 bg-zinc-950 px-2 text-xs text-zinc-300 outline-none"
                        title="解锁方式"
                      >
                        <option value="manual">手动控制</option>
                        <option value="auto_time">自动解锁</option>
                      </select>
                      <select
                        value={item.status}
                        onChange={(event) => updateContestProblem(item, { status: event.target.value as DbContestProblem["status"] })}
                        className="h-8 border border-white/15 bg-zinc-950 px-2 text-xs text-zinc-300 outline-none"
                        title="状态"
                      >
                        {["locked", "open", "reviewing", "closed"].map((s) => <option key={s}>{s}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={() => updateContestProblem(item, { status: "open" })}
                        className="inline-flex h-8 items-center gap-1.5 border border-emerald-500/40 bg-emerald-500/10 px-3 text-xs font-bold text-emerald-300 transition hover:bg-emerald-500/15"
                      >
                        <LockOpen className="size-3.5" />
                        解锁
                      </button>
                      <button
                        type="button"
                        onClick={() => updateContestProblem(item, { status: "locked" })}
                        className="inline-flex h-8 items-center gap-1.5 border border-amber-500/40 bg-amber-500/10 px-3 text-xs font-bold text-amber-300 transition hover:bg-amber-500/15"
                      >
                        <Lock className="size-3.5" />
                        锁定
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteContestProblem(item.id)}
                        className="ml-auto inline-flex h-8 items-center gap-1.5 border border-red-500/30 px-3 text-xs font-bold text-red-400 transition hover:bg-red-500/10"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-4 border-t border-white/10 pt-5 md:grid-cols-2">
                <TextField label="Day" type="number" value={String(problemForm.dayIndex)} onChange={(dayIndex) => setProblemForm({ ...problemForm, dayIndex: Number(dayIndex) })} />
                <TextField label="标题" value={problemForm.title} onChange={(title) => setProblemForm({ ...problemForm, title })} />
                <label className="grid gap-2 text-sm md:col-span-2">
                  <span className="font-bold text-white">关联题目</span>
                  <select
                    value={problemForm.problemId}
                    onChange={(event) => setProblemForm({ ...problemForm, problemId: event.target.value })}
                    className="h-11 border border-white/10 bg-black/20 px-3 text-sm text-white"
                  >
                    <option value="">暂不关联</option>
                    {problems.map((problem) => (
                      <option key={problem.id} value={problem.id}>{problem.source} · {problem.title}</option>
                    ))}
                  </select>
                </label>
                <TextField label="开放时间" type="datetime-local" value={problemForm.openAt} onChange={(openAt) => setProblemForm({ ...problemForm, openAt })} />
                <TextField label="截止时间" type="datetime-local" value={problemForm.closeAt} onChange={(closeAt) => setProblemForm({ ...problemForm, closeAt })} />
                <TextField label="权重" type="number" value={String(problemForm.weight)} onChange={(weight) => setProblemForm({ ...problemForm, weight: Number(weight) })} />
                <TextField label="主题" value={problemForm.theme} onChange={(theme) => setProblemForm({ ...problemForm, theme })} />
                <label className="grid gap-2 text-sm">
                  <span className="font-bold text-white">解锁方式</span>
                  <select
                    value={problemForm.unlockMode}
                    onChange={(event) => setProblemForm({ ...problemForm, unlockMode: event.target.value as DbContestProblem["unlock_mode"] })}
                    className="h-11 border border-white/10 bg-black/20 px-3 text-sm text-white"
                  >
                    <option value="manual">手动控制（管理员手动开关）</option>
                    <option value="auto_time">到时自动解锁（按开放/截止时间）</option>
                  </select>
                </label>
              </div>
              <button
                type="button"
                onClick={addContestProblem}
                disabled={saving || !problemForm.title || !problemForm.openAt || !problemForm.closeAt}
                className="mt-5 inline-flex h-10 items-center justify-center gap-2 border border-cyan-400/30 px-4 text-sm font-bold text-cyan-300 disabled:opacity-50"
              >
                <Plus className="size-4" />
                添加赛题
              </button>
            </section>

            <section className="border border-white/10 bg-zinc-950 p-5">
              <div className="mb-5 flex items-center gap-2 text-sm font-bold text-white">
                <Award className="size-4 text-amber-300" />
                奖项标记
              </div>
              <div className="space-y-3">
                {(selectedContest.awards ?? []).map((award) => (
                  <div key={award.id} className="flex flex-col gap-3 border border-amber-400/20 bg-amber-400/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold text-amber-100">{award.title}</p>
                      <p className="mt-1 text-xs text-zinc-500">{contestAwardMeta[award.type]} · {award.points} 分</p>
                      <p className="mt-1 text-sm leading-6 text-zinc-500">{award.reason || "未填写理由"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteAward(award.id)}
                      className="inline-flex h-9 items-center justify-center gap-2 border border-red-400/30 px-3 text-xs font-bold text-red-300"
                    >
                      <Trash2 className="size-3.5" />
                      删除
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-4 border-t border-white/10 pt-5 md:grid-cols-2">
                <label className="grid gap-2 text-sm">
                  <span className="font-bold text-white">奖项类型</span>
                  <select
                    value={awardForm.type}
                    onChange={(event) => setAwardForm({ ...awardForm, type: event.target.value as ContestAwardType })}
                    className="h-11 border border-white/10 bg-black/20 px-3 text-sm text-white"
                  >
                    {Object.entries(contestAwardMeta).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <TextField label="奖项标题" value={awardForm.title} onChange={(title) => setAwardForm({ ...awardForm, title })} />
                <label className="grid gap-2 text-sm">
                  <span className="font-bold text-white">关联题目</span>
                  <select
                    value={awardForm.problemId}
                    onChange={(event) => setAwardForm({ ...awardForm, problemId: event.target.value })}
                    className="h-11 border border-white/10 bg-black/20 px-3 text-sm text-white"
                  >
                    <option value="">全场奖项</option>
                    {problems.map((problem) => <option key={problem.id} value={problem.id}>{problem.source} · {problem.title}</option>)}
                  </select>
                </label>
                <TextField label="加分" type="number" value={String(awardForm.points)} onChange={(points) => setAwardForm({ ...awardForm, points: Number(points) })} />
                <TextField label="solutionId（可选）" value={awardForm.solutionId} onChange={(solutionId) => setAwardForm({ ...awardForm, solutionId })} />
                <TextField label="userId（可选）" value={awardForm.userId} onChange={(userId) => setAwardForm({ ...awardForm, userId })} />
                <div className="md:col-span-2">
                  <TextArea label="获奖理由" value={awardForm.reason} onChange={(reason) => setAwardForm({ ...awardForm, reason })} rows={4} />
                </div>
              </div>
              <button
                type="button"
                onClick={addAward}
                disabled={saving}
                className="mt-5 inline-flex h-10 items-center justify-center gap-2 bg-amber-300 px-4 text-sm font-bold text-zinc-950 disabled:opacity-50"
              >
                <CheckCircle2 className="size-4" />
                标记奖项
              </button>
            </section>
          </>
        )}

        <section className="border border-white/10 bg-black/20 p-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <RefreshCw className="size-3.5" />
            如果保存失败，通常是线上数据库还没执行 contest migration，或当前账号不是 admin/moderator。
          </div>
        </section>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-bold text-white">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-cyan-400/50"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-bold text-white">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="resize-y border border-white/10 bg-black/20 px-3 py-2 text-sm leading-6 text-white outline-none focus:border-cyan-400/50"
      />
    </label>
  );
}
