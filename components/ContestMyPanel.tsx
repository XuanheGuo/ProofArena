"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Lock, LogIn, MessageSquareText, Timer, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import { formatContestDateTime } from "@/lib/format-contest-time";
import type { Contest, ContestProblem } from "@/lib/types";

type SubmissionStatus = "pending" | "approved" | "rejected" | "needs_revision";

type MySubmission = {
  id: string;
  problemId: string | null;
  draftProblemId: string | null;
  contestProblemKey: string | null;
  status: SubmissionStatus;
  createdAt: string;
  isPostContest: boolean;
};

type MyScore = {
  contestProblemId: string;
  problemPhase: string;
  rawScore: number;
  scoreMax: number;
  judgeNote: string;
  scoredAt: string | null;
};

type MySprintAttempt = {
  contestProblemId: string;
  unlockAt: string;
  submittedAt: string | null;
  elapsedMs: number | null;
  isCorrect: boolean | null;
  score: number;
};

// Shape returned by GET /api/contests/[slug]/me — see that route's own doc
// comment for why this goes through a server route instead of a direct
// Supabase query: contest_sprint_attempts has no client-facing RLS at all
// (migration 013), so a browser query for "my own attempt" would just come
// back empty even for the attempt's own owner.
type MeSummary = {
  submissions: MySubmission[];
  scores: MyScore[];
  participantProfile: {
    challengeScore: number;
    challengeMultiplier: number;
    multiplierReason: string;
    penaltyPoints: number;
    penaltyReason: string;
  } | null;
  sprintAttempts: MySprintAttempt[];
  awardPoints: number;
};

const statusMeta: Record<SubmissionStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "待审核", className: "border-amber-400/40 bg-amber-400/[0.07] text-amber-300", icon: Clock },
  approved: { label: "已通过", className: "border-emerald-500/40 bg-emerald-500/[0.07] text-emerald-300", icon: CheckCircle2 },
  rejected: { label: "已拒绝", className: "border-red-500/40 bg-red-500/[0.07] text-red-300", icon: XCircle },
  needs_revision: { label: "需修改", className: "border-cyan-400/40 bg-cyan-400/[0.07] text-cyan-300", icon: MessageSquareText },
};

function matchesContestProblem(sub: MySubmission, cp: ContestProblem) {
  if (sub.contestProblemKey === cp.id) return true;
  if (sub.problemId && sub.problemId === cp.problemId) return true;
  if (sub.draftProblemId && sub.draftProblemId === cp.draftProblemId) return true;
  return false;
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border border-white/10 bg-black/20 px-3 py-2 text-center">
      <strong className={`block font-mono text-base font-bold tabular-nums ${accent ? "text-amber-300" : "text-white"}`}>
        {value}
      </strong>
      <span className="mt-0.5 block text-[10px] text-zinc-500">{label}</span>
    </div>
  );
}

