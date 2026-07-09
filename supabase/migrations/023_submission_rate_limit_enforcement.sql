-- Anti-abuse (part 2/2): the actual enforcement.
--
-- Replaces the old flat "20 submissions/hour, no scoping, no bypass" rate
-- limit (enforce_submission_rate_limit, 008_contest_thought_arena.sql) with
-- a per-(user, problem-or-contest-problem) scoped limit that also honors a
-- persisted cooldown, and adds a new lightweight precheck trigger that keeps
-- empty/duplicate junk out of the moderator review queue (status is set to
-- 'precheck_failed' instead of 'pending', row is still inserted so the
-- submitter can see why and moderators can audit it).
--
-- Trigger firing order on submissions (Postgres fires same-timing BEFORE
-- INSERT triggers in trigger-name alphabetical order, which this repo's
-- migrations already rely on):
--   1. enforce_contest_submission_window_before_write (021) — sets
--      NEW.contest_problem_id etc., gates on contest registration/window.
--   2. enforce_pending_submission_status_before_insert (017) — forces
--      NEW.status back to 'pending' unconditionally for non-privileged
--      actors.
--   3. enforce_submission_rate_limit_before_insert (008, replaced here) —
--      frequency/cooldown check. Owns submission_rate_limits.window_count /
--      window_started_at exclusively.
--   4. enforce_submission_screening_before_insert (new, this migration) —
--      precheck. Named to sort after #3 so it can freely override the
--      'pending' status set by #2 without being clobbered. Owns
--      submission_rate_limits.consecutive_failures / cooldown_until
--      exclusively.
--
-- Both #3 and #4 write to the same submission_rate_limits row but touch
-- disjoint columns, so there is no write-write conflict between them within
-- one INSERT statement.
--
-- RLS/constraint widening (must land in this migration, not the inert one):
-- once #4 can set status = 'precheck_failed', both the CHECK constraint and
-- the client INSERT policy's WITH CHECK — which Postgres evaluates against
-- the row AFTER BEFORE INSERT triggers run — must already allow that value,
-- or every non-privileged insert starts failing the moment precheck fires.

-- ============================================================================
-- Widen the status constraint + INSERT policy to allow 'precheck_failed'
-- ============================================================================

ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_status_check;

ALTER TABLE submissions
  ADD CONSTRAINT submissions_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'needs_revision', 'precheck_failed'));

DROP POLICY IF EXISTS "Users can create submissions" ON submissions;

CREATE POLICY "Users can create submissions"
  ON submissions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND status IN ('pending', 'precheck_failed')
    AND moderator_notes IS NULL
  );

-- ============================================================================
-- Trigger #3: scoped rate limit + escalating cooldown check
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_submission_rate_limit()
RETURNS TRIGGER AS $$
DECLARE
  actor_is_privileged BOOLEAN;
  v_scope_key TEXT;
  v_rate_row RECORD;
  v_scope_count INT;
  v_global_count INT;
  v_wait_seconds INT;
  v_scope_limit CONSTANT INT := 5;
  v_scope_window CONSTANT INTERVAL := INTERVAL '10 minutes';
  v_global_limit CONSTANT INT := 20;
  v_global_window CONSTANT INTERVAL := INTERVAL '1 hour';
