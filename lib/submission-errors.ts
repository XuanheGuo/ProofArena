// Parses the error a submissions INSERT can fail with when the
// enforce_submission_rate_limit trigger (023_submission_rate_limit_enforcement.sql)
// raises a cooldown/rate-limit exception. The trigger's exception message is
// already human-readable Chinese text with the wait time baked in — that's
// the primary, guaranteed-to-work signal. The trigger also best-effort sets
// a JSON payload on the Postgres DETAIL field (surfaced by supabase-js as
// error.details), which this parses opportunistically for a structured
// cooldownUntil/retryAfterSeconds a countdown UI can use; if that doesn't
// parse cleanly, callers still have the plain message.
export type ParsedSubmissionError = {
  message: string;
  isRateLimited: boolean;
  cooldownUntil?: string;
  retryAfterSeconds?: number;
};

export function parseSubmissionError(error: { message?: string; details?: string | null } | null | undefined): ParsedSubmissionError {
  const message = error?.message || '提交失败，请稍后再试。';
  const isRateLimited = /提交过于频繁/.test(message);

  if (!isRateLimited || !error?.details) {
    return { message, isRateLimited };
  }

  try {
    const detail = JSON.parse(error.details) as { cooldown_until?: string; retry_after_seconds?: number };
    return {
      message,
      isRateLimited,
      cooldownUntil: detail.cooldown_until,
      retryAfterSeconds: detail.retry_after_seconds,
    };
  } catch {
    return { message, isRateLimited };
  }
}
