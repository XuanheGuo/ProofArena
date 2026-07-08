"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, LogIn, Timer, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { MathBlock } from "@/components/MathBlock";
import type { ContestAnswerType } from "@/lib/types";

// Timed sprint problem UI (docs/WEEKLY_CONTEST_FORMAT.md §6). Talks only to
// the two API routes — never reads/writes contest_sprint_attempts directly,
// since that table has no client-facing RLS policy at all (migration 013):
//   GET/POST /api/contests/[slug]/sprint/[contestProblemId]/unlock
//   POST     /api/contests/[slug]/sprint/[contestProblemId]/submit
// GET on the unlock route is a read-only status check, called on mount so a
// page refresh shows the already-running countdown (from the server's own
// unlock_at) instead of resetting it, and so simply visiting the page never
// silently unlocks the problem — only the explicit button click (POST) does.

const CHOICE_OPTIONS = ["A", "B", "C", "D"] as const;

type AttemptStatus = {
  unlocked: boolean;
  unlockAt: string | null;
  submittedAt: string | null;
  elapsedMs: number | null;
  isCorrect: boolean | null;
  score: number | null;
  // Only ever populated by the API once an attempt exists — see
  // lib/contest-sprint.ts resolveSprintProblemDisplay. Absent (null) in the
  // "not unlocked" state, which is exactly why this component must never
  // receive the problem statement as a prop from the server-rendered page.
  title: string | null;
  statement: string[] | null;
};

type PanelState =
  | { phase: "checking-auth" }
  | { phase: "logged-out" }
  | { phase: "loading-status" }
  | { phase: "error"; message: string }
  | { phase: "locked" }
  | { phase: "unlocked"; unlockAt: string; title: string; statement: string[] }
  | { phase: "submitted"; isCorrect: boolean; elapsedMs: number; score: number; title: string; statement: string[] };

function toPanelState(status: AttemptStatus): PanelState {
  if (!status.unlocked) return { phase: "locked" };
  const title = status.title ?? "";
  const statement = status.statement ?? [];
  if (status.submittedAt) {
    return {
      phase: "submitted",
      isCorrect: Boolean(status.isCorrect),
      elapsedMs: status.elapsedMs ?? 0,
      score: status.score ?? 0,
      title,
      statement,
    };
  }
  return { phase: "unlocked", unlockAt: status.unlockAt as string, title, statement };
}

