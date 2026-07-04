"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Star } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import type { User } from "@supabase/supabase-js";

type RatingDim = "correctness" | "clarity" | "elegance" | "insight" | "exam_usability";

const DIMS: Array<{ key: RatingDim; label: string; description: string }> = [
  { key: "correctness",    label: "正确性",    description: "推理严密，结论可靠" },
  { key: "clarity",        label: "清晰度",    description: "步骤清楚，容易跟读" },
  { key: "elegance",       label: "优雅度",    description: "转化自然，结构简洁" },
  { key: "insight",        label: "启发性",    description: "带来新的思考角度" },
  { key: "exam_usability", label: "考试可用",  description: "考场中切实可行" },
];

type RatingRow = Record<RatingDim, number>;
type AverageRating = RatingRow & { count: number };

function StarInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  const display = disabled ? value : (hovered || value);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onMouseEnter={() => !disabled && setHovered(n)}
          onMouseLeave={() => !disabled && setHovered(0)}
          onClick={() => !disabled && onChange(n)}
          className="group p-0.5 outline-none focus-visible:ring-1 focus-visible:ring-amber-400 disabled:cursor-default"
          aria-label={`${n} 分`}
        >
          <Star
            className={`size-5 transition-all duration-100 ${
              n <= display
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-zinc-600 group-hover:text-amber-400/50"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

function ScoreBadge({ value, label }: { value: number; label: string }) {
  const pct = value / 5;
  const color =
    pct >= 0.8 ? "text-emerald-300" :
    pct >= 0.6 ? "text-amber-300" :
    "text-zinc-300";
  return (
    <div className="flex flex-col items-center gap-1 py-3">
      <span className={`font-mono text-lg font-bold leading-none ${color}`}>
        {value.toFixed(1)}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-zinc-600">{label}</span>
    </div>
  );
}

export function SolutionRatingPanel({
  solutionId,
  authorId,
}: {
  solutionId: string;
  authorId?: string | null;
}) {
  const supabase = createClient();
  const [user, setUser]             = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingRatings, setLoadingRatings] = useState(true);
  const [average, setAverage]       = useState<AverageRating | null>(null);
  const [myRating, setMyRating]     = useState<RatingRow | null>(null);
  const [draft, setDraft]           = useState<RatingRow>({ correctness: 0, clarity: 0, elegance: 0, insight: 0, exam_usability: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState("");
  const [open, setOpen]             = useState(false);

  const isOwn   = Boolean(user && authorId && user.id === authorId);
  const canRate = Boolean(user) && !isOwn;
  const total   = average ? Object.values(average).slice(0, -1).reduce((s, v) => s + v, 0) : null;
  const allFilled = DIMS.every((d) => draft[d.key] > 0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoadingUser(false);
    });
  }, [supabase]);

  useEffect(() => { void refresh(); }, [solutionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    supabase
      .from("solution_ratings")
      .select("correctness,clarity,elegance,insight,exam_usability")
      .eq("solution_id", solutionId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) { setMyRating(data as RatingRow); setDraft(data as RatingRow); }
      });
  }, [user, solutionId, supabase]);

  async function refresh() {
    setLoadingRatings(true);
    const { data } = await supabase
      .from("solution_ratings")
      .select("correctness,clarity,elegance,insight,exam_usability")
      .eq("solution_id", solutionId);
    setLoadingRatings(false);
    if (!data || data.length === 0) { setAverage(null); return; }
    const count = data.length;
    const zero: RatingRow = { correctness: 0, clarity: 0, elegance: 0, insight: 0, exam_usability: 0 };
    const sum = data.reduce((acc, r) => {
      const row = r as RatingRow;
      return { correctness: acc.correctness + row.correctness, clarity: acc.clarity + row.clarity, elegance: acc.elegance + row.elegance, insight: acc.insight + row.insight, exam_usability: acc.exam_usability + row.exam_usability };
    }, zero);
    setAverage({ correctness: sum.correctness / count, clarity: sum.clarity / count, elegance: sum.elegance / count, insight: sum.insight / count, exam_usability: sum.exam_usability / count, count });
  }

  async function handleSubmit() {
    if (!canRate || !allFilled) return;
    setSubmitting(true);
    setError("");
    const base = { solution_id: solutionId, user_id: user!.id, ...draft };
    const { error: err } = myRating
      ? await supabase.from("solution_ratings").update({ ...draft, updated_at: new Date().toISOString() }).eq("solution_id", solutionId).eq("user_id", user!.id)
      : await supabase.from("solution_ratings").insert(base);
    setSubmitting(false);
    if (err) { setError(err.message || "提交失败，请重试。"); return; }
    setMyRating(draft);
    setSubmitted(true);
    setOpen(false);
    await refresh();
    setTimeout(() => setSubmitted(false), 3000);
  }

  return (
    <div className="overflow-hidden border border-white/10 bg-zinc-950">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-zinc-200">社区评分</span>
          {loadingRatings ? (
            <span className="h-4 w-20 animate-pulse rounded bg-white/10" />
          ) : average ? (
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-base font-bold text-amber-300">{total?.toFixed(1)}</span>
              <span className="text-xs text-zinc-600">/ 25</span>
              <span className="text-xs text-zinc-500">·</span>
              <span className="text-xs text-zinc-500">{average.count} 人</span>
            </div>
          ) : (
            <span className="text-xs text-zinc-600">暂无评分</span>
          )}
          {submitted && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="size-3" />已提交
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!loadingUser && isOwn && (
            <span className="text-xs text-zinc-600">不可给自己的解法评分</span>
          )}
          {!loadingUser && !user && (
            <a href="/auth/login" className="text-xs text-cyan-400 hover:text-cyan-300">
              登录后评分
            </a>
          )}
          {!loadingUser && canRate && (
            <button
              type="button"
              onClick={() => { setOpen((v) => !v); setError(""); }}
              className={`inline-flex h-7 items-center gap-1.5 border px-3 text-xs font-bold transition ${
                open
                  ? "border-amber-400/60 bg-amber-400/10 text-amber-200"
                  : "border-amber-400/25 text-amber-300 hover:border-amber-400/50 hover:bg-amber-400/[0.07]"
              }`}
            >
              {myRating ? "修改评分" : open ? "取消" : "评分"}
            </button>
          )}
        </div>
      </div>

      {/* Score breakdown */}
      {!loadingRatings && average && !open && (
        <div className="grid grid-cols-5 divide-x divide-white/[0.07] border-t border-white/[0.07]">
          {DIMS.map((dim) => (
            <ScoreBadge key={dim.key} value={average[dim.key]} label={dim.label} />
          ))}
        </div>
      )}

      {/* Rating form */}
      {open && canRate && (
        <div className="border-t border-white/10 bg-black/30 px-5 py-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              {myRating ? "你已评过分，修改后重新提交" : "五个维度各 1–5 颗星"}
            </p>
            {myRating && (
              <span className="text-[10px] uppercase tracking-wide text-zinc-600">已评过</span>
            )}
          </div>

          <div className="space-y-4">
            {DIMS.map((dim) => (
              <div key={dim.key} className="grid grid-cols-[5rem_auto_1fr] items-center gap-3">
                <span className="text-xs font-bold text-zinc-300">{dim.label}</span>
                <StarInput
                  value={draft[dim.key]}
                  onChange={(v) => setDraft((prev) => ({ ...prev, [dim.key]: v }))}
                  disabled={submitting}
                />
                <span className="hidden text-xs leading-none text-zinc-600 sm:block">{dim.description}</span>
              </div>
            ))}
          </div>

          {error && (
            <p className="mt-3 text-xs text-red-400">{error}</p>
          )}

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !allFilled}
              className="inline-flex h-9 items-center gap-2 bg-amber-400 px-5 text-xs font-bold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "提交中…" : myRating ? "更新评分" : "提交评分"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError(""); }}
              className="text-xs text-zinc-500 hover:text-zinc-200"
            >
              取消
            </button>
            {!allFilled && (
              <span className="text-xs text-zinc-600">请为所有维度打分</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
