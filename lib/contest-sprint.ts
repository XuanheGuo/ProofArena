import type { SupabaseClient } from "@supabase/supabase-js";
import { getProblem } from "@/lib/db";
import { getProblemDraftForContestDisplay } from "@/lib/problem-drafts";
import type { ContestAnswerType } from "@/lib/types";

// Shared server-side helpers for the timed sprint problem flow (see
// docs/WEEKLY_CONTEST_FORMAT.md §6 and docs/WEEKLY_CONTEST_IMPLEMENTATION_BRIEF.md
// Phase 3). Used by both API routes:
//   app/api/contests/[slug]/sprint/[contestProblemId]/unlock/route.ts
//   app/api/contests/[slug]/sprint/[contestProblemId]/submit/route.ts
// This module has no "use client" boundary concerns of its own, but every
// function here assumes it is called from trusted server code — the
// SupabaseClient passed in is expected to be a service-role client (see
// lib/supabase-server.ts createServiceClient), since contest_sprint_attempts
// and contest_problem_answer_keys have no public RLS policies at all
// (migration 013).

export type ContestProblemRow = {
  id: string;
  contest_id: string;
  problem_id: string | null;
  draft_problem_id: string | null;
  problem_phase: string;
  score_max: number;
  score_policy: string;
  timed_mode_enabled: boolean;
  time_limit_seconds: number | null;
  max_attempts: number;
  answer_type: ContestAnswerType | null;
  answer_format_note: string;
  open_at: string;
  close_at: string;
  unlock_mode: string;
  status: string;
};

export type ContestRow = {
  id: string;
  status: string;
};

export type LoadSprintContestProblemResult =
  | { ok: true; contest: ContestRow; contestProblem: ContestProblemRow }
  | { ok: false; status: number; error: string };

// Resolves + validates the (contest, contest_problem) pair shared by both
// routes: contest exists, contest_problem exists and belongs to it, and the
// problem is actually a timed sprint problem. Does NOT check contest.status
// or the open/close window — the unlock route additionally requires those
// (a brand-new attempt should only start while the contest is active and the
// window is open), but the submit route deliberately does not re-check them,
// so an attempt started while everything was valid can still be finished
// even if the window happens to close in the following ~2 minutes.
export async function loadSprintContestProblem(
  supabase: SupabaseClient,
  slug: string,
  contestProblemId: string,
): Promise<LoadSprintContestProblemResult> {
  const { data: contest } = await supabase
    .from("contests")
    .select("id, status")
    .eq("slug", slug)
    .maybeSingle();

  if (!contest) {
    return { ok: false, status: 404, error: "比赛不存在。" };
  }

  const { data: contestProblem } = await supabase
    .from("contest_problems")
    .select(
      "id, contest_id, problem_id, draft_problem_id, problem_phase, score_max, score_policy, timed_mode_enabled, time_limit_seconds, max_attempts, answer_type, answer_format_note, open_at, close_at, unlock_mode, status",
    )
    .eq("id", contestProblemId)
    .eq("contest_id", contest.id)
    .maybeSingle();

  if (!contestProblem) {
    return { ok: false, status: 404, error: "赛题不存在。" };
  }
  if (contestProblem.problem_phase !== "sprint") {
    return { ok: false, status: 400, error: "该赛题不是计时题。" };
  }
  if (!contestProblem.timed_mode_enabled) {
    return { ok: false, status: 400, error: "该赛题未开启计时模式。" };
  }

  return {
    ok: true,
    contest: contest as ContestRow,
    contestProblem: contestProblem as ContestProblemRow,
  };
}

export function isWithinWindow(openAt: string, closeAt: string, now: Date = new Date()): boolean {
  return now >= new Date(openAt) && now < new Date(closeAt);
}

export type SprintProblemDisplay = { title: string; statement: string[] };

// The actual math problem face (title + statement) for a sprint problem —
// deliberately NOT part of loadSprintContestProblem's return value. Callers
// (unlock/submit routes) must only call this after confirming the caller
// has an existing contest_sprint_attempts row (i.e. they personally
// unlocked it): revealing the statement is what starts the clock for a
// participant, so it must never be reachable as a side effect of merely
// loading the page or checking status before an attempt exists.
//
// Handles both a public `problems` row and an unpublished Problem Vault
// draft — the draft branch reuses getProblemDraftForContestDisplay's
// service-role read, which is exactly as safe here as it is for the
// non-sprint contest problem page (see that function's own doc comment):
// the contest-level unlock (open/close window) has already been confirmed
// by the caller before this ever runs, and now the personal per-user
// sprint unlock is confirmed on top of that.
export async function resolveSprintProblemDisplay(contestProblem: ContestProblemRow): Promise<SprintProblemDisplay | null> {
  if (contestProblem.problem_id) {
    const problem = await getProblem(contestProblem.problem_id);
    return problem ? { title: problem.title, statement: problem.statement } : null;
  }
  if (contestProblem.draft_problem_id) {
    const draft = await getProblemDraftForContestDisplay(contestProblem.draft_problem_id);
    return draft ? { title: draft.title, statement: draft.statement ?? [] } : null;
  }
  return null;
}

