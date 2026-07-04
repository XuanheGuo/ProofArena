-- ProofArena contest arena MVP
-- Adds a lightweight activity layer on top of existing problems/submissions/solutions.

CREATE TABLE IF NOT EXISTS contests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  rules TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'judging', 'finished')),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contest_problems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  problem_id TEXT REFERENCES problems(id) ON DELETE SET NULL,
  day_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  theme TEXT NOT NULL DEFAULT '',
  open_at TIMESTAMPTZ NOT NULL,
  close_at TIMESTAMPTZ NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'open', 'reviewing', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(contest_id, day_index),
  UNIQUE(contest_id, problem_id)
);

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS contest_id UUID REFERENCES contests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contest_problem_id UUID REFERENCES contest_problems(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contest_slug TEXT,
  ADD COLUMN IF NOT EXISTS contest_problem_key TEXT,
  ADD COLUMN IF NOT EXISTS contest_solution_type TEXT CHECK (
    contest_solution_type IS NULL OR contest_solution_type IN (
      'standard',
      'clever',
      'teaching',
      'geometry',
      'algebra',
      'construction',
      'wrong_analysis',
      'variant',
      'supplement'
    )
  ),
  ADD COLUMN IF NOT EXISTS is_post_contest BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE solutions
  ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contest_id UUID REFERENCES contests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contest_problem_id UUID REFERENCES contest_problems(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contest_slug TEXT,
  ADD COLUMN IF NOT EXISTS contest_problem_key TEXT,
  ADD COLUMN IF NOT EXISTS contest_solution_type TEXT CHECK (
    contest_solution_type IS NULL OR contest_solution_type IN (
      'standard',
      'clever',
      'teaching',
      'geometry',
      'algebra',
      'construction',
      'wrong_analysis',
      'variant',
      'supplement'
    )
  ),
  ADD COLUMN IF NOT EXISTS is_post_contest BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS solution_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  solution_id TEXT NOT NULL REFERENCES solutions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  correctness NUMERIC NOT NULL CHECK (correctness >= 0 AND correctness <= 5),
  clarity NUMERIC NOT NULL CHECK (clarity >= 0 AND clarity <= 5),
  elegance NUMERIC NOT NULL CHECK (elegance >= 0 AND elegance <= 5),
  insight NUMERIC NOT NULL CHECK (insight >= 0 AND insight <= 5),
  exam_usability NUMERIC NOT NULL CHECK (exam_usability >= 0 AND exam_usability <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(solution_id, user_id)
);

CREATE TABLE IF NOT EXISTS awards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contest_id UUID NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  problem_id TEXT REFERENCES problems(id) ON DELETE SET NULL,
  solution_id TEXT REFERENCES solutions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN (
    'fastest',
    'best_standard',
    'best_clever',
    'best_teaching',
    'best_wrong_analysis',
    'best_comment',
    'best_overall',
    'best_variant',
    'best_contributor'
  )),
  title TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contests_slug ON contests(slug);
CREATE INDEX IF NOT EXISTS idx_contest_problems_contest ON contest_problems(contest_id, day_index);
CREATE INDEX IF NOT EXISTS idx_contest_problems_problem ON contest_problems(problem_id);
CREATE INDEX IF NOT EXISTS idx_submissions_contest ON submissions(contest_id, contest_problem_id);
CREATE INDEX IF NOT EXISTS idx_submissions_contest_slug ON submissions(contest_slug, contest_problem_key);
CREATE INDEX IF NOT EXISTS idx_solutions_contest ON solutions(contest_id, contest_problem_id);
CREATE INDEX IF NOT EXISTS idx_solutions_contest_slug ON solutions(contest_slug, contest_problem_key);
CREATE INDEX IF NOT EXISTS idx_solution_ratings_solution ON solution_ratings(solution_id);
CREATE INDEX IF NOT EXISTS idx_awards_contest ON awards(contest_id);

ALTER TABLE contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE solution_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contests are viewable by everyone"
  ON contests FOR SELECT
  USING (true);

CREATE POLICY "Contest problems are viewable by everyone"
  ON contest_problems FOR SELECT
  USING (true);

CREATE POLICY "Solution ratings are viewable by everyone"
  ON solution_ratings FOR SELECT
  USING (true);

CREATE POLICY "Users can rate public solutions"
  ON solution_ratings FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM solutions
      WHERE solutions.id = solution_id
        AND solutions.author_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own solution ratings"
  ON solution_ratings FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Awards are viewable by everyone"
  ON awards FOR SELECT
  USING (true);

CREATE POLICY "Moderators can manage contests"
  ON contests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('moderator', 'admin')
    )
    OR auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('moderator', 'admin')
    )
    OR auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
  );

CREATE POLICY "Moderators can manage contest problems"
  ON contest_problems FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('moderator', 'admin')
    )
    OR auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('moderator', 'admin')
    )
    OR auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
  );

CREATE POLICY "Moderators can manage awards"
  ON awards FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('moderator', 'admin')
    )
    OR auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('moderator', 'admin')
    )
    OR auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
  );

CREATE TRIGGER update_contests_updated_at BEFORE UPDATE ON contests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contest_problems_updated_at BEFORE UPDATE ON contest_problems
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_solution_ratings_updated_at BEFORE UPDATE ON solution_ratings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
