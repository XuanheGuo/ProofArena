import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createServiceClient } from "@/lib/supabase-server";
import {
  isWithinWindow,
  loadSprintContestProblem,
  resolveSprintProblemDisplay,
  type ContestProblemRow,
} from "@/lib/contest-sprint";

type RouteContext = {
  params: Promise<{ slug: string; contestProblemId: string }>;
};

type AttemptFields = {
  unlock_at: string;
  submitted_at: string | null;
  elapsed_ms: number | null;
  is_correct: boolean | null;
  score: number;
};

// The problem face (title/statement) is only ever included once an attempt
// exists — see resolveSprintProblemDisplay's doc comment for why. Metadata
// like timeLimitSeconds/scoreMax/answerType/answerFormatNote is safe to
// return unconditionally: it's the same public schedule/config info already
// shown on the contest detail page, not the problem content itself.
async function serializeAttempt(
  supabase: SupabaseClient,
  attempt: AttemptFields | null,
  contestProblem: ContestProblemRow,
) {
  const display = attempt
    ? await resolveSprintProblemDisplay(contestProblem)
    : null;
  return {
    unlocked: attempt !== null,
    unlockAt: attempt?.unlock_at ?? null,
    submittedAt: attempt?.submitted_at ?? null,
    elapsedMs: attempt?.elapsed_ms ?? null,
    isCorrect: attempt?.is_correct ?? null,
    score: attempt?.score ?? null,
    timeLimitSeconds: contestProblem.time_limit_seconds,
    scoreMax: contestProblem.score_max,
    answerType: contestProblem.answer_type,
    answerFormatNote: contestProblem.answer_format_note,
    title: display?.title ?? null,
    statement: display?.statement ?? null,
  };
}

async function findOwnAttempt(
  supabase: SupabaseClient,
  contestProblemId: string,
  userId: string,
) {
  const { data } = await supabase
    .from("contest_sprint_attempts")
    .select("unlock_at, submitted_at, elapsed_ms, is_correct, score")
    .eq("contest_problem_id", contestProblemId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as AttemptFields | null) ?? null;
}

// Read-only status check — never creates a row. The panel calls this on
// mount (and after a refresh) to decide which of the four UI states to show
// without ever silently unlocking the problem just by visiting the page;
// only the explicit "解锁计时题" button click below (POST) is allowed to do
// that. Since no attempt exists yet in the "not unlocked" case, the response
// carries no title/statement at all — the problem face is never part of the
// page's initial payload or this status check until the user has actually
// unlocked.
export async function GET(_req: Request, context: RouteContext) {
  const { slug, contestProblemId } = await context.params;

  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getUser();
  const user = authData.user;
  if (!user) {
    return NextResponse.json(
      { error: "需要登录后才能查看计时题状态。" },
      { status: 401 },
    );
  }

  const supabase = createServiceClient();
  const loaded = await loadSprintContestProblem(
    supabase,
    slug,
    contestProblemId,
  );
  if (!loaded.ok) {
    return NextResponse.json(
      { error: loaded.error },
      { status: loaded.status },
    );
  }

  const existing = await findOwnAttempt(supabase, contestProblemId, user.id);
  return NextResponse.json(
    await serializeAttempt(supabase, existing, loaded.contestProblem),
  );
}

// Unlocking is the only user-triggered write against contest_sprint_attempts
// (migration 013 gives that table no client-facing RLS policy at all), so
// this route runs entirely with the service role client after authenticating
// the caller — never trust a client-supplied unlock_at, this always writes
// the server's own NOW(). This is also the first point at which the problem
// face is ever read and returned to the client.
export async function POST(_req: Request, context: RouteContext) {
  const { slug, contestProblemId } = await context.params;

  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getUser();
  const user = authData.user;
  if (!user) {
    return NextResponse.json(
      { error: "需要登录后才能解锁计时题。" },
      { status: 401 },
    );
  }

  const supabase = createServiceClient();
  const loaded = await loadSprintContestProblem(
    supabase,
    slug,
    contestProblemId,
  );
  if (!loaded.ok) {
    return NextResponse.json(
      { error: loaded.error },
      { status: loaded.status },
    );
  }
  const { contest, contestProblem } = loaded;

  // Idempotent: a second unlock click (or a racing duplicate request) must
  // return the existing attempt's own unlock_at rather than resetting the
  // timer — also backstopped by the UNIQUE(contest_problem_id, user_id)
  // constraint below, so a racing double-insert can't ever create two rows.
  const existing = await findOwnAttempt(supabase, contestProblemId, user.id);
  if (existing) {
    return NextResponse.json(
      await serializeAttempt(supabase, existing, contestProblem),
    );
  }

  // Only a brand-new attempt requires the contest to currently be active and
  // the problem's window to currently be open — finishing an attempt that
  // already started (GET/existing branch above, and the submit route) never
  // re-checks these, so a window closing mid-attempt can't strand a timer
  // that's already running.
  if (contest.status !== "active") {
    return NextResponse.json(
      { error: "比赛当前不在进行中，无法解锁计时题。" },
      { status: 403 },
    );
  }
  if (!isWithinWindow(contestProblem.open_at, contestProblem.close_at)) {
    return NextResponse.json(
      { error: "这道计时题当前不在开放时间内。" },
      { status: 403 },
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("contest_sprint_attempts")
    .insert({
      contest_id: contest.id,
      contest_problem_id: contestProblemId,
      user_id: user.id,
      score: 0,
    })
    .select("unlock_at, submitted_at, elapsed_ms, is_correct, score")
    .single();

  if (insertError) {
    // 23505 = unique_violation: two unlock requests raced past the
    // findOwnAttempt check above (e.g. a double click). The UNIQUE
    // (contest_problem_id, user_id) constraint means only one insert can
    // ever win — the loser re-reads and returns the winner's row instead of
    // failing with a 500, keeping this endpoint genuinely idempotent.
    if (insertError.code === "23505") {
      const raced = await findOwnAttempt(supabase, contestProblemId, user.id);
      if (raced) {
        return NextResponse.json(
          await serializeAttempt(supabase, raced, contestProblem),
        );
      }
    }
    return NextResponse.json(
      { error: insertError.message || "解锁失败，请重试。" },
      { status: 500 },
    );
  }
  if (!inserted) {
    return NextResponse.json({ error: "解锁失败，请重试。" }, { status: 500 });
  }

  return NextResponse.json(
    await serializeAttempt(supabase, inserted as AttemptFields, contestProblem),
  );
}
