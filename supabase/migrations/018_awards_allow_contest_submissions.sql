-- Let contest awards point at approved contest submissions before those
-- submissions are promoted into public `solutions`.
ALTER TABLE awards
  ADD COLUMN IF NOT EXISTS submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS draft_problem_id TEXT REFERENCES problem_drafts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_awards_submission
  ON awards(submission_id);

CREATE INDEX IF NOT EXISTS idx_awards_draft_problem
  ON awards(draft_problem_id);
