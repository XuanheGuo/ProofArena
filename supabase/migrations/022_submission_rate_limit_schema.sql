-- Anti-abuse (part 1/2): inert schema for submission rate limiting + precheck.
--
-- This migration is intentionally a no-op for observable behavior: it adds a
-- new bookkeeping table (submission_rate_limits) and two nullable columns on
-- submissions, but nothing writes to them yet. The enforcement — the actual
-- trigger logic that reads/writes these, plus the RLS/constraint widening
-- required for a 'precheck_failed' status to be insertable — lands in
-- 023_submission_rate_limit_enforcement.sql. Split the same way 020/021
-- split contest access-control schema from its enforcement, so each half can
-- be applied and verified independently against the live Weekly 01 contest.
--
-- submission_rate_limits tracks two independent things, one row per
-- (user_id, scope_key):
--   - window_count / window_started_at: a rolling frequency window, owned
--     exclusively by enforce_submission_rate_limit() (023).
--   - consecutive_failures / cooldown_until: escalating-cooldown state after
--     repeated precheck failures, owned exclusively by
--     enforce_submission_screening() (023).
-- Splitting ownership by column (rather than having either trigger touch
-- both) avoids any write-write ambiguity between the two BEFORE INSERT
-- triggers that will fire on the same statement.

CREATE TABLE IF NOT EXISTS submission_rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  scope_key TEXT NOT NULL,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_count INT NOT NULL DEFAULT 0,
  consecutive_failures INT NOT NULL DEFAULT 0,
  cooldown_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, scope_key)
);

CREATE INDEX IF NOT EXISTS idx_submission_rate_limits_user ON submission_rate_limits(user_id);

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS precheck_result JSONB;

ALTER TABLE submission_rate_limits ENABLE ROW LEVEL SECURITY;

-- No client INSERT/UPDATE/DELETE policy at all: every write goes through a
-- SECURITY DEFINER trigger (023), or a moderator-only server action for
-- manually clearing a cooldown (lib/submission-rate-limit-actions.ts, using
-- createServiceClient() — same pattern as lib/contest-registration-actions.ts).

DROP POLICY IF EXISTS "Users can view own rate limit state" ON submission_rate_limits;

CREATE POLICY "Users can view own rate limit state"
  ON submission_rate_limits FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Moderators can view rate limit state" ON submission_rate_limits;

CREATE POLICY "Moderators can view rate limit state"
  ON submission_rate_limits FOR SELECT
  USING (
    auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
    OR EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('moderator', 'admin')
    )
  );

NOTIFY pgrst, 'reload schema';
