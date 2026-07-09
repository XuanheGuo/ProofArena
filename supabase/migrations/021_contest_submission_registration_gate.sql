-- Contest access control, part 2: close the backend loop.
--
-- Extends enforce_contest_submission_window() (originally
-- 005_contest_submission_window.sql, most recently redefined in
-- 016_repair_draft_contest_submission_window.sql) with a registration-status
-- check, so access_mode/contest_registrations from
-- 020_contest_access_control.sql are actually enforced at the DB layer, not
-- just modeled. This is a pure CREATE OR REPLACE — trigger name, firing
-- conditions, and every existing check are unchanged, only the new gate is
-- inserted (right after the contest/contest-problem rows are resolved, so
-- it fires before the draft/window checks below it).
--
-- Rules (mirrors lib/contest-access.ts's computeContestSubmitAccess, which
-- implements the same matrix for UI hints only — this trigger is the real
-- enforcement):
--   - service_role / hardcoded owner email / moderator/admin: always bypass,
--     same privileged-actor pattern as every other trigger in this repo
--     (017_harden_profile_and_submission_rls.sql,
--     019_submission_author_revision.sql).
--   - registration status in (rejected, removed, suspended): blocked,
--     regardless of access_mode.
--   - access_mode = 'open': allowed (no registration row required).
--   - access_mode in ('approval', 'invite'): allowed only if registration
--     status is 'approved' or 'invited'.

CREATE OR REPLACE FUNCTION public.enforce_contest_submission_window()
RETURNS TRIGGER AS $$
DECLARE
  contest_row RECORD;
  contest_problem_row RECORD;
  registration_row RECORD;
  actor_is_privileged BOOLEAN;
BEGIN
  IF NEW.submission_type <> 'solution' THEN
    RETURN NEW;
  END IF;

  IF NEW.contest_id IS NULL AND NULLIF(NEW.contest_slug, '') IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
  INTO contest_row
  FROM public.contests
  WHERE
    (NEW.contest_id IS NOT NULL AND id = NEW.contest_id)
    OR
    (NEW.contest_id IS NULL AND slug = NEW.contest_slug)
  LIMIT 1;

  IF contest_row.id IS NULL THEN
    RAISE EXCEPTION 'Contest not found for contest submission.';
  END IF;

  SELECT *
  INTO contest_problem_row
  FROM public.contest_problems
  WHERE contest_problems.contest_id = contest_row.id
    AND (
      (NEW.problem_id IS NOT NULL AND contest_problems.problem_id = NEW.problem_id)
      OR
      (NEW.draft_problem_id IS NOT NULL AND contest_problems.draft_problem_id = NEW.draft_problem_id)
    )
  LIMIT 1;

  IF contest_problem_row.id IS NULL THEN
    RAISE EXCEPTION 'Contest submissions must target a problem in the contest.';
  END IF;

  NEW.contest_id = contest_row.id;
  NEW.contest_slug = contest_row.slug;
  NEW.contest_problem_id = contest_problem_row.id;
  NEW.contest_problem_key = contest_problem_row.id::TEXT;

  actor_is_privileged := (
    auth.role() = 'service_role'
    OR auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
    OR EXISTS (
      SELECT 1 FROM public.user_profiles AS actor
      WHERE actor.id = auth.uid()
        AND actor.role IN ('moderator', 'admin')
    )
  );

  IF NOT actor_is_privileged THEN
    SELECT *
    INTO registration_row
    FROM public.contest_registrations
    WHERE contest_registrations.contest_id = contest_row.id
      AND contest_registrations.user_id = NEW.user_id
    LIMIT 1;

    IF registration_row.status IN ('rejected', 'removed', 'suspended') THEN
      RAISE EXCEPTION 'You are not permitted to submit to this contest.';
    END IF;

    IF contest_row.access_mode IN ('approval', 'invite') THEN
      IF registration_row.status IS NULL OR registration_row.status NOT IN ('approved', 'invited') THEN
        RAISE EXCEPTION 'You must be approved or invited to submit to this contest.';
      END IF;
    END IF;
  END IF;

  IF contest_row.status = 'draft' THEN
    RAISE EXCEPTION 'Contest submissions are not allowed before the contest starts.';
  END IF;

  IF contest_row.status IN ('judging', 'finished') OR NOW() > contest_row.end_at THEN
    NEW.is_post_contest = TRUE;
    RETURN NEW;
  END IF;

  IF contest_row.status = 'active' THEN
    IF contest_problem_row.unlock_mode = 'auto_time' THEN
      IF NOW() < contest_problem_row.open_at THEN
        RAISE EXCEPTION 'This contest problem is not open yet.';
      END IF;
      IF NOW() >= contest_problem_row.close_at THEN
        RAISE EXCEPTION 'This contest problem is closed for official submissions.';
      END IF;
    ELSIF contest_problem_row.status <> 'open' THEN
      RAISE EXCEPTION 'This contest problem is not open for submissions.';
    END IF;

    NEW.is_post_contest = FALSE;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Contest submissions are not open for the current contest status.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_contest_submission_window_before_write ON submissions;

CREATE TRIGGER enforce_contest_submission_window_before_write
  BEFORE INSERT OR UPDATE OF contest_id, contest_slug, contest_problem_id, contest_problem_key, is_post_contest, problem_id, draft_problem_id, status
  ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_contest_submission_window();

NOTIFY pgrst, 'reload schema';
