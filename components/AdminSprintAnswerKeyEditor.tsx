"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, KeyRound, Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import type { ContestAnswerType } from "@/lib/types";

// Per-sprint-problem standard answer editor, embedded inline in
// AdminContestsView's schedule row for any contest_problem with
// problem_phase = "sprint" or timed_mode_enabled = true. Reads/writes
// contest_problem_answer_keys directly via the browser Supabase client —
// same pattern every other write in AdminContestsView already uses. That
// table's RLS ("Moderators can manage sprint answer keys", migration 013)
// has no "viewable by everyone" policy at all, so this component only ever
// works for an authenticated admin/moderator session; anyone else's request
// is denied at the database layer regardless of what this component renders.
//
// This is the ONLY place in the app that ever reads answer_key — never
// import this into a public page, and never pass its state up to a parent
// that might render it outside the admin surface.

type AnswerKeyRow = {
  contest_problem_id: string;
  answer_type: ContestAnswerType;
  answer_key: unknown;
  format_note: string;
};

function answerKeyToLines(value: unknown): string {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string").join("\n");
  }
  if (typeof value === "string") return value;
  return "";
}

function linesToAnswerKey(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function AdminSprintAnswerKeyEditor({
  contestProblemId,
  defaultAnswerType,
}: {
  contestProblemId: string;
  defaultAnswerType: ContestAnswerType | null;
}) {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<AnswerKeyRow | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [answerType, setAnswerType] = useState<ContestAnswerType>(defaultAnswerType ?? "single_choice");
  const [answerLines, setAnswerLines] = useState("");
  const [formatNote, setFormatNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestProblemId]);

  async function load() {
    setLoading(true);
    setError("");

    const { data, error: loadError } = await supabase
      .from("contest_problem_answer_keys")
      .select("contest_problem_id, answer_type, answer_key, format_note")
      .eq("contest_problem_id", contestProblemId)
      .maybeSingle();

    setLoading(false);
    if (loadError) {
      setError(loadError.message || "加载答案 key 失败。");
      return;
    }

    if (data) {
      const row = data as AnswerKeyRow;
      setExisting(row);
      setAnswerType(row.answer_type);
      setAnswerLines(answerKeyToLines(row.answer_key));
      setFormatNote(row.format_note ?? "");
    } else {
      setExisting(null);
      setAnswerType(defaultAnswerType ?? "single_choice");
      setAnswerLines("");
      setFormatNote("");
    }
  }

  async function save() {
    const answers = linesToAnswerKey(answerLines);
    if (answers.length === 0) {
      setError("标准答案不能为空——每行至少填写一个可接受答案；如需清空请用下面的「清空答案 key」按钮，避免误清空。");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const { error: upsertError } = await supabase.from("contest_problem_answer_keys").upsert(
      {
        contest_problem_id: contestProblemId,
        answer_type: answerType,
        answer_key: answers,
        format_note: formatNote.trim(),
      },
      { onConflict: "contest_problem_id" },
    );

    setSaving(false);
    if (upsertError) {
      setError(upsertError.message || "保存答案 key 失败。");
      return;
    }
    setMessage("答案 key 已保存。");
    await load();
  }

  async function clearKey() {
    setSaving(true);
    setError("");
    setMessage("");

    const { error: deleteError } = await supabase
      .from("contest_problem_answer_keys")
      .delete()
      .eq("contest_problem_id", contestProblemId);

    setSaving(false);
    if (deleteError) {
      setError(deleteError.message || "清空答案 key 失败。");
      return;
    }
    setMessage("答案 key 已清空。");
    await load();
  }

  if (loading) {
    return <div className="h-7 w-28 animate-pulse bg-white/[0.03]" />;
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className={`inline-flex h-7 items-center gap-1.5 border px-2 text-[11px] font-bold transition ${
          existing
            ? "border-emerald-500/40 bg-emerald-500/[0.07] text-emerald-300 hover:bg-emerald-500/10"
            : "border-amber-400/40 bg-amber-400/[0.07] text-amber-300 hover:bg-amber-400/10"
        }`}
      >
        <KeyRound className="size-3" />
        {existing ? "答案已配置" : "答案未配置"}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 border border-white/10 bg-black/20 p-3">
          {!existing && (
            <div className="flex items-start gap-2 text-[11px] text-amber-300">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              这道计时题还没有标准答案，参赛者提交后会一律判错。
            </div>
          )}

          <label className="grid gap-1 text-xs">
            <span className="font-bold text-zinc-300">答案类型</span>
            <select
              value={answerType}
              onChange={(event) => setAnswerType(event.target.value as ContestAnswerType)}
              className="h-8 border border-white/15 bg-zinc-950 px-2 text-xs text-white outline-none"
            >
              <option value="single_choice">单选</option>
              <option value="multiple_choice">多选</option>
              <option value="fill_blank">填空</option>
            </select>
          </label>

          <label className="grid gap-1 text-xs">
            <span className="font-bold text-zinc-300">标准答案（每行一个可接受答案）</span>
            <textarea
              rows={4}
              value={answerLines}
              onChange={(event) => setAnswerLines(event.target.value)}
              placeholder={
                answerType === "multiple_choice" ? "A,C" : answerType === "fill_blank" ? "3/4\n0.75" : "A"
              }
              className="resize-y border border-white/15 bg-zinc-950 px-2 py-1.5 text-xs text-white outline-none"
            />
            <span className="text-[10px] leading-4 text-zinc-600">
              {answerType === "multiple_choice"
                ? "多选可以写 A,C 或 C A，提交时会被 normalize 后比对；每行代表一个完整的正确组合。"
                : answerType === "fill_blank"
                  ? "可以写多个等价答案，每行一个，例如 3/4 和 0.75。"
                  : "每行一个可接受答案，通常只需要一行，例如 A。"}
            </span>
          </label>

          <label className="grid gap-1 text-xs">
            <span className="font-bold text-zinc-300">格式说明（可选）</span>
            <input
              type="text"
              value={formatNote}
              onChange={(event) => setFormatNote(event.target.value)}
              className="h-8 border border-white/15 bg-zinc-950 px-2 text-xs text-white outline-none"
            />
          </label>

          {error && <p className="text-[11px] text-red-300">{error}</p>}
          {message && <p className="text-[11px] text-emerald-300">{message}</p>}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex h-8 items-center gap-1.5 border border-cyan-400/30 px-3 text-xs font-bold text-cyan-300 transition hover:bg-cyan-400/10 disabled:opacity-50"
            >
              <Save className="size-3.5" />
              {saving ? "保存中…" : "保存答案 key"}
            </button>
            {existing && (
              <button
                type="button"
                onClick={clearKey}
                disabled={saving}
                className="inline-flex h-8 items-center gap-1.5 border border-red-500/30 px-3 text-xs font-bold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
                清空答案 key
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
