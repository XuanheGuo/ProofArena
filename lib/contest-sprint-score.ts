// Pure sprint step-scoring, split out of lib/contest-sprint.ts so client
// components can use it: that module imports server-only code (service-role
// Supabase via lib/problem-drafts), while this one is dependency-free. The
// admin scoring panel (AdminContestScoringView) needs the exact same score
// table when a moderator manually marks a pending fill_blank attempt as
// correct — the score must match what the submit route would have computed.

// Step scoring per docs/WEEKLY_CONTEST_FORMAT.md §6.3, generalized from the
// documented score_max=30 / time_limit=120s table to any score_max /
// time_limit_seconds by keeping the same time-ratio breakpoints (15/30/60/90
// out of 120 => 0.125/0.25/0.5/0.75 of the limit) and the same score
// fractions of score_max (30/26/21/15/9/0 out of 30). Always rounds to the
// nearest whole number — the "统一" (consistent) rounding rule the brief
// asks for, regardless of what score_max is.
const SPRINT_STEP_BUCKETS: Array<{ maxRatio: number; scoreFraction: number }> = [
  { maxRatio: 0.125, scoreFraction: 30 / 30 },
  { maxRatio: 0.25, scoreFraction: 26 / 30 },
  { maxRatio: 0.5, scoreFraction: 21 / 30 },
  { maxRatio: 0.75, scoreFraction: 15 / 30 },
  { maxRatio: 1.0, scoreFraction: 9 / 30 },
];

export function computeSprintStepScore(scoreMax: number, timeLimitSeconds: number, elapsedMs: number): number {
  const limitMs = timeLimitSeconds * 1000;
  if (!(limitMs > 0)) return 0;
  const clampedElapsedMs = Math.max(0, elapsedMs);
  const ratio = clampedElapsedMs / limitMs;
  const bucket = SPRINT_STEP_BUCKETS.find((candidate) => ratio <= candidate.maxRatio);
  if (!bucket) return 0;
  return Math.round(scoreMax * bucket.scoreFraction);
}
