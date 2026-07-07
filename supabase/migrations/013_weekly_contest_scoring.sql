-- Weekly contest format (see docs/WEEKLY_CONTEST_FORMAT.md and
-- docs/WEEKLY_CONTEST_IMPLEMENTATION_BRIEF.md) — Phase 1 data layer.
--
-- Adds a typed "phase" to contest_problems (daily / challenge / sprint /
-- major / discussion) plus the tables needed to score a multi-phase contest:
-- per-participant challenge multiplier, official judge scores, and timed
-- sprint attempts. This migration only adds the data model — sprint
-- unlock/submit routes, the full live leaderboard, and admin scoring UI
-- ship in later PRs.
--
-- Sprint answer keys deliberately live in a separate admin-only table
-- (contest_problem_answer_keys) rather than as a column on the publicly
-- readable contest_problems, so a public "select *" can never leak them.
--
-- Every CREATE TRIGGER / CREATE POLICY below is preceded by a DROP ... IF
-- EXISTS so this migration can be re-run from scratch (Postgres has no
-- CREATE TRIGGER / CREATE POLICY IF NOT EXISTS), matching 012_problem_vault.sql.

ALTER TABLE contest_problems
  ADD COLUMN IF NOT EXISTS problem_phase TEXT NOT NULL DEFAULT 'daily'
    CHECK (problem_phase IN ('daily', 'challenge', 'sprint', 'major', 'discussion')),
  ADD COLUMN IF NOT EXISTS score_max NUMERIC NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS score_policy TEXT NOT NULL DEFAULT 'manual'
    CHECK (score_policy IN ('manual', 'sprint_step', 'none')),
  ADD COLUMN IF NOT EXISTS multiplier_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS timed_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS time_limit_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS answer_type TEXT
    CHECK (answer_type IS NULL OR answer_type IN ('single_choice', 'multiple_choice', 'fill_blank')),
  ADD COLUMN IF NOT EXISTS answer_format_note TEXT NOT NULL DEFAULT '';

-- Sprint answer keys: admin/moderator read-write only. Kept off
-- contest_problems on purpose — see file header.
CREATE TABLE IF NOT EXISTS contest_problem_answer_keys (
  contest_problem_id UUID PRIMARY KEY REFERENCES contest_problems(id) ON DELETE CASCADE,
  answer_type TEXT NOT NULL CHECK (answer_type IN ('single_choice', 'multiple_choice', 'fill_blank')),
  answer_key JSONB NOT NULL,
  format_note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-participant contest profile: challenge multiplier and penalties.
-- Multiplier only ever applies to daily-phase scores (see format doc §3, §5).
CREATE TABLE IF NOT EXISTS contest_participant_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  contest_slug TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  challenge_score NUMERIC NOT NULL DEFAULT 0,
  challenge_multiplier NUMERIC NOT NULL DEFAULT 1.0 CHECK (challenge_multiplier >= 1.0 AND challenge_multiplier <= 1.25),
  multiplier_reason TEXT NOT NULL DEFAULT '',
  penalty_points NUMERIC NOT NULL DEFAULT 0,
  penalty_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contest_id, user_id)
);

-- Official judge scores for daily/challenge/major submissions. One row per
-- (contest_problem, user) — the judge's final score for that participant on
-- that problem, independent of how many submissions they made.
CREATE TABLE IF NOT EXISTS contest_submission_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  contest_problem_id UUID NOT NULL REFERENCES contest_problems(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  problem_phase TEXT NOT NULL,
  raw_score NUMERIC NOT NULL DEFAULT 0,
  score_max NUMERIC NOT NULL DEFAULT 100,
  rubric JSONB NOT NULL DEFAULT '{}'::jsonb,
  judge_note TEXT NOT NULL DEFAULT '',
  scored_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  scored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contest_problem_id, user_id)
);

