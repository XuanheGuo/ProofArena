-- Let a submission's author revise it and resubmit for review when a
-- moderator has marked it needs_revision, matching the "保存并要求修改"
-- workflow already in components/AdminSubmissionsView.tsx (which writes
-- status = 'needs_revision' + moderator_notes but gives the author no way
-- to edit the original row back — submissions currently has no author
-- UPDATE policy at all, only the "Moderators can update submissions"
-- policy from 003_repair_submission_review_policies.sql).
--
-- Scope: regular (non-contest) submissions only. Contest-bound submissions
-- (contest_id / contest_slug set) are intentionally excluded — the existing
-- admin review path never edits their `content` either (AdminSubmissionsView
-- .saveReview only patches moderator_notes + status for those), and
-- 005_contest_submission_window.sql's window trigger fires on any UPDATE
-- touching `status`; keeping contest rows out of this policy avoids that
-- interaction entirely rather than trying to reason about it under a live
-- contest.
--
-- Same two-layer defense as 017_harden_profile_and_submission_rls.sql:
-- a USING/WITH CHECK policy for the coarse row-level gate, plus a BEFORE
-- UPDATE trigger for column-level enforcement RLS can't express (WITH CHECK
-- only sees the NEW row, not OLD, so it can't itself diff/protect fields).

DROP POLICY IF EXISTS "Authors can revise needs_revision submissions" ON submissions;

CREATE POLICY "Authors can revise needs_revision submissions"
  ON submissions FOR UPDATE
  USING (
    auth.uid() = user_id
    AND status = 'needs_revision'
    AND contest_id IS NULL
    AND NULLIF(contest_slug, '') IS NULL
  )
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND contest_id IS NULL
    AND NULLIF(contest_slug, '') IS NULL
  );

CREATE OR REPLACE FUNCTION public.enforce_submission_revision_fields()
RETURNS TRIGGER AS $$
DECLARE
  actor_is_privileged BOOLEAN;
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

  IF actor_is_privileged THEN
    RETURN NEW;
  END IF;

  -- Non-privileged actor: the only row-level policy that could have let this
  -- UPDATE reach here is "Authors can revise needs_revision submissions"
  -- above, so this is always the submission's own author resubmitting a
  -- needs_revision row. Author may change exactly the fields the original
  -- SubmitForm insert let them set — title, content, kind, problem_source
  -- (the source citation on 'problem'-type submissions), attachment_urls,
  -- and challenge_claim/advantages/risk (revising the pitch, not the
  -- target). Everything that identifies *what this row is* rather than
  -- *what the author said* reverts to its stored value, and the row always
  -- comes back as 'pending' with cleared moderator notes so review starts
  -- clean — mirrors enforce_pending_submission_status's BEFORE INSERT
  -- behavior.
  NEW.status := 'pending';
  NEW.moderator_notes := NULL;
  NEW.submission_type := OLD.submission_type;
  NEW.problem_id := OLD.problem_id;
  NEW.draft_problem_id := OLD.draft_problem_id;
  NEW.user_id := OLD.user_id;
  NEW.contest_id := OLD.contest_id;
  NEW.contest_problem_id := OLD.contest_problem_id;
  NEW.contest_slug := OLD.contest_slug;
  NEW.contest_problem_key := OLD.contest_problem_key;
  NEW.contest_solution_type := OLD.contest_solution_type;
  NEW.is_post_contest := OLD.is_post_contest;
  NEW.challenge_target_solution_id := OLD.challenge_target_solution_id;
  NEW.created_at := OLD.created_at;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_submission_revision_fields_before_update ON submissions;

CREATE TRIGGER enforce_submission_revision_fields_before_update
  BEFORE UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_submission_revision_fields();

NOTIFY pgrst, 'reload schema';
