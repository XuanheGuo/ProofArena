"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock, HelpCircle, LogIn, Timer, Unlock, XCircle } from "lucide-react";
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
  needsReview?: boolean;
  score: number | null;
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
  | { phase: "submitted"; isCorrect: boolean; elapsedMs: number; score: number; title: string; statement: string[] }
  // fill_blank answer received but didn't match any key — admin will review.
  | { phase: "pending-review"; elapsedMs: number; title: string; statement: string[] };

function toPanelState(status: AttemptStatus): PanelState {
  if (!status.unlocked) return { phase: "locked" };
  const title = status.title ?? "";
  const statement = status.statement ?? [];
  if (status.submittedAt) {
    if (status.needsReview || status.isCorrect === null) {
      return { phase: "pending-review", elapsedMs: status.elapsedMs ?? 0, title, statement };
    }
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

// Compact circular timer ring rendered with an SVG stroke-dashoffset trick.
function TimerRing({ remaining, total }: { remaining: number; total: number }) {
  const r = 22;
  const circumference = 2 * Math.PI * r;
  const fraction = total > 0 ? Math.max(0, remaining / total) : 0;
  const offset = circumference * (1 - fraction);
  const color = fraction > 0.4 ? "text-amber-400" : fraction > 0.15 ? "text-orange-400" : "text-red-400";
  return (
    <svg width={56} height={56} viewBox="0 0 56 56" className={color} aria-hidden>
      {/* track */}
      <circle cx={28} cy={28} r={r} fill="none" stroke="currentColor" strokeWidth={3} opacity={0.15} />
      {/* progress */}
      <circle
        cx={28} cy={28} r={r} fill="none"
        stroke="currentColor" strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 28 28)"
        style={{ transition: "stroke-dashoffset 0.9s linear" }}
      />
    </svg>
  );
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
      if (body.needsReview || body.isCorrect === null) {
        setState({ phase: "pending-review", elapsedMs: body.elapsedMs ?? 0, title, statement });
      } else {
        setState({
          phase: "submitted",
          isCorrect: Boolean(body.isCorrect),
          elapsedMs: body.elapsedMs ?? 0,
          score: body.score ?? 0,
          title,
          statement,
        });
      }
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

  const showProblemFace =
    state.phase === "unlocked" ||
    state.phase === "submitted" ||
    state.phase === "pending-review";

  return (
    <div className="overflow-hidden border border-amber-400/20 bg-zinc-950">
      {/* Header bar */}
      <div className="flex items-center gap-2 border-b border-amber-400/15 bg-amber-400/[0.04] px-5 py-3">
        <Timer className="size-4 text-amber-400" />
        <span className="text-sm font-bold text-amber-200">计时题</span>
        <span className="ml-auto font-mono text-xs text-zinc-500">
          满分 <span className="text-amber-300">{scoreMax}</span> 分
          {timeLimitSeconds ? <> · 限时 <span className="text-amber-300">{timeLimitSeconds}s</span></> : null}
        </span>
      </div>

      <div className="p-5">
        {/* Problem face — only shown after personal unlock */}
        {showProblemFace && (
          <div className="mb-5 space-y-2 border-b border-white/[0.07] pb-5">
            {(state.phase === "unlocked" || state.phase === "submitted" || state.phase === "pending-review") && state.title && (
              <h2 className="text-base font-bold leading-snug text-white">{state.title}</h2>
            )}
            <div className="space-y-2 text-sm leading-7 text-zinc-200">
              {(state.phase === "unlocked" || state.phase === "submitted" || state.phase === "pending-review") &&
                state.statement.map((line, index) => (
                  <p key={index}><MathBlock>{line}</MathBlock></p>
                ))}
            </div>
          </div>
        )}

        {/* State-specific body */}
        {state.phase === "checking-auth" || state.phase === "loading-status" ? (
          <div className="flex flex-col gap-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-white/[0.05]" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-white/[0.04]" />
            <div className="mt-2 h-10 w-32 animate-pulse rounded bg-white/[0.03]" />
          </div>

        ) : state.phase === "logged-out" ? (
          <div className="flex items-start gap-3 rounded border border-amber-400/20 bg-amber-400/[0.04] px-4 py-3.5">
            <LogIn className="mt-0.5 size-4 shrink-0 text-amber-400" />
            <p className="text-sm leading-6 text-zinc-400">
              <Link href="/auth/login" className="font-bold text-cyan-300 hover:underline">登录</Link>
              {" "}后可以解锁并作答计时题。解锁后计时即刻开始，期间不要刷新页面。
            </p>
          </div>

        ) : state.phase === "error" ? (
          <div className="flex items-center gap-2 text-sm text-red-300">
            <AlertCircle className="size-4 shrink-0" />
            {state.message}
          </div>

        ) : state.phase === "locked" ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm leading-6 text-zinc-400">
              点击下方按钮后，题面立即显示，<span className="text-amber-300">计时同步开始</span>。
              确认准备好后再解锁，计时不可暂停。
            </p>
            <button
              type="button"
              onClick={handleUnlock}
              disabled={unlocking}
              className="inline-flex h-11 w-fit items-center gap-2 bg-amber-400 px-6 text-sm font-bold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-50"
            >
              <Unlock className="size-4" />
              {unlocking ? "解锁中…" : "解锁并开始计时"}
            </button>
          </div>

        ) : state.phase === "unlocked" ? (
          <div className="space-y-5">
            {/* Live countdown */}
            <div className="flex items-center gap-4">
              {timeLimitSeconds !== null && remainingSeconds !== null && (
                <div className="relative">
                  <TimerRing remaining={remainingSeconds} total={timeLimitSeconds} />
                  <span
                    className={`absolute inset-0 flex items-center justify-center font-mono text-sm font-bold tabular-nums ${
                      remainingSeconds === 0 ? "text-red-400" : remainingSeconds <= timeLimitSeconds * 0.15 ? "text-orange-400" : "text-amber-300"
                    }`}
                  >
                    {remainingSeconds}
                  </span>
                </div>
              )}
              <div>
                {remainingSeconds === 0 ? (
                  <p className="text-sm font-bold text-red-400">已超时</p>
                ) : remainingSeconds !== null && remainingSeconds <= timeLimitSeconds! * 0.25 ? (
                  <p className="text-sm font-bold text-orange-400">剩余时间不多了！</p>
                ) : (
                  <p className="text-sm text-zinc-400">
                    {remainingSeconds === null ? "—" : `剩余 ${remainingSeconds} 秒`}
                    {remainingSeconds === 0 && "，提交将得 0 分"}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-zinc-600">
                  成绩由服务器时钟计算，此倒计时仅供参考
                </p>
              </div>
            </div>

            {/* Answer input */}
            {answerType === "fill_blank" ? (
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wide text-zinc-500">
                  填写答案
                </label>
                <input
                  type="text"
                  value={fillBlankAnswer}
                  onChange={(event) => setFillBlankAnswer(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !submitting) {
                      event.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="例：sqrt(5) 或 √5；分数写 3/4"
                  className="h-11 w-full max-w-sm border border-white/10 bg-black/30 px-3 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-amber-400/50 focus:bg-black/40"
                  autoFocus
                />
                {answerFormatNote && (
                  <p className="text-xs leading-5 text-zinc-500">{answerFormatNote}</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wide text-zinc-500">
                  {answerType === "multiple_choice" ? "多选（可选多个）" : "选择答案"}
                </label>
                <div className="flex flex-wrap gap-2">
                  {CHOICE_OPTIONS.map((choice) => {
                    const active = selectedChoices.includes(choice);
                    return (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => toggleChoice(choice)}
                        className={`size-12 border text-base font-bold transition ${
                          active
                            ? "border-amber-400 bg-amber-400 text-zinc-950 shadow-[0_0_12px] shadow-amber-400/30"
                            : "border-white/15 text-zinc-300 hover:border-amber-400/50 hover:bg-amber-400/[0.07]"
                        }`}
                      >
                        {choice}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || (answerType === "fill_blank" ? !fillBlankAnswer.trim() : selectedChoices.length === 0)}
              className="inline-flex h-11 items-center gap-2 border border-amber-400/50 bg-amber-400/10 px-6 text-sm font-bold text-amber-200 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "提交中…" : "提交答案"}
            </button>
          </div>

        ) : state.phase === "pending-review" ? (
          /* fill_blank answer received but not matched — pending human review */
          <div className="space-y-4">
            <div className="flex items-start gap-3 border border-sky-500/30 bg-sky-500/[0.06] px-4 py-4">
              <HelpCircle className="mt-0.5 size-5 shrink-0 text-sky-400" />
              <div className="text-sm">
                <p className="font-bold text-sky-300">答案已收到，待人工复核</p>
                <p className="mt-1 leading-5 text-zinc-400">
                  你的答案没有匹配到标准形式，不代表一定错误——可能是写法不同。
                  管理员复核后会更新得分，请关注最终积分榜。
                </p>
                <p className="mt-2 text-xs text-zinc-600">
                  用时 {(state.elapsedMs / 1000).toFixed(1)} 秒
                </p>
              </div>
            </div>
          </div>

        ) : (
          /* submitted — correct or wrong */
          <div className="space-y-4">
            <div
              className={`flex items-start gap-3 border px-4 py-4 ${
                state.isCorrect
                  ? "border-emerald-500/35 bg-emerald-500/[0.06]"
                  : "border-red-500/35 bg-red-500/[0.06]"
              }`}
            >
              {state.isCorrect ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
              ) : (
                <XCircle className="mt-0.5 size-5 shrink-0 text-red-400" />
              )}
              <div className="text-sm">
                <p className={`text-base font-bold ${state.isCorrect ? "text-emerald-300" : "text-red-300"}`}>
                  {state.isCorrect ? "回答正确！" : "回答错误"}
                </p>
                <p className="mt-1 text-zinc-400">
                  用时 <span className="tabular-nums text-white">{(state.elapsedMs / 1000).toFixed(1)}</span> 秒
                  {" · "}得分{" "}
                  <span className={`font-mono font-bold tabular-nums ${state.isCorrect ? "text-amber-300" : "text-zinc-500"}`}>
                    {state.score}
                  </span>
                  {" "}/ {scoreMax}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