BEGIN
  actor_is_privileged := (
    auth.role() = 'service_role'
    OR auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
    OR EXISTS (
      SELECT 1 FROM public.user_profiles AS actor
      WHERE actor.id = auth.uid()
        AND actor.role IN ('moderator', 'admin')
    )
  );

  -- Moderators/admins/the owner account/service-role are fully exempt, so
  -- testing and manual moderator submissions are never blocked.
  IF actor_is_privileged THEN
    RETURN NEW;
  END IF;

  v_scope_key := COALESCE(
    'contest_problem:' || NEW.contest_problem_id::TEXT,
    'problem:' || NEW.problem_id,
    'draft_problem:' || NEW.draft_problem_id,
    'general'
  );

  SELECT * INTO v_rate_row
  FROM public.submission_rate_limits
  WHERE user_id = NEW.user_id AND scope_key = v_scope_key;

  IF v_rate_row.cooldown_until IS NOT NULL AND v_rate_row.cooldown_until > NOW() THEN
    v_wait_seconds := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_rate_row.cooldown_until - NOW())))::INT);
    RAISE EXCEPTION '提交过于频繁，请在约 % 秒后重试。', v_wait_seconds
      USING DETAIL = jsonb_build_object(
        'reason', 'cooldown',
        'cooldown_until', v_rate_row.cooldown_until,
        'retry_after_seconds', v_wait_seconds
      )::TEXT;
  END IF;

  IF v_rate_row.user_id IS NOT NULL AND v_rate_row.window_started_at > NOW() - v_scope_window THEN
    v_scope_count := v_rate_row.window_count;
  ELSE
    v_scope_count := 0;
  END IF;

  IF v_scope_count >= v_scope_limit THEN
    v_wait_seconds := GREATEST(1, CEIL(EXTRACT(EPOCH FROM ((v_rate_row.window_started_at + v_scope_window) - NOW())))::INT);
    RAISE EXCEPTION '同一题目提交过于频繁，请在约 % 秒后重试。', v_wait_seconds
      USING DETAIL = jsonb_build_object(
        'reason', 'rate_limited',
        'retry_after_seconds', v_wait_seconds
      )::TEXT;
  END IF;

  -- Coarse global fallback (all scopes combined), same threshold as the
  -- flat limit this replaces — defense in depth against spreading
  -- submissions across many problems to dodge the per-scope cap above.
  SELECT COUNT(*) INTO v_global_count
  FROM public.submissions
  WHERE user_id = NEW.user_id AND created_at > NOW() - v_global_window;

  IF v_global_count >= v_global_limit THEN
    RAISE EXCEPTION '提交过于频繁，请稍后再试。'
      USING DETAIL = jsonb_build_object('reason', 'rate_limited')::TEXT;
  END IF;

  INSERT INTO public.submission_rate_limits (user_id, scope_key, window_started_at, window_count)
  VALUES (NEW.user_id, v_scope_key, NOW(), 1)
  ON CONFLICT (user_id, scope_key) DO UPDATE SET
    window_count = CASE
      WHEN submission_rate_limits.window_started_at > NOW() - v_scope_window
        THEN submission_rate_limits.window_count + 1
        ELSE 1
      END,
    window_started_at = CASE
      WHEN submission_rate_limits.window_started_at > NOW() - v_scope_window
        THEN submission_rate_limits.window_started_at
        ELSE NOW()
      END,
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger already exists (008) under this name; body is replaced above via
-- CREATE OR REPLACE, so it keeps its current alphabetical position in the
-- BEFORE INSERT chain. Re-declared here only so this migration is
-- re-runnable end to end, matching this repo's convention.
DROP TRIGGER IF EXISTS enforce_submission_rate_limit_before_insert ON submissions;

CREATE TRIGGER enforce_submission_rate_limit_before_insert
  BEFORE INSERT ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_submission_rate_limit();

-- ============================================================================
-- Trigger #4: lightweight precheck (empty/too-short, exact duplicate)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_submission_screening()
RETURNS TRIGGER AS $$
DECLARE
  actor_is_privileged BOOLEAN;
  v_scope_key TEXT;
  v_content_text TEXT;
  v_is_duplicate BOOLEAN;
  v_consecutive INT;
  v_cooldown INTERVAL;
