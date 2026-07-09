-- Allow moderators to review contest submissions after the official
-- submission window closes.
--
-- 016_repair_draft_contest_submission_window.sql included `status` in the
-- trigger column list so contest submission status updates re-entered the
-- same window checks as a fresh user submission. That blocked the normal
-- review flow once an auto_time contest problem had closed:
-- pending -> approved raised "This contest problem is closed for official
-- submissions." even though the row had already been submitted in time.
--
-- Keep strict window enforcement for INSERTs and for updates that change the
-- contest/problem binding. Skip it only for existing contest submissions whose
-- target identity is unchanged; RLS still decides who can update `status`.

CREATE OR REPLACE FUNCTION public.enforce_contest_submission_window()
RETURNS TRIGGER AS $$
DECLARE
  contest_row RECORD;
  contest_problem_row RECORD;
BEGIN
  IF NEW.submission_type <> 'solution' THEN
    RETURN NEW;
  END IF;

  IF NEW.contest_id IS NULL AND NULLIF(NEW.contest_slug, '') IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND NEW.submission_type IS NOT DISTINCT FROM OLD.submission_type
    AND NEW.problem_id IS NOT DISTINCT FROM OLD.problem_id
    AND NEW.draft_problem_id IS NOT DISTINCT FROM OLD.draft_problem_id
    AND NEW.contest_id IS NOT DISTINCT FROM OLD.contest_id
    AND NEW.contest_slug IS NOT DISTINCT FROM OLD.contest_slug
    AND NEW.contest_problem_id IS NOT DISTINCT FROM OLD.contest_problem_id
    AND NEW.contest_problem_key IS NOT DISTINCT FROM OLD.contest_problem_key
    AND NEW.is_post_contest IS NOT DISTINCT FROM OLD.is_post_contest
  THEN
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
