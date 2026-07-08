import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import { computeSprintStepScore, loadSprintContestProblem, normalizeSprintAnswer, sprintAnswerMatches } from "@/lib/contest-sprint";

type RouteContext = { params: Promise<{ slug: string; contestProblemId: string }> };

const DEFAULT_TIME_LIMIT_SECONDS = 120;

// Submit is the only route allowed to fill in
// submitted_at/elapsed_ms/answer_raw/answer_normalized/is_correct/score on a
// contest_sprint_attempts row, and it always computes elapsed_ms from the
// row's own unlock_at vs. the server's own NOW() — a client-supplied
// elapsed time is never read or trusted. Runs entirely with the service
// role client (see migration 013: this table has no client-facing RLS).
export async function POST(req: Request, context: RouteContext) {
  const { slug, contestProblemId } = await context.params;

  let body: { answer?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误。" }, { status: 400 });
  }
  const rawAnswer = typeof body.answer === "string" ? body.answer : "";

  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getUser();
  const user = authData.user;
  if (!user) {
    return NextResponse.json({ error: "需要登录后才能提交计时题。" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const loaded = await loadSprintContestProblem(supabase, slug, contestProblemId);
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  }
  const { contestProblem } = loaded;

  const { data: attempt } = await supabase
    .from("contest_sprint_attempts")
    .select("id, unlock_at, submitted_at, elapsed_ms, is_correct, score")
    .eq("contest_problem_id", contestProblemId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!attempt) {
    return NextResponse.json({ error: "请先解锁这道计时题。" }, { status: 400 });
  }

  // Idempotent: a duplicate/retried submit (double click, network retry)
  // returns the already-scored result instead of rescoring — the row's
  // score, once set, is final.
  if (attempt.submitted_at) {
    return NextResponse.json({
      isCorrect: attempt.is_correct,
      elapsedMs: attempt.elapsed_ms,
      score: attempt.score,
      submittedAt: attempt.submitted_at,
    });
  }

  if (!contestProblem.answer_type) {
    return NextResponse.json({ error: "这道计时题还没有配置答案类型，请联系管理员。" }, { status: 500 });
  }

  // Answer keys live in a separate admin-only table (contest_problem_answer_keys)
  // precisely so a route like this — which must read the correct answer to
  // grade against it — is the only place that ever does, and only ever uses
  // it to produce a boolean + score, never echoing it back in the response.
  const { data: answerKeyRow } = await supabase
    .from("contest_problem_answer_keys")
    .select("answer_key")
    .eq("contest_problem_id", contestProblemId)
    .maybeSingle();

  if (!answerKeyRow) {
    return NextResponse.json({ error: "这道计时题还没有配置标准答案，请联系管理员。" }, { status: 500 });
  }

  const now = new Date();
  const unlockAt = new Date(attempt.unlock_at);
  const elapsedMs = Math.max(0, now.getTime() - unlockAt.getTime());
  const timeLimitSeconds = Number(contestProblem.time_limit_seconds) || DEFAULT_TIME_LIMIT_SECONDS;
  const isOverTime = elapsedMs > timeLimitSeconds * 1000;

  const isCorrect = sprintAnswerMatches(contestProblem.answer_type, rawAnswer, answerKeyRow.answer_key);
  const normalizedAnswer = normalizeSprintAnswer(contestProblem.answer_type, rawAnswer);

  // fill_blank answers that don't match any key after normalization are NOT
  // immediately marked wrong — the participant may have used a correct but
  // non-canonical form that the answer key doesn't enumerate (e.g. decimal
  // vs fraction vs a different radical notation). Instead we set
  // is_correct = null to flag the row as "needs human review"; score stays 0
  // until an admin fills it in via AdminContestScoringView. Choice answers
  // have no such ambiguity (A/B/C/D is unambiguous), so they are final.
  const isFillBlankPending =
    contestProblem.answer_type === "fill_blank" && !isCorrect && !isOverTime;

  // is_correct: true → correct; false → wrong (for choices, or overtime);
  //             null  → pending human review (fill_blank, within time, no key match).
  const isCorrectDb: boolean | null = isFillBlankPending ? null : isCorrect;
  const score =
    isCorrect && !isOverTime ? computeSprintStepScore(Number(contestProblem.score_max), timeLimitSeconds, elapsedMs) : 0;

  const { data: updated, error: updateError } = await supabase
    .from("contest_sprint_attempts")
    .update({
      submitted_at: now.toISOString(),
      elapsed_ms: elapsedMs,
      answer_raw: rawAnswer,
      answer_normalized: normalizedAnswer,
      is_correct: isCorrectDb,
      score,
    })
    .eq("id", attempt.id)
    // Guards the same race the read-then-check above can't: two submits
    // firing close enough together to both see submitted_at = null. Only
    // the first UPDATE matching this filter can ever apply; the loser gets
    // 0 rows back and falls through to re-reading the winner's result below
    // instead of double-scoring or erroring.
    .is("submitted_at", null)
    .select("is_correct, elapsed_ms, score, submitted_at")
    .maybeSingle();

  if (!updated) {
    const { data: settled } = await supabase
      .from("contest_sprint_attempts")
      .select("is_correct, elapsed_ms, score, submitted_at")
      .eq("id", attempt.id)
      .maybeSingle();

    if (settled?.submitted_at) {
      return NextResponse.json({
        isCorrect: settled.is_correct,
        needsReview: settled.is_correct === null,
        elapsedMs: settled.elapsed_ms,
        score: settled.score,
        submittedAt: settled.submitted_at,
      });
    }

    return NextResponse.json({ error: updateError?.message || "提交失败，请重试。" }, { status: 500 });
  }

  return NextResponse.json({
    isCorrect: updated.is_correct,
    needsReview: updated.is_correct === null,
    elapsedMs: updated.elapsed_ms,
    score: updated.score,
    submittedAt: updated.submitted_at,
  });
}
