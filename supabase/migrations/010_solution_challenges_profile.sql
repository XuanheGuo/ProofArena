-- Solution challenge metadata for arena-style submissions and profile portfolios.

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS challenge_target_solution_id TEXT,
  ADD COLUMN IF NOT EXISTS challenge_claim TEXT,
  ADD COLUMN IF NOT EXISTS challenge_advantages TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS challenge_risk TEXT;

ALTER TABLE solutions
  ADD COLUMN IF NOT EXISTS challenge_target_solution_id TEXT REFERENCES solutions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS challenge_target_solution_title TEXT,
  ADD COLUMN IF NOT EXISTS challenge_target_solution_author TEXT,
  ADD COLUMN IF NOT EXISTS challenge_claim TEXT,
  ADD COLUMN IF NOT EXISTS challenge_advantages TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS challenge_risk TEXT;

CREATE INDEX IF NOT EXISTS idx_submissions_challenge_target
  ON submissions(challenge_target_solution_id)
  WHERE challenge_target_solution_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_solutions_author_id
  ON solutions(author_id)
  WHERE author_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_solutions_challenge_target
  ON solutions(challenge_target_solution_id)
  WHERE challenge_target_solution_id IS NOT NULL;