function reduceFraction(raw: string): string | null {
  const match = raw.match(/^(-?\d+)\/(-?\d+)$/);
  if (!match) return null;
  let num = parseInt(match[1], 10);
  let den = parseInt(match[2], 10);
  if (den === 0) return null;
  if (den < 0) {
    num = -num;
    den = -den;
  }
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(Math.abs(num), den) || 1;
  return `${num / divisor}/${den / divisor}`;
}

function normalizeAscendingIntegerList(raw: string): string | null {
  const parts = raw.split(",").map((part) => part.trim());
  if (parts.length === 0 || parts.some((part) => !/^-?\d+$/.test(part))) return null;
  const nums = parts.map((part) => parseInt(part, 10)).sort((a, b) => a - b);
  return nums.join(",");
}

// Strip common math-typesetting noise before normalization so participants
// can type answers in natural ways (√5, \sqrt5, \sqrt{5}, $\sqrt{5}$, etc.)
// without being penalised for format knowledge they don't need in a sprint.
// This runs on both the submitted answer AND every answer-key candidate so
// comparison remains a plain string equality check after normalization.
function stripMathNoise(s: string): string {
  return s
    // Remove LaTeX math delimiters ($…$ and $$…$$)
    .replace(/\$\$?([^$]*)\$\$?/g, "$1")
    // Normalize LaTeX fractions \frac{a}{b} → a/b
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "$1/$2")
    // Normalize LaTeX sqrt with braces \sqrt{n} → sqrt(n)
    .replace(/\\sqrt\{([^}]+)\}/g, "sqrt($1)")
    // Normalize plain \sqrt n → sqrt(n) (handles \sqrt2, \sqrt 5, etc.)
    .replace(/\\sqrt\s*([A-Za-z0-9.]+)/g, "sqrt($1)")
    // Normalize Unicode radical sign √n → sqrt(n); handles √5, √{5}, 2√6
    .replace(/√\{([^}]+)\}/g, "sqrt($1)")
    .replace(/√([A-Za-z0-9.]+)/g, "sqrt($1)")
    // Strip remaining LaTeX commands (\ln, \pi, \infty, etc.) — keep letters
    .replace(/\\([A-Za-z]+)/g, "$1")
    // Strip LaTeX braces that survive the above replacements
    .replace(/[{}]/g, "")
    // Collapse all remaining whitespace
    .replace(/\s+/g, "");
}

// Normalizes a raw sprint answer per docs/WEEKLY_CONTEST_FORMAT.md §6.4's
// format rules, applied identically to both the submitted answer and every
// candidate in the stored answer key, so comparison is a plain string
// equality check. Deliberately simple (no CAS-level expression equivalence)
// — sprint problems are supposed to avoid answers that need that in the
// first place.
export function normalizeSprintAnswer(answerType: ContestAnswerType, rawInput: string): string {
  const raw = (rawInput ?? "").trim();
  if (!raw) return "";

  if (answerType === "single_choice") {
    return raw.replace(/\s+/g, "").toUpperCase();
  }

  if (answerType === "multiple_choice") {
    const tokens = raw
      .split(/[,\s]+/)
      .map((token) => token.trim().toUpperCase())
      .filter(Boolean);
    return [...new Set(tokens)].sort().join(",");
  }

  // fill_blank: strip LaTeX/Unicode math noise first, then try structured
  // forms (fraction, integer list, letters), else fall back to a
  // whitespace-collapsed string — see format doc's fill-blank format table.
  const denoised = stripMathNoise(raw);
  const collapsed = denoised.replace(/\s*,\s*/g, ",").replace(/\s+/g, "");
  const asFraction = reduceFraction(collapsed);
  if (asFraction !== null) return asFraction;
  const asIntList = normalizeAscendingIntegerList(collapsed);
  if (asIntList !== null) return asIntList;
  if (/^[a-zA-Z]+$/.test(collapsed)) return collapsed.toUpperCase();
  return collapsed.toLowerCase();
}

// answer_key is stored as a JSON array of acceptable raw answer strings
// (each normalized the same way as the submission) — e.g. single_choice:
// ["A"], multiple_choice: ["A,C"] (the one correct combination, already in
// whatever order the admin typed it — normalization sorts it), fill_blank:
// ["3/4", "0.75"] for multiple equivalent forms. A bare string is also
// accepted as shorthand for a single-element array.
export function sprintAnswerMatches(answerType: ContestAnswerType, submittedRaw: string, answerKey: unknown): boolean {
  const submittedNormalized = normalizeSprintAnswer(answerType, submittedRaw);
  if (!submittedNormalized) return false;

  const candidates: unknown[] = Array.isArray(answerKey) ? answerKey : [answerKey];
  return candidates.some(
    (candidate) => typeof candidate === "string" && normalizeSprintAnswer(answerType, candidate) === submittedNormalized,
  );
}

// Step scoring lives in lib/contest-sprint-score.ts (client-safe, no
// server-only imports) so AdminContestScoringView can compute the identical
// score when a moderator manually adjudicates a pending attempt; re-exported
// here so the API routes keep importing everything from one place.
export { computeSprintStepScore } from "@/lib/contest-sprint-score";
