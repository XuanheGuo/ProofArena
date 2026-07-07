import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";

type RouteContext = { params: Promise<{ slug: string }> };

// Safe per-user contest summary for ContestMyPanel. Exists because
// contest_sprint_attempts has no client-facing RLS at all (migration 013) —
// a regular authenticated user cannot select even their own row directly,
// so ContestMyPanel can't just query it like it already does for
// submissions/contest_submission_scores/contest_participant_profiles
// (all of which DO allow a user to read their own — or in the scores/
// profiles case, everyone's — rows via RLS). This route consolidates all
// four into one authenticated fetch instead of making the panel juggle a
// direct Supabase query for some tables and a per-problem sprint status
// check for others.
//
// Only ever returns the caller's OWN data (filtered by their own user id
// from the authenticated session), and only safe fields — no
// answer_raw/answer_normalized from sprint attempts, no answer keys from
// contest_problem_answer_keys (that table isn't even queried here).
export async function GET(_req: Request, context: RouteContext) {
  const { slug } = await context.params;

  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getUser();
  const user = authData.user;
  if (!user) {
    return NextResponse.json({ error: "需要登录后才能查看参赛状态。" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: contest } = await supabase
    .from("contests")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (!contest) {
    return NextResponse.json({ error: "比赛不存在。" }, { status: 404 });
  }

  const [submissionsRes, scoresRes, profileRes, sprintAttemptsRes, awardsRes] = await Promise.all([
    supabase
      .from("submissions")
      .select("id, problem_id, draft_problem_id, contest_problem_key, status, created_at, is_post_contest")
      .eq("submission_type", "solution")
      .eq("user_id", user.id)
      // Some submissions only ever had contest_slug set (older rows, or
      // AdminContestScoringView's own submissions query also matches on
      // contest_slug) rather than the contest_id FK — match on either so
      // this route can't silently show fewer submissions than the admin
      // scoring panel does for the same user.
      .or(`contest_id.eq.${contest.id},contest_slug.eq.${slug}`)
      .order("created_at", { ascending: false }),
    supabase
      .from("contest_submission_scores")
      .select("contest_problem_id, problem_phase, raw_score, score_max, judge_note, scored_at")
      .eq("contest_id", contest.id)
      .eq("user_id", user.id),
    supabase
      .from("contest_participant_profiles")
      .select("challenge_score, challenge_multiplier, multiplier_reason, penalty_points, penalty_reason")
      .eq("contest_id", contest.id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("contest_sprint_attempts")
      .select("contest_problem_id, unlock_at, submitted_at, elapsed_ms, is_correct, score")
      .eq("contest_id", contest.id)
      .eq("user_id", user.id),
    supabase
      .from("awards")
      .select("points")
      .eq("contest_id", contest.id)
      .eq("user_id", user.id),
  ]);

  // Fail loudly instead of silently rendering an empty/partial panel — a
  // query error here (bad migration state, RLS misconfiguration, etc.)
  // should surface as an error, not as "you have no submissions/scores".
  const firstError =
    submissionsRes.error || scoresRes.error || profileRes.error || sprintAttemptsRes.error || awardsRes.error;
  if (firstError) {
    console.error("[contests/me] query error:", firstError.message);
    return NextResponse.json({ error: "加载参赛状态失败，请稍后重试。" }, { status: 500 });
  }

  const submissions = submissionsRes.data;
  const scores = scoresRes.data;
  const profile = profileRes.data;
  const sprintAttempts = sprintAttemptsRes.data;
  const awards = awardsRes.data;

  const awardPoints = (awards ?? []).reduce((sum, award) => sum + (Number(award.points) || 0), 0);

  return NextResponse.json({
    submissions: (submissions ?? []).map((s) => ({
      id: s.id as string,
      problemId: s.problem_id as string | null,
      draftProblemId: s.draft_problem_id as string | null,
      contestProblemKey: s.contest_problem_key as string | null,
      status: s.status as "pending" | "approved" | "rejected" | "needs_revision",
      createdAt: s.created_at as string,
      isPostContest: Boolean(s.is_post_contest),
    })),
    scores: (scores ?? []).map((s) => ({
      contestProblemId: s.contest_problem_id as string,
      problemPhase: s.problem_phase as string,
      rawScore: Number(s.raw_score),
      scoreMax: Number(s.score_max),
      judgeNote: (s.judge_note as string) ?? "",
      scoredAt: s.scored_at as string | null,
    })),
    participantProfile: profile
      ? {
          challengeScore: Number(profile.challenge_score),
          challengeMultiplier: Number(profile.challenge_multiplier),
          multiplierReason: (profile.multiplier_reason as string) ?? "",
          penaltyPoints: Number(profile.penalty_points),
          penaltyReason: (profile.penalty_reason as string) ?? "",
        }
      : null,
    sprintAttempts: (sprintAttempts ?? []).map((a) => ({
      contestProblemId: a.contest_problem_id as string,
      unlockAt: a.unlock_at as string,
      submittedAt: a.submitted_at as string | null,
      elapsedMs: a.elapsed_ms as number | null,
      isCorrect: a.is_correct as boolean | null,
      score: Number(a.score),
    })),
    awardPoints,
  });
}
