-- Repair an older submissions table so the Studio and submit forms can write
-- both problem and solution submissions without recreating existing data.

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS submission_type TEXT NOT NULL DEFAULT 'solution',
  ADD COLUMN IF NOT EXISTS problem_source TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS moderator_notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'submissions_submission_type_check'
      AND conrelid = 'public.submissions'::regclass
  ) THEN
    ALTER TABLE submissions
      ADD CONSTRAINT submissions_submission_type_check
      CHECK (submission_type IN ('problem', 'solution'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'submissions_status_check'
      AND conrelid = 'public.submissions'::regclass
  ) THEN
    ALTER TABLE submissions
      ADD CONSTRAINT submissions_status_check
      CHECK (status IN ('pending', 'approved', 'rejected', 'needs_revision'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'submissions_problem_contract'
      AND conrelid = 'public.submissions'::regclass
  ) THEN
    ALTER TABLE submissions
      ADD CONSTRAINT submissions_problem_contract
      CHECK (
        (submission_type = 'solution' AND problem_id IS NOT NULL)
        OR
        (submission_type = 'problem' AND problem_id IS NULL AND problem_source IS NOT NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_problem_id ON submissions(problem_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);

NOTIFY pgrst, 'reload schema';