export function ContestSprintPanel({
  contestSlug,
  contestProblemId,
  scoreMax,
  timeLimitSeconds,
  answerType,
  answerFormatNote,
}: {
  contestSlug: string;
  contestProblemId: string;
  scoreMax: number;
  timeLimitSeconds: number | null;
  answerType: ContestAnswerType | null;
  answerFormatNote: string;
}) {
  const supabase = createClient();
  const basePath = `/api/contests/${contestSlug}/sprint/${contestProblemId}`;

  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [state, setState] = useState<PanelState>({ phase: "checking-auth" });
  const [unlocking, setUnlocking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [selectedChoices, setSelectedChoices] = useState<string[]>([]);
  const [fillBlankAnswer, setFillBlankAnswer] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (userId === undefined) return;
    if (userId === null) {
      setState({ phase: "logged-out" });
      return;
    }
    setState({ phase: "loading-status" });
    fetch(basePath + "/unlock")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setState({ phase: "error", message: body.error || "无法获取计时题状态。" });
          return;
        }
        const body = (await res.json()) as AttemptStatus;
        setState(toPanelState(body));
      })
      .catch(() => setState({ phase: "error", message: "网络错误，无法获取计时题状态。" }));
  }, [userId, basePath]);

  // Tick every second while an attempt is running, purely to redraw the
  // countdown — elapsed/score are always computed authoritatively by the
  // submit route from the server's own clock, never from this timer.
  useEffect(() => {
    if (state.phase !== "unlocked") return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.phase]);

  const remainingSeconds = useMemo(() => {
    if (state.phase !== "unlocked" || !timeLimitSeconds) return null;
    const elapsedSeconds = (nowTick - new Date(state.unlockAt).getTime()) / 1000;
    return Math.max(0, Math.ceil(timeLimitSeconds - elapsedSeconds));
  }, [state, nowTick, timeLimitSeconds]);

  async function handleUnlock() {
    setUnlocking(true);
    try {
      const res = await fetch(basePath + "/unlock", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ phase: "error", message: body.error || "解锁失败，请重试。" });
        return;
      }
      setState(toPanelState(body as AttemptStatus));
    } catch {
      setState({ phase: "error", message: "网络错误，解锁失败。" });
    } finally {
      setUnlocking(false);
    }
  }

  async function handleSubmit() {
    if (state.phase !== "unlocked") return;
    const answer =
      answerType === "fill_blank"
        ? fillBlankAnswer
        : selectedChoices.slice().sort().join(",");
    if (!answer.trim()) return;

    // The submit route intentionally doesn't re-fetch/return the problem
    // face (it only grades an answer) — carry the title/statement over from
    // the current "unlocked" state instead of dropping them on submit.
    const { title, statement } = state;

    setSubmitting(true);
    try {
      const res = await fetch(basePath + "/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ phase: "error", message: body.error || "提交失败，请重试。" });
        return;
      }
      setState({
        phase: "submitted",
        isCorrect: Boolean(body.isCorrect),
        elapsedMs: body.elapsedMs ?? 0,
        score: body.score ?? 0,
        title,
        statement,
      });
    } catch {
      setState({ phase: "error", message: "网络错误，提交失败。" });
    } finally {
      setSubmitting(false);
    }
  }

  function toggleChoice(choice: string) {
    if (answerType === "single_choice") {
      setSelectedChoices([choice]);
      return;
    }
    setSelectedChoices((current) =>
      current.includes(choice) ? current.filter((c) => c !== choice) : [...current, choice],
    );
  }

  return (
    <section className="border border-amber-400/25 bg-zinc-950 p-5">
      <div className="flex items-center gap-2 text-sm font-bold text-white">
        <Timer className="size-4 text-amber-300" />
        计时题
        <span className="ml-auto text-xs font-normal text-zinc-500">
          满分 {scoreMax} 分{timeLimitSeconds ? ` · 限时 ${timeLimitSeconds} 秒` : ""}
        </span>
      </div>

      <div className="mt-4">
        {/* The problem face only ever renders here, sourced from this
            component's own state — never as a prop from the server-rendered
            page — and only once `state` is "unlocked" or "submitted" (i.e.
            the API has confirmed a personal attempt exists). */}
        {(state.phase === "unlocked" || state.phase === "submitted") && (
          <div className="mb-4 space-y-2 border-b border-white/[0.07] pb-4">
            {state.title && <h2 className="text-base font-bold text-white">{state.title}</h2>}
            <div className="space-y-2 text-sm leading-7 text-zinc-200">
              {state.statement.map((line, index) => (
                <p key={index}><MathBlock>{line}</MathBlock></p>
              ))}
            </div>
          </div>
        )}

        {state.phase === "checking-auth" || state.phase === "loading-status" ? (
          <div className="h-16 animate-pulse bg-white/[0.03]" />
        ) : state.phase === "logged-out" ? (
          <div className="flex items-center gap-3 border border-amber-400/20 bg-amber-400/[0.04] px-4 py-3">
            <LogIn className="size-4 shrink-0 text-amber-400" />
            <p className="text-sm text-zinc-400">
              <Link href="/auth/login" className="font-bold text-cyan-300 hover:underline">登录</Link>
              {" "}后可以解锁并作答计时题。
            </p>
          </div>
        ) : state.phase === "error" ? (
          <p className="text-sm text-red-300">{state.message}</p>
        ) : state.phase === "locked" ? (
          <button
            type="button"
            onClick={handleUnlock}
            disabled={unlocking}
            className="inline-flex h-10 items-center justify-center gap-2 bg-amber-300 px-5 text-sm font-bold text-zinc-950 transition hover:bg-amber-200 disabled:opacity-50"
          >
            <Clock className="size-4" />
            {unlocking ? "解锁中…" : "解锁计时题"}
          </button>
        ) : state.phase === "unlocked" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-amber-300" />
              <span className={`font-mono text-2xl font-bold tabular-nums ${remainingSeconds === 0 ? "text-red-400" : "text-amber-300"}`}>
                {remainingSeconds !== null ? `${remainingSeconds}s` : "—"}
              </span>
              {remainingSeconds === 0 && <span className="text-xs text-red-400">已超时，提交将得 0 分</span>}
            </div>

            {answerType === "fill_blank" ? (
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={fillBlankAnswer}
                  onChange={(event) => setFillBlankAnswer(event.target.value)}
                  onKeyDown={(event) => {
                    // Every second counts in a timed sprint — Enter submits
                    // directly instead of forcing a reach for the button.
                    if (event.key === "Enter" && !submitting) {
                      event.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="填写答案"
                  className="h-11 w-full max-w-xs border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-amber-400/50"
                />
                {answerFormatNote && <p className="text-xs text-zinc-500">{answerFormatNote}</p>}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {CHOICE_OPTIONS.map((choice) => {
                  const active = selectedChoices.includes(choice);
                  return (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => toggleChoice(choice)}
                      className={`h-11 w-11 border text-sm font-bold transition ${
                        active
                          ? "border-amber-300 bg-amber-300 text-zinc-950"
                          : "border-white/15 text-zinc-300 hover:border-amber-400/40"
                      }`}
                    >
                      {choice}
                    </button>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex h-10 items-center justify-center gap-2 border border-amber-400/40 bg-amber-400/10 px-5 text-sm font-bold text-amber-200 transition hover:bg-amber-400/15 disabled:opacity-50"
            >
              {submitting ? "提交中…" : "提交答案"}
            </button>
          </div>
        ) : (
          <div className={`flex items-center gap-3 border px-4 py-3 ${state.isCorrect ? "border-emerald-500/40 bg-emerald-500/[0.07]" : "border-red-500/40 bg-red-500/[0.07]"}`}>
            {state.isCorrect ? (
              <CheckCircle2 className="size-5 shrink-0 text-emerald-400" />
            ) : (
              <XCircle className="size-5 shrink-0 text-red-400" />
            )}
            <div className="text-sm">
              <p className={`font-bold ${state.isCorrect ? "text-emerald-300" : "text-red-300"}`}>
                {state.isCorrect ? "回答正确" : "回答错误"}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                用时 {(state.elapsedMs / 1000).toFixed(1)} 秒 · 得分 {state.score} / {scoreMax}
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
