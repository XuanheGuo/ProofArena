"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, HelpCircle, Save, Timer, XCircle } from "lucide-react";
import { contestProblemPhaseMeta } from "@/lib/contest-meta";
import { computeSprintStepScore } from "@/lib/contest-sprint-score";
import { createClient } from "@/lib/supabase-client";
import { formatContestDateTime } from "@/lib/format-contest-time";
import type { ContestProblemPhase } from "@/lib/types";

// Admin scoring panel for the weekly contest format
// (docs/WEEKLY_CONTEST_FORMAT.md §3-7). Kept as its own component rather
// than folded into AdminContestsView — that file already covers contest
// setup, schedule, and awards, and this adds a genuinely separate workflow
// (per-participant scoring) with its own data model.
//
// Writes go straight through the browser Supabase client, same as every
// other write in AdminContestsView — RLS on contest_submission_scores,
// contest_participant_profiles and contest_sprint_attempts ("Moderators can
// manage ...", migration 013) is what actually enforces the admin/moderator
// requirement here, not this component. Sprint attempts are auto-scored by
// the submit route; the only manual write this view does against them is the
// adjudication below (judgeSprintAttempt) — a fill_blank answer that didn't
// match any answer-key variant is stored with is_correct = null ("待人工评判",
// see the submit route's isFillBlankPending comment) and waits here for a
// moderator to rule it correct or wrong.

export type ScoringContestProblem = {
  id: string;
  day_index: number;
  title: string;
  problem_phase: ContestProblemPhase;
  score_max: number;
  time_limit_seconds: number | null;
  problem_id: string | null;
  draft_problem_id: string | null;
};

type SubmissionStatus = "pending" | "approved" | "rejected" | "needs_revision";

type SubmissionRow = {
  id: string;
  user_id: string | null;
  problem_id: string | null;
  draft_problem_id: string | null;
  contest_problem_key: string | null;
  status: SubmissionStatus;
  created_at: string;
};

type ScoreRow = {
  id: string;
  contest_problem_id: string;
  submission_id: string | null;
  user_id: string;
  problem_phase: string;
  raw_score: number;
  score_max: number;
  judge_note: string;
  scored_at: string | null;
};

type ParticipantProfileRow = {
  id: string;
  user_id: string;
  challenge_score: number;
  challenge_multiplier: number;
  multiplier_reason: string;
  penalty_points: number;
  penalty_reason: string;
};

type SprintAttemptRow = {
  id: string;
  contest_problem_id: string;
  user_id: string;
  unlock_at: string;
  submitted_at: string | null;
  elapsed_ms: number | null;
  answer_raw: string | null;
  answer_normalized: string | null;
  is_correct: boolean | null;
  score: number;
};

type ScoreEdit = { rawScore: string; judgeNote: string };
type ProfileEdit = {
  challengeScore: string;
  challengeMultiplier: string;
  multiplierReason: string;
  penaltyPoints: string;
  penaltyReason: string;
};

const submissionStatusMeta: Record<SubmissionStatus, { label: string; className: string }> = {
  pending: { label: "待审核", className: "border-amber-400/40 bg-amber-400/[0.07] text-amber-300" },
  approved: { label: "已通过", className: "border-emerald-500/40 bg-emerald-500/[0.07] text-emerald-300" },
  rejected: { label: "已拒绝", className: "border-red-500/40 bg-red-500/[0.07] text-red-300" },
  needs_revision: { label: "需修改", className: "border-cyan-400/40 bg-cyan-400/[0.07] text-cyan-300" },
};

function matchesContestProblem(sub: SubmissionRow, cp: ScoringContestProblem) {
  if (sub.contest_problem_key === cp.id) return true;
  if (sub.problem_id && sub.problem_id === cp.problem_id) return true;
  if (sub.draft_problem_id && sub.draft_problem_id === cp.draft_problem_id) return true;
  return false;
}

// Prefers an approved submission (the "best" one); otherwise falls back to
// the most recent — `subs` is already sorted newest-first by the query.
function pickSubmissionId(subs: SubmissionRow[]): string | null {
  if (subs.length === 0) return null;
  const approved = subs.find((s) => s.status === "approved");
  return (approved ?? subs[0]).id;
}