export function ContestMyPanel({
  contest,
  problemTitles,
}: {
  contest: Contest;
  problemTitles: Record<string, string>;
}) {
  const supabase = createClient();
  const [user, setUser] = useState<{ id: string } | null | undefined>(undefined);
  const [summary, setSummary] = useState<MeSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setLoadError("");
    fetch(`/api/contests/${contest.slug}/me`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setLoadError(body.error || "无法加载参赛状态。");
          setLoading(false);
          return;
        }
        setSummary((await res.json()) as MeSummary);
        setLoading(false);
      })
      .catch(() => {
        setLoadError("网络错误，无法加载参赛状态。");
        setLoading(false);
      });
  }, [user, contest.slug]);

  // Still checking auth
  if (user === undefined) return null;

  if (user === null) {
    return (
      <section className="border border-white/10 bg-zinc-950 p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <MessageSquareText className="size-4 text-zinc-400" />
          我的参赛状态
        </div>
        <div className="mt-4 flex items-center gap-3 border border-amber-400/20 bg-amber-400/[0.04] px-4 py-3">
          <LogIn className="size-4 shrink-0 text-amber-400" />
          <p className="text-sm text-zinc-400">
            <Link href="/auth/login" className="font-bold text-cyan-300 hover:underline">登录</Link>
            {" "}后可以查看你在本场比赛的分项进度。
          </p>
        </div>
      </section>
    );
  }

  const submissions = summary?.submissions ?? [];
  const scores = summary?.scores ?? [];
  const sprintAttempts = summary?.sprintAttempts ?? [];
  const challengeMultiplier = summary?.participantProfile?.challengeMultiplier ?? 1;
  const penaltyPoints = summary?.participantProfile?.penaltyPoints ?? 0;
  const awardPoints = summary?.awardPoints ?? 0;

  const dailyRawScore = scores.filter((s) => s.problemPhase === "daily").reduce((sum, s) => sum + s.rawScore, 0);
  const majorScore = scores.filter((s) => s.problemPhase === "major").reduce((sum, s) => sum + s.rawScore, 0);
  const sprintScore = sprintAttempts.reduce((sum, a) => sum + a.score, 0);
  const dailyFinalScore = dailyRawScore * challengeMultiplier;
  const totalScore = dailyFinalScore + sprintScore + majorScore + awardPoints - penaltyPoints;

  const hasAnyScoring = scores.length > 0 || sprintAttempts.length > 0 || summary?.participantProfile;

  const totalSubs = submissions.filter((s) => !s.isPostContest).length;
  const approvedSubs = submissions.filter((s) => s.status === "approved").length;

  return (
    <section className="border border-white/10 bg-zinc-950 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-white">
          <MessageSquareText className="size-4 text-cyan-300" />
          我的参赛状态
        </div>
        <div className="text-xs text-zinc-500">
          {totalSubs > 0 && `${totalSubs} 份投稿${approvedSubs > 0 ? `，${approvedSubs} 份已通过` : ""}`}
        </div>
      </div>

      {loadError && <p className="mt-3 text-xs text-red-300">{loadError}</p>}

      {loading ? (
        <div className="mt-4 space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-12 animate-pulse bg-white/[0.03]" />)}
        </div>
      ) : (
        <>
          {hasAnyScoring && (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
              <Stat label="普通题原始分" value={dailyRawScore.toFixed(1)} />
              <Stat label="挑战倍率" value={`${challengeMultiplier.toFixed(2)}x`} />
              <Stat label="普通题结算分" value={dailyFinalScore.toFixed(1)} accent />
              <Stat label="计时题分" value={sprintScore.toFixed(1)} />
              <Stat label="大题分" value={majorScore.toFixed(1)} />
              <Stat label="总分" value={totalScore.toFixed(1)} accent />
            </div>
          )}

          <div className="mt-4 space-y-2">
            {contest.problems.map((cp) => {
              const title = cp.problemId
                ? (problemTitles[cp.problemId] ?? null)
                : cp.draftProblemId
                  ? (problemTitles[cp.draftProblemId] ?? null)
                  : null;

              if (cp.problemPhase === "sprint") {
                const attempt = sprintAttempts.find((a) => a.contestProblemId === cp.id);
                const sprintBadge = !attempt
                  ? { label: "未解锁", className: "border-white/10 text-zinc-500", icon: Lock }
                  : !attempt.submittedAt
                    ? { label: "已解锁", className: "border-amber-400/40 bg-amber-400/[0.07] text-amber-300", icon: Timer }
                    : {
                        label: `已提交 · ${attempt.score} 分`,
                        className: attempt.isCorrect
                          ? "border-emerald-500/40 bg-emerald-500/[0.07] text-emerald-300"
                          : "border-red-500/40 bg-red-500/[0.07] text-red-300",
                        icon: attempt.isCorrect ? CheckCircle2 : XCircle,
                      };
                const SprintIcon = sprintBadge.icon;
                return (
                  <div
                    key={cp.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border border-white/[0.07] bg-black/20 px-4 py-3"
                  >
                    <span className="shrink-0 border border-cyan-400/25 bg-cyan-400/[0.06] px-2 py-0.5 font-mono text-xs font-bold text-cyan-300">
                      Day {cp.dayIndex}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">{title ?? cp.title}</p>
                      {attempt?.submittedAt && (
                        <p className="mt-0.5 text-[11px] text-zinc-600">
                          用时 {attempt.elapsedMs != null ? `${(attempt.elapsedMs / 1000).toFixed(1)}s` : "—"} · 提交于 {formatContestDateTime(attempt.submittedAt)}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 border px-2 py-0.5 text-[11px] font-bold ${sprintBadge.className}`}>
                      <SprintIcon className="size-3" />
                      {sprintBadge.label}
                    </span>
                  </div>
                );
              }

              const mySubs = submissions.filter((s) => matchesContestProblem(s, cp));
              const officialSubs = mySubs.filter((s) => !s.isPostContest);
              const latestSub = mySubs[0];
              const bestStatus = officialSubs.find((s) => s.status === "approved")?.status
                ?? officialSubs.find((s) => s.status === "needs_revision")?.status
                ?? officialSubs.find((s) => s.status === "pending")?.status
                ?? officialSubs[0]?.status
                ?? null;
              const meta = bestStatus ? statusMeta[bestStatus] : null;
              const StatusIcon = meta?.icon;
              const scoreRow = scores.find((s) => s.contestProblemId === cp.id);

              return (
                <div
                  key={cp.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border border-white/[0.07] bg-black/20 px-4 py-3"
                >
                  <span className="shrink-0 border border-cyan-400/25 bg-cyan-400/[0.06] px-2 py-0.5 font-mono text-xs font-bold text-cyan-300">
                    Day {cp.dayIndex}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">
                      {title ?? cp.title}
                    </p>
                    {latestSub && (
                      <p className="mt-0.5 text-[11px] text-zinc-600">
                        {mySubs.length} 次投稿 · 最近：{formatContestDateTime(latestSub.createdAt)}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {scoreRow ? (
                      <span className="inline-flex items-center gap-1 border border-emerald-500/40 bg-emerald-500/[0.07] px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                        <CheckCircle2 className="size-3" />
                        已评分 · {scoreRow.rawScore}/{scoreRow.scoreMax}
                      </span>
                    ) : meta && StatusIcon ? (
                      <span className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[11px] font-bold ${meta.className}`}>
                        <StatusIcon className="size-3" />
                        {meta.label}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-600">未提交</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="mt-3 text-[11px] leading-5 text-zinc-600">
        仅显示你自己的投稿和评分状态，其他参赛者的投稿在结束前不可见。
      </p>
    </section>
  );
}