-- Timed sprint attempts. unlock_at/submitted_at are server timestamps —
-- elapsed_ms must be computed server-side (unlock/submit API routes, added
-- in a later PR), never trusted from the client.
CREATE TABLE IF NOT EXISTS contest_sprint_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  contest_problem_id UUID NOT NULL REFERENCES contest_problems(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  unlock_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  elapsed_ms INTEGER,
  answer_raw TEXT,
  answer_normalized TEXT,
  is_correct BOOLEAN,
  score NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contest_problem_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_contest_problems_phase ON contest_problems(contest_id, problem_phase);
CREATE INDEX IF NOT EXISTS idx_contest_participant_profiles_contest ON contest_participant_profiles(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_submission_scores_contest ON contest_submission_scores(contest_id, problem_phase);
CREATE INDEX IF NOT EXISTS idx_contest_submission_scores_user ON contest_submission_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_contest_sprint_attempts_contest ON contest_sprint_attempts(contest_id);
CREATE INDEX IF NOT EXISTS idx_contest_sprint_attempts_user ON contest_sprint_attempts(user_id);

ALTER TABLE contest_problem_answer_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_participant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_submission_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_sprint_attempts ENABLE ROW LEVEL SECURITY;

-- contest_problem_answer_keys: default-deny, admin/moderator only — no
-- "viewable by everyone" policy, matching problem_drafts in 012_problem_vault.sql.
DROP POLICY IF EXISTS "Moderators can manage sprint answer keys" ON contest_problem_answer_keys;

CREATE POLICY "Moderators can manage sprint answer keys"
  ON contest_problem_answer_keys FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('moderator', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('moderator', 'admin')
    )
  );

-- contest_participant_profiles: challenge multiplier is part of the public
-- scoreboard (format doc §11), so it's readable by everyone; only
-- admin/moderator can write it (challenge scoring is a judged action).
DROP POLICY IF EXISTS "Contest participant profiles are viewable by everyone" ON contest_participant_profiles;
DROP POLICY IF EXISTS "Moderators can manage contest participant profiles" ON contest_participant_profiles;

CREATE POLICY "Contest participant profiles are viewable by everyone"
  ON contest_participant_profiles FOR SELECT
  USING (true);

CREATE POLICY "Moderators can manage contest participant profiles"
  ON contest_participant_profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('moderator', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('moderator', 'admin')
    )
  );

-- contest_submission_scores: same shape as ratings/awards elsewhere in the
-- contest schema — public can read scores for the live scoreboard, only
-- admin/moderator can write (these are judge-entered, not self-reported).
DROP POLICY IF EXISTS "Contest submission scores are viewable by everyone" ON contest_submission_scores;
DROP POLICY IF EXISTS "Moderators can manage contest submission scores" ON contest_submission_scores;

CREATE POLICY "Contest submission scores are viewable by everyone"
  ON contest_submission_scores FOR SELECT
  USING (true);

CREATE POLICY "Moderators can manage contest submission scores"
  ON contest_submission_scores FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('moderator', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('moderator', 'admin')
    )
  );

-- contest_sprint_attempts: contains raw/normalized answers and the score
-- itself, which must stay private before the official reveal AND must not
-- be writable by the participant it belongs to at all — even INSERT is not
-- safe to hand to the client here, because a user could INSERT their own
-- row directly with submitted_at/elapsed_ms/is_correct/score/answer_raw
-- already forged to whatever they want (RLS WITH CHECK on INSERT cannot by
-- itself stop a client from setting those columns — it only constrains
-- which rows the check accepts, not which columns the client is allowed to
-- provide values for).
--
-- So this table has NO user-facing policy at all — default deny for every
-- non-admin/moderator. Both the unlock step (creates the row, unlock_at =
-- server NOW()) and the submit step (computes elapsed_ms from the row's own
-- unlock_at, normalizes the answer, scores it) run entirely server-side
-- using the service role key:
--   app/api/contests/[slug]/sprint/[contestProblemId]/unlock/route.ts
--   app/api/contests/[slug]/sprint/[contestProblemId]/submit/route.ts
-- Neither route ever trusts a client-submitted score/elapsed_ms/is_correct
-- value — see those files for the full validation chain. admin/moderator
-- keep full read/write for review and manual override.
DROP POLICY IF EXISTS "Users can view own sprint attempts" ON contest_sprint_attempts;
DROP POLICY IF EXISTS "Users can create own sprint attempts" ON contest_sprint_attempts;
DROP POLICY IF EXISTS "Users can update own sprint attempts" ON contest_sprint_attempts;
DROP POLICY IF EXISTS "Moderators can manage sprint attempts" ON contest_sprint_attempts;

CREATE POLICY "Moderators can manage sprint attempts"
  ON contest_sprint_attempts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('moderator', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('moderator', 'admin')
    )
  );

DROP TRIGGER IF EXISTS update_contest_problem_answer_keys_updated_at ON contest_problem_answer_keys;
DROP TRIGGER IF EXISTS update_contest_participant_profiles_updated_at ON contest_participant_profiles;
DROP TRIGGER IF EXISTS update_contest_submission_scores_updated_at ON contest_submission_scores;
DROP TRIGGER IF EXISTS update_contest_sprint_attempts_updated_at ON contest_sprint_attempts;

CREATE TRIGGER update_contest_problem_answer_keys_updated_at BEFORE UPDATE ON contest_problem_answer_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contest_participant_profiles_updated_at BEFORE UPDATE ON contest_participant_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contest_submission_scores_updated_at BEFORE UPDATE ON contest_submission_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contest_sprint_attempts_updated_at BEFORE UPDATE ON contest_sprint_attempts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

NOTIFY pgrst, 'reload schema';