export function AdminContestScoringView({
  contestId,
  contestSlug,
  contestProblems,
}: {
  contestId: string;
  contestSlug: string;
  contestProblems: ScoringContestProblem[];
}) {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [profiles, setProfiles] = useState<ParticipantProfileRow[]>([]);
  const [sprintAttempts, setSprintAttempts] = useState<SprintAttemptRow[]>([]);
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map());

  const [scoreEdits, setScoreEdits] = useState<Record<string, ScoreEdit>>({});
  const [profileEdits, setProfileEdits] = useState<Record<string, ProfileEdit>>({});

  // Sprint problems are scored automatically by the submit API (step
  // scoring) and shown read-only below; discussion problems aren't judged
  // at all. Only these two phases get a manual score input.
  const scorableProblems = useMemo(
    () =>
      contestProblems
        .filter((cp) => cp.problem_phase !== "sprint" && cp.problem_phase !== "discussion")
        .sort((a, b) => a.day_index - b.day_index),
    [contestProblems],
  );

  useEffect(() => {
    void loadScoringData();
    // Reload whenever the admin switches to a different contest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestId]);

  async function loadScoringData() {
    setLoading(true);
    setError("");

    const [subsRes, scoresRes, profilesRes, sprintRes] = await Promise.all([
      supabase
        .from("submissions")
        .select("id, user_id, problem_id, draft_problem_id, contest_problem_key, status, created_at")
        .eq("contest_slug", contestSlug)
        .eq("submission_type", "solution")
        .neq("status", "rejected")
        .order("created_at", { ascending: false }),
      supabase
        .from("contest_submission_scores")
        .select("id, contest_problem_id, submission_id, user_id, problem_phase, raw_score, score_max, judge_note, scored_at")
        .eq("contest_id", contestId),
      supabase
        .from("contest_participant_profiles")
        .select("id, user_id, challenge_score, challenge_multiplier, multiplier_reason, penalty_points, penalty_reason")
        .eq("contest_id", contestId),
      supabase
        .from("contest_sprint_attempts")
        .select("id, contest_problem_id, user_id, unlock_at, submitted_at, elapsed_ms, answer_raw, answer_normalized, is_correct, score")
        .eq("contest_id", contestId),
    ]);

    const firstError = subsRes.error || scoresRes.error || profilesRes.error || sprintRes.error;
    if (firstError) {
      setLoading(false);
      setError(firstError.message || "加载评分数据失败。请确认已执行 013_weekly_contest_scoring.sql。");
      return;
    }

    const subs = (subsRes.data ?? []) as SubmissionRow[];
    const scoreRows = (scoresRes.data ?? []) as ScoreRow[];
    const profileRows = (profilesRes.data ?? []) as ParticipantProfileRow[];
    const sprintRows = (sprintRes.data ?? []) as SprintAttemptRow[];

    setSubmissions(subs);
    setScores(scoreRows);
    setProfiles(profileRows);
    setSprintAttempts(sprintRows);

    const userIds = new Set<string>();
    for (const s of subs) if (s.user_id) userIds.add(s.user_id);
    for (const s of scoreRows) userIds.add(s.user_id);
    for (const p of profileRows) userIds.add(p.user_id);
    for (const a of sprintRows) userIds.add(a.user_id);

    if (userIds.size > 0) {
      const { data: userRows } = await supabase
        .from("user_profiles")
        .select("id, display_name, username")
        .in("id", [...userIds]);
      const nameMap = new Map<string, string>();
      for (const u of userRows ?? []) {
        const id = u.id as string;
        nameMap.set(id, (u.display_name as string) || (u.username as string) || `用户 ${id.slice(0, 8)}`);
      }
      setUserNames(nameMap);
    } else {
      setUserNames(new Map());
    }

    setLoading(false);
  }

  const participantIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of submissions) if (s.user_id) ids.add(s.user_id);
    for (const s of scores) ids.add(s.user_id);
    for (const p of profiles) ids.add(p.user_id);
    for (const a of sprintAttempts) ids.add(a.user_id);
    return [...ids].sort((a, b) => (userNames.get(a) ?? a).localeCompare(userNames.get(b) ?? b));
  }, [submissions, scores, profiles, sprintAttempts, userNames]);

  // Submitted sprint attempts whose answer matched no answer-key variant —
  // the submit route parks them with is_correct = null for a human to rule on.
  const pendingSprintCount = useMemo(
    () => sprintAttempts.filter((a) => a.submitted_at && a.is_correct === null).length,
    [sprintAttempts],
  );

  async function currentAdminId(): Promise<string | null> {
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  }

  async function saveScore(cp: ScoringContestProblem, userId: string, edit: ScoreEdit) {
    const rawScoreNum = Number(edit.rawScore);
    if (edit.rawScore.trim() === "" || Number.isNaN(rawScoreNum)) {
      setError("请输入有效的分数。");
      return;
    }

    const key = `${cp.id}:${userId}`;
    setSaving(key);
    setError("");
    setMessage("");

    const existing = scores.find((s) => s.contest_problem_id === cp.id && s.user_id === userId);
    const relevantSubs = submissions.filter((s) => s.user_id === userId && matchesContestProblem(s, cp));
    const scoredBy = await currentAdminId();

    const { error: upsertError } = await supabase.from("contest_submission_scores").upsert(
      {
        contest_id: contestId,
        contest_problem_id: cp.id,
        submission_id: existing?.submission_id ?? pickSubmissionId(relevantSubs),
        user_id: userId,
        problem_phase: cp.problem_phase,
        raw_score: rawScoreNum,
        score_max: cp.score_max,
        rubric: {},
        judge_note: edit.judgeNote.trim(),
        scored_by: scoredBy,
        scored_at: new Date().toISOString(),
      },
      { onConflict: "contest_problem_id,user_id" },
    );

    setSaving(null);
    if (upsertError) {
      setError(upsertError.message || "保存评分失败。");
      return;
    }
    setMessage(`已保存 ${userNames.get(userId) ?? userId} · ${cp.title} 的评分。`);
    setScoreEdits((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    await loadScoringData();
  }

  async function saveProfile(userId: string, edit: ProfileEdit) {
    const multiplier = Number(edit.challengeMultiplier);
    if (Number.isNaN(multiplier) || multiplier < 1 || multiplier > 1.25) {
      setError("挑战倍率必须是 1.00 - 1.25 之间的数字。");
      return;
    }
    const challengeScoreNum = Number(edit.challengeScore);
    const penaltyPointsNum = Number(edit.penaltyPoints);
    if (Number.isNaN(challengeScoreNum) || Number.isNaN(penaltyPointsNum)) {
      setError("挑战分和扣分必须是数字。");
      return;
    }

    const key = `profile:${userId}`;
    setSaving(key);
    setError("");
    setMessage("");

    const { error: upsertError } = await supabase.from("contest_participant_profiles").upsert(
      {
        contest_id: contestId,
        contest_slug: contestSlug,
        user_id: userId,
        challenge_score: challengeScoreNum,
        challenge_multiplier: multiplier,
        multiplier_reason: edit.multiplierReason.trim(),
        penalty_points: penaltyPointsNum,
        penalty_reason: edit.penaltyReason.trim(),
      },
      { onConflict: "contest_id,user_id" },
    );

    setSaving(null);
    if (upsertError) {
      setError(upsertError.message || "保存参赛者档案失败。");
      return;
    }
    setMessage(`已保存 ${userNames.get(userId) ?? userId} 的挑战倍率与扣分。`);
    setProfileEdits((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
    await loadScoringData();
  }

  // Manual verdict on a sprint attempt — primarily for is_correct = null
  // rows ("待人工评判"), but also usable to overturn an auto-判错 whose answer
  // turned out to be a correct-but-unlisted form. 判为正确 recomputes the score
  // with the exact same step table the submit route uses, from the
  // server-recorded elapsed_ms — an overtime attempt therefore still scores 0
  // even when ruled correct, matching the auto-grader's overtime rule.
  async function judgeSprintAttempt(attempt: SprintAttemptRow, judgedCorrect: boolean) {
    const cp = contestProblems.find((c) => c.id === attempt.contest_problem_id);
    if (!cp) {
      setError("找不到该计时题的配置，无法评判。");
      return;
    }

    const key = `sprint:${attempt.id}`;
    setSaving(key);
    setError("");
    setMessage("");

    // Same fallback as the submit route's DEFAULT_TIME_LIMIT_SECONDS.
    const timeLimitSeconds = Number(cp.time_limit_seconds) || 120;
    const score =
      judgedCorrect && attempt.elapsed_ms != null
        ? computeSprintStepScore(Number(cp.score_max), timeLimitSeconds, attempt.elapsed_ms)
        : 0;

    const { error: updateError } = await supabase
      .from("contest_sprint_attempts")
      .update({ is_correct: judgedCorrect, score })
      .eq("id", attempt.id);

    setSaving(null);
    if (updateError) {
      setError(updateError.message || "保存计时题评判失败。");
      return;
    }
    setMessage(
      `已将 ${userNames.get(attempt.user_id) ?? attempt.user_id} · ${cp.title} 判为${judgedCorrect ? `正确（${score} 分）` : "错误（0 分）"}。`,
    );
    await loadScoringData();
  }

  if (loading) {
    return (
      <section className="border border-white/10 bg-zinc-950 p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-bold text-white">
          <ClipboardList className="size-4 text-cyan-300" />
          评分台
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse bg-white/[0.03]" />)}
        </div>
      </section>
    );
  }

  return (
    <section className="border border-white/10 bg-zinc-950 p-5">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-white">
        <ClipboardList className="size-4 text-cyan-300" />
        评分台
      </div>
      <p className="mb-4 text-xs leading-5 text-zinc-500">
        参赛者列表根据投稿和已有评分自动生成。普通题/挑战题/解答题在此打分；挑战倍率和扣分写入参赛者档案；计时题由系统自动判分，未匹配到标准答案的填空题会标记为「待人工评判」，在下方判定对错后自动按用时计分。
      </p>

      {pendingSprintCount > 0 && (
        <div className="mb-3 flex items-center gap-2 border border-sky-500/40 bg-sky-500/[0.08] px-3 py-2">
          <HelpCircle className="size-3.5 shrink-0 text-sky-400" />
          <p className="text-xs text-sky-300">
            有 <span className="font-bold">{pendingSprintCount}</span> 条计时题答案待人工评判，请在对应参赛者的计时题列表中判定。
          </p>
        </div>
      )}

      {message && (
        <div className="mb-3 flex items-center gap-2 border border-emerald-500/40 bg-emerald-500/[0.08] px-3 py-2">
          <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
          <p className="text-xs text-emerald-300">{message}</p>
        </div>
      )}
      {error && (
        <div className="mb-3 border border-red-500/40 bg-red-500/[0.08] px-3 py-2 text-xs text-red-300">{error}</div>
      )}

      {participantIds.length === 0 ? (
        <p className="text-sm text-zinc-500">还没有投稿或评分数据。</p>
      ) : (
        <div className="space-y-3">
          {participantIds.map((userId) => {
            const displayName = userNames.get(userId) ?? `用户 ${userId.slice(0, 8)}`;
            const relevantProblems = scorableProblems.filter(
              (cp) =>
                submissions.some((s) => s.user_id === userId && matchesContestProblem(s, cp)) ||
                scores.some((s) => s.contest_problem_id === cp.id && s.user_id === userId),
            );
            const userSprintAttempts = sprintAttempts
              .filter((a) => a.user_id === userId)
              .sort((a, b) => {
                const dayA = contestProblems.find((cp) => cp.id === a.contest_problem_id)?.day_index ?? 0;
                const dayB = contestProblems.find((cp) => cp.id === b.contest_problem_id)?.day_index ?? 0;
                return dayA - dayB;
              });
            const profile = profiles.find((p) => p.user_id === userId);
            const profileEdit: ProfileEdit = profileEdits[userId] ?? {
              challengeScore: String(profile?.challenge_score ?? 0),
              challengeMultiplier: String(profile?.challenge_multiplier ?? 1),
              multiplierReason: profile?.multiplier_reason ?? "",
              penaltyPoints: String(profile?.penalty_points ?? 0),
              penaltyReason: profile?.penalty_reason ?? "",
            };
            const profileSaving = saving === `profile:${userId}`;

            return (
              <div key={userId} className="border border-white/10 bg-zinc-950">
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                  <span className="text-sm font-bold text-white">{displayName}</span>
                  <span className="font-mono text-[11px] text-zinc-600">{userId.slice(0, 8)}…</span>
                </div>

                {relevantProblems.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-zinc-600">该用户没有普通题/挑战题/解答题投稿。</p>
                ) : (
                  relevantProblems.map((cp) => {
                    const key = `${cp.id}:${userId}`;
                    const existing = scores.find((s) => s.contest_problem_id === cp.id && s.user_id === userId);
                    const edit: ScoreEdit = scoreEdits[key] ?? {
                      rawScore: existing ? String(existing.raw_score) : "",
                      judgeNote: existing?.judge_note ?? "",
                    };
                    const subs = submissions.filter((s) => s.user_id === userId && matchesContestProblem(s, cp));
                    const latestSub = subs[0];
                    const isSaving = saving === key;
                    const phaseMeta = contestProblemPhaseMeta[cp.problem_phase];

                    return (
                      <div key={cp.id} className="flex flex-wrap items-center gap-2 border-t border-white/[0.05] px-3 py-2">
                        <span className={`shrink-0 border px-1.5 py-0.5 text-[10px] font-bold ${phaseMeta.className}`}>
                          Day {cp.day_index} · {phaseMeta.label}
                        </span>
                        <span className="min-w-[6rem] flex-1 truncate text-xs font-bold text-white" title={cp.title}>
                          {cp.title}
                        </span>
                        <span className="shrink-0 text-[11px] text-zinc-500">
                          {subs.length === 0 ? (
                            "未提交"
                          ) : (
                            <>
                              {subs.length} 次
                              {latestSub && (
                                <span className={`ml-1 border px-1 py-0.5 ${submissionStatusMeta[latestSub.status].className}`}>
                                  {submissionStatusMeta[latestSub.status].label}
                                </span>
                              )}
                            </>
                          )}
                        </span>
                        <input
                          type="number"
                          value={edit.rawScore}
                          onChange={(event) =>
                            setScoreEdits((prev) => ({ ...prev, [key]: { ...edit, rawScore: event.target.value } }))
                          }
                          className="h-7 w-16 shrink-0 border border-white/15 bg-black/20 px-1.5 text-xs text-white outline-none focus:border-cyan-400/50"
                        />
                        <span className="shrink-0 text-[11px] text-zinc-600">/ {cp.score_max}</span>
                        <input
                          type="text"
                          placeholder="评语（可选）"
                          value={edit.judgeNote}
                          onChange={(event) =>
                            setScoreEdits((prev) => ({ ...prev, [key]: { ...edit, judgeNote: event.target.value } }))
                          }
                          className="h-7 min-w-[8rem] flex-1 border border-white/15 bg-black/20 px-1.5 text-xs text-white outline-none focus:border-cyan-400/50"
                        />
                        <button
                          type="button"
                          onClick={() => saveScore(cp, userId, edit)}
                          disabled={isSaving}
                          className="inline-flex h-7 shrink-0 items-center gap-1 border border-cyan-400/30 px-2 text-[11px] font-bold text-cyan-300 transition hover:bg-cyan-400/10 disabled:opacity-50"
                        >
                          <Save className="size-3" />
                          {isSaving ? "保存中…" : "保存"}
                        </button>
                        {existing && (
                          <span title={`已于 ${existing.scored_at ? formatContestDateTime(existing.scored_at) : "—"} 评分`}>
                            <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
                          </span>
                        )}
                      </div>
                    );
                  })
                )}

                <div className="flex flex-wrap items-center gap-2 border-t border-white/10 bg-black/10 px-3 py-2.5">
                  <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-zinc-500">挑战倍率 &amp; 扣分</span>
                  <label className="flex shrink-0 items-center gap-1 text-[11px] text-zinc-400">
                    挑战分
                    <input
                      type="number"
                      value={profileEdit.challengeScore}
                      onChange={(event) =>
                        setProfileEdits((prev) => ({ ...prev, [userId]: { ...profileEdit, challengeScore: event.target.value } }))
                      }
                      className="h-7 w-14 border border-white/15 bg-black/20 px-1.5 text-xs text-white outline-none focus:border-cyan-400/50"
                    />
                  </label>
                  <label className="flex shrink-0 items-center gap-1 text-[11px] text-zinc-400">
                    倍率
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      max="1.25"
                      value={profileEdit.challengeMultiplier}
                      onChange={(event) =>
                        setProfileEdits((prev) => ({ ...prev, [userId]: { ...profileEdit, challengeMultiplier: event.target.value } }))
                      }
                      className="h-7 w-16 border border-white/15 bg-black/20 px-1.5 text-xs text-white outline-none focus:border-cyan-400/50"
                    />
                  </label>
                  <input
                    type="text"
                    placeholder="倍率理由"
                    value={profileEdit.multiplierReason}
                    onChange={(event) =>
                      setProfileEdits((prev) => ({ ...prev, [userId]: { ...profileEdit, multiplierReason: event.target.value } }))
                    }
                    className="h-7 min-w-[7rem] flex-1 border border-white/15 bg-black/20 px-1.5 text-xs text-white outline-none focus:border-cyan-400/50"
                  />
                  <label className="flex shrink-0 items-center gap-1 text-[11px] text-zinc-400">
                    扣分
                    <input
                      type="number"
                      value={profileEdit.penaltyPoints}
                      onChange={(event) =>
                        setProfileEdits((prev) => ({ ...prev, [userId]: { ...profileEdit, penaltyPoints: event.target.value } }))
                      }
                      className="h-7 w-14 border border-red-400/20 bg-black/20 px-1.5 text-xs text-white outline-none focus:border-red-400/50"
                    />
                  </label>
                  <input
                    type="text"
                    placeholder="扣分理由"
                    value={profileEdit.penaltyReason}
                    onChange={(event) =>
                      setProfileEdits((prev) => ({ ...prev, [userId]: { ...profileEdit, penaltyReason: event.target.value } }))
                    }
                    className="h-7 min-w-[7rem] flex-1 border border-red-400/20 bg-black/20 px-1.5 text-xs text-white outline-none focus:border-red-400/50"
                  />
                  <button
                    type="button"
                    onClick={() => saveProfile(userId, profileEdit)}
                    disabled={profileSaving}
                    className="inline-flex h-7 shrink-0 items-center gap-1 border border-amber-400/30 px-2 text-[11px] font-bold text-amber-300 transition hover:bg-amber-400/10 disabled:opacity-50"
                  >
                    <Save className="size-3" />
                    {profileSaving ? "保存中…" : "保存"}
                  </button>
                </div>

                {userSprintAttempts.length > 0 && (
                  <div className="border-t border-white/10 bg-black/10 px-3 py-2.5">
                    <p className="mb-1.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-zinc-500">
                      <Timer className="size-3" />
                      计时题
                    </p>
                    <div className="space-y-1.5">
                      {userSprintAttempts.map((attempt) => {
                        const cp = contestProblems.find((c) => c.id === attempt.contest_problem_id);
                        const isPending = attempt.submitted_at !== null && attempt.is_correct === null;
                        const isJudging = saving === `sprint:${attempt.id}`;
                        return (
                          <div
                            key={attempt.id}
                            className={`flex flex-wrap items-center gap-2 text-[11px] text-zinc-400 ${
                              isPending ? "border border-sky-500/30 bg-sky-500/[0.05] px-2 py-1.5" : ""
                            }`}
                          >
                            <span className="shrink-0 font-bold text-white">
                              {cp ? `Day ${cp.day_index} · ${cp.title}` : attempt.contest_problem_id}
                            </span>
                            <span>解锁 {formatContestDateTime(attempt.unlock_at)}</span>
                            <span>{attempt.submitted_at ? `提交 ${formatContestDateTime(attempt.submitted_at)}` : "未提交"}</span>
                            {attempt.elapsed_ms != null && <span>用时 {(attempt.elapsed_ms / 1000).toFixed(1)}s</span>}
                            {attempt.submitted_at && attempt.answer_raw !== null && (
                              <span className="max-w-[14rem] truncate" title={attempt.answer_raw}>
                                答案 <span className="font-mono text-zinc-200">{attempt.answer_raw || "（空）"}</span>
                              </span>
                            )}
                            {isPending ? (
                              <span className="shrink-0 border border-sky-400/40 bg-sky-400/[0.08] px-1.5 py-0.5 font-bold text-sky-300">
                                待人工评判
                              </span>
                            ) : (
                              <span
                                className={
                                  attempt.is_correct === true
                                    ? "text-emerald-400"
                                    : attempt.is_correct === false
                                      ? "text-red-400"
                                      : "text-zinc-500"
                                }
                              >
                                {attempt.is_correct === null ? "—" : attempt.is_correct ? "正确" : "错误"}
                              </span>
                            )}
                            <span className="font-bold text-amber-300">{attempt.score} 分</span>
                            {attempt.submitted_at && attempt.is_correct !== true && (
                              <button
                                type="button"
                                onClick={() => judgeSprintAttempt(attempt, true)}
                                disabled={isJudging}
                                className="inline-flex h-6 shrink-0 items-center gap-1 border border-emerald-500/40 px-1.5 font-bold text-emerald-300 transition hover:bg-emerald-500/10 disabled:opacity-50"
                              >
                                <CheckCircle2 className="size-3" />
                                {isJudging ? "…" : isPending ? "判为正确" : "改判正确"}
                              </button>
                            )}
                            {attempt.submitted_at && attempt.is_correct !== false && (
                              <button
                                type="button"
                                onClick={() => judgeSprintAttempt(attempt, false)}
                                disabled={isJudging}
                                className="inline-flex h-6 shrink-0 items-center gap-1 border border-red-500/40 px-1.5 font-bold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                              >
                                <XCircle className="size-3" />
                                {isJudging ? "…" : isPending ? "判为错误" : "改判错误"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