BEGIN
  -- Problem proposals aren't the review-queue flood vector this addresses;
  -- only solution submissions get screened.
  IF NEW.submission_type <> 'solution' THEN
    RETURN NEW;
  END IF;

  actor_is_privileged := (
    auth.role() = 'service_role'
    OR auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
    OR EXISTS (
      SELECT 1 FROM public.user_profiles AS actor
      WHERE actor.id = auth.uid()
        AND actor.role IN ('moderator', 'admin')
    )
  );

  IF actor_is_privileged THEN
    RETURN NEW;
  END IF;

  -- Every submissions.content shape in this codebase (SubmitForm,
  -- StudioWorkspace) carries a top-level "markdown" key, so this check
  -- reads that field directly rather than length(content::text), which
  -- would be skewed by how much non-text JSON scaffolding a given insert
  -- path happens to send.
  v_content_text := trim(COALESCE(NEW.content ->> 'markdown', ''));

  IF length(trim(COALESCE(NEW.title, ''))) = 0 OR length(v_content_text) < 15 THEN
    NEW.status := 'precheck_failed';
    NEW.failure_reason := 'empty_or_too_short';
    NEW.precheck_result := jsonb_build_object(
      'checks', jsonb_build_object('not_empty', false),
      'content_length', length(v_content_text)
    );
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.submissions AS other
      WHERE other.user_id = NEW.user_id
        AND COALESCE(other.problem_id, other.draft_problem_id) = COALESCE(NEW.problem_id, NEW.draft_problem_id)
        AND other.created_at > NOW() - INTERVAL '24 hours'
        AND md5(COALESCE(other.title, '') || COALESCE(other.content ->> 'markdown', ''))
          = md5(COALESCE(NEW.title, '') || v_content_text)
    ) INTO v_is_duplicate;

    IF v_is_duplicate THEN
      NEW.status := 'precheck_failed';
      NEW.failure_reason := 'duplicate';
      NEW.precheck_result := jsonb_build_object(
        'checks', jsonb_build_object('not_empty', true, 'duplicate', true)
      );
    END IF;
  END IF;

  -- Escalating-cooldown bookkeeping. This trigger owns consecutive_failures
  -- / cooldown_until exclusively (see file header) so it never writes the
  -- window_count / window_started_at columns owned by the rate-limit
  -- trigger above.
  v_scope_key := COALESCE(
    'contest_problem:' || NEW.contest_problem_id::TEXT,
    'problem:' || NEW.problem_id,
    'draft_problem:' || NEW.draft_problem_id,
    'general'
  );

  IF NEW.status = 'precheck_failed' THEN
    INSERT INTO public.submission_rate_limits (user_id, scope_key, consecutive_failures)
    VALUES (NEW.user_id, v_scope_key, 1)
    ON CONFLICT (user_id, scope_key) DO UPDATE SET
      consecutive_failures = submission_rate_limits.consecutive_failures + 1,
      updated_at = NOW()
    RETURNING consecutive_failures INTO v_consecutive;

    v_cooldown := CASE
      WHEN v_consecutive >= 8 THEN INTERVAL '24 hours'
      WHEN v_consecutive >= 5 THEN INTERVAL '30 minutes'
      WHEN v_consecutive >= 3 THEN INTERVAL '5 minutes'
      ELSE NULL
    END;

    IF v_cooldown IS NOT NULL THEN
      UPDATE public.submission_rate_limits
      SET cooldown_until = NOW() + v_cooldown, updated_at = NOW()
      WHERE user_id = NEW.user_id AND scope_key = v_scope_key;
    END IF;
  ELSE
    -- A clean submission clears the streak.
    INSERT INTO public.submission_rate_limits (user_id, scope_key, consecutive_failures, cooldown_until)
    VALUES (NEW.user_id, v_scope_key, 0, NULL)
    ON CONFLICT (user_id, scope_key) DO UPDATE SET
      consecutive_failures = 0,
      cooldown_until = NULL,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_submission_screening_before_insert ON submissions;

CREATE TRIGGER enforce_submission_screening_before_insert
  BEFORE INSERT ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_submission_screening();

NOTIFY pgrst, 'reload schema';
