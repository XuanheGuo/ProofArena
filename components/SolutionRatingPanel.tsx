"use client";

import { useEffect, useState } from "react";
import { Star, ThumbsUp } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import type { User } from "@supabase/supabase-js";

type RatingDim = "correctness" | "clarity" | "elegance" | "insight" | "exam_usability";

const DIMS: Array<{ key: RatingDim; label: string; description: string }> = [
  { key: "correctness", label: "正确性", description: "推理和结论是否可靠" },
  { key: "clarity", label: "清晰度", description: "步骤是否容易跟读" },
  { key: "elegance", label: "优雅度", description: "思路是否简洁漂亮" },
  { key: "insight", label: "启发性", description: "能否带来新的思考角度" },
  { key: "exam_usability", label: "考试可用性", description: "在考场中是否实用" },
];

type RatingRow = {
  correctness: number;
  clarity: number;
  elegance: number;
  insight: number;
  exam_usability: number;
};

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
  const display = hovered || value;

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onMouseEnter={() => !disabled && setHovered(n)}
          onMouseLeave={() => !disabled && setHovered(0)}
          onClick={() => !disabled && onChange(n)}
          className="p-0.5 disabled:cursor-default"
          aria-label={`${n} 分`}
        >
          <Star
            className={`size-4 transition ${
              n <= display
                ? "fill-amber-400 text-amber-400"
                : "fill-transparent text-zinc-600"
            } ${!disabled ? "hover:text-amber-300" : ""}`}
          />
        </button>
      ))}
      <span className="ml-1 w-6 text-right text-xs text-zinc-500">{value > 0 ? value : "—"}</span>
    </div>
  );
}

export function SolutionRatingPanel({
  solutionId,
  authorId,
  initialAverage,
}: {
  solutionId: string;
  authorId?: string | null;
  initialAverage?: AverageRating | null;
}) {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [average, setAverage] = useState<AverageRating | null>(initialAverage ?? null);
  const [myRating, setMyRating] = useState<RatingRow | null>(null);
  const [draft, setDraft] = useState<RatingRow>({
    correctness: 0,
    clarity: 0,
    elegance: 0,
    insight: 0,
    exam_usability: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  const isOwnSolution = Boolean(user && authorId && user.id === authorId);
  const canRate = Boolean(user) && !isOwnSolution;
  const total = average
    ? average.correctness + average.clarity + average.elegance + average.insight + average.exam_usability
    : null;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoadingUser(false);
    });
  }, [supabase]);

  useEffect(() => {
    if (!initialAverage) {
      void loadAverage();
    }
  }, [solutionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    supabase
      .from("solution_ratings")
      .select("correctness,clarity,elegance,insight,exam_usability")
      .eq("solution_id", solutionId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const row = data as RatingRow;
          setMyRating(row);
          setDraft(row);
        }
      });
  }, [user, solutionId, supabase]);

  async function loadAverage() {
    const { data } = await supabase
      .from("solution_ratings")
      .select("correctness,clarity,elegance,insight,exam_usability")
      .eq("solution_id", solutionId);
    if (!data || data.length === 0) {
      setAverage(null);
      return;
    }
    const count = data.length;
    const sum = data.reduce(
      (acc, row) => {
        const r = row as RatingRow;
        return {
          correctness: acc.correctness + r.correctness,
          clarity: acc.clarity + r.clarity,
          elegance: acc.elegance + r.elegance,
          insight: acc.insight + r.insight,
          exam_usability: acc.exam_usability + r.exam_usability,
        };
      },
      { correctness: 0, clarity: 0, elegance: 0, insight: 0, exam_usability: 0 }
    );
    setAverage({
      correctness: sum.correctness / count,
      clarity: sum.clarity / count,
      elegance: sum.elegance / count,
      insight: sum.insight / count,
      exam_usability: sum.exam_usability / count,
      count,
    });
  }

  async function handleSubmit() {
    if (!user || !canRate) return;
    const allFilled = DIMS.every((d) => draft[d.key] > 0);
    if (!allFilled) {
      setError("请为每个维度打分后再提交。");
      return;
    }
    setSubmitting(true);
    setError("");

    const payload = {
      solution_id: solutionId,
      user_id: user.id,
      ...draft,
    };

    const { error: upsertError } = myRating
      ? await supabase
          .from("solution_ratings")
          .update({ ...draft, updated_at: new Date().toISOString() })
          .eq("solution_id", solutionId)
          .eq("user_id", user.id)
      : await supabase.from("solution_ratings").insert(payload);

    setSubmitting(false);
    if (upsertError) {
      setError(upsertError.message || "评分提交失败，请重试。");
      return;
    }
    setMyRating(draft);
    setDone(true);
    setOpen(false);
    await loadAverage();
  }

  return (
    <div className="border border-white/10 bg-black/20">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <ThumbsUp className="size-4 text-amber-300" />
          <span className="text-sm font-bold text-white">社区评分</span>
          {average && (
            <span className="ml-1 font-mono text-sm text-amber-300">
              {total?.toFixed(1)} <span className="text-xs text-zinc-500">/ 25</span>
            </span>
          )}
          {average && (
            <span className="text-xs text-zinc-500">（{average.count} 人评分）</span>
          )}
          {!average && (
            <span className="text-xs text-zinc-500">暂无评分</span>
          )}
        </div>
        {!loadingUser && canRate && !done && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-8 items-center gap-1.5 border border-amber-400/30 px-3 text-xs font-bold text-amber-200 transition hover:bg-amber-400/10"
          >
            {myRating ? "修改评分" : "我来评分"}
          </button>
        )}
        {done && (
          <span className="text-xs text-emerald-300">评分已提交</span>
        )}
        {!loadingUser && isOwnSolution && (
          <span className="text-xs text-zinc-600">不能给自己的解法评分</span>
        )}
      </div>

      {average && (
        <div className="grid grid-cols-5 border-t border-white/10">
          {DIMS.map((dim) => (
            <div key={dim.key} className="border-r border-white/10 p-2 text-center last:border-r-0">
              <span className="block text-[10px] text-zinc-600">{dim.label}</span>
              <span className="block font-mono text-sm text-white">{average[dim.key].toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}

      {open && canRate && (
        <div className="border-t border-white/10 p-4">
          <p className="mb-4 text-xs leading-5 text-zinc-500">
            每个维度 1-5 分。{myRating ? "你已经评过分，提交后会更新。" : "全部填写后才能提交。"}
          </p>
          <div className="space-y-3">
            {DIMS.map((dim) => (
              <div key={dim.key} className="flex items-center gap-4">
                <div className="w-20 shrink-0">
                  <span className="text-xs font-bold text-white">{dim.label}</span>
                </div>
                <StarInput
                  value={draft[dim.key]}
                  onChange={(v) => setDraft((prev) => ({ ...prev, [dim.key]: v }))}
                  disabled={submitting}
                />
                <span className="hidden text-xs leading-5 text-zinc-600 sm:block">{dim.description}</span>
              </div>
            ))}
          </div>
          {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex h-9 items-center gap-2 bg-amber-300 px-4 text-xs font-bold text-zinc-950 disabled:opacity-50"
            >
              {submitting ? "提交中..." : myRating ? "更新评分" : "提交评分"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setError(""); }}
              className="inline-flex h-9 items-center px-3 text-xs text-zinc-500 hover:text-white"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {!loadingUser && !user && (
        <div className="border-t border-white/10 px-4 py-3 text-xs text-zinc-500">
          <a href="/auth/login" className="text-cyan-300 hover:underline">登录</a>后可以为解法评分
        </div>
      )}
    </div>
  );
}
