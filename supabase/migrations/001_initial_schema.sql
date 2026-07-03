-- ProofArena Supabase Schema Migration
-- Phase 1: Core content tables (problems, solutions, knowledge)
-- Phase 2: Community features (users, submissions, votes, favorites, comments)
-- Phase 3: Competition features (competitions, entries, scores, leaderboards)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PHASE 1: Core Content Tables
-- ============================================================================

-- Problems table (migrated from data/problems.ts)
CREATE TABLE problems (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  region TEXT NOT NULL CHECK (region IN ('天津卷', '北京卷', '新高考 I 卷', '新高考 II 卷')),
  paper TEXT NOT NULL,
  number TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('基础', '中档', '压轴')),
  question_type TEXT NOT NULL CHECK (question_type IN ('单选', '多选', '填空', '解答')),
  tags TEXT[] NOT NULL DEFAULT '{}',
  title TEXT NOT NULL,
  statement TEXT[] NOT NULL,
  answer TEXT NOT NULL,
  heat INTEGER NOT NULL DEFAULT 0,
  source_pdf TEXT,
  source_page INTEGER,
  answer_pdf TEXT,
  learning_guide JSONB NOT NULL,
  solution_tree JSONB,
  knowledge_ids TEXT[] DEFAULT '{}',
  insight_ids TEXT[] DEFAULT '{}',
  auto_matches JSONB DEFAULT '[]',
  manual_matches JSONB DEFAULT '[]',
  concept_links JSONB DEFAULT '[]',
  concept_contrasts JSONB DEFAULT '[]',
  boundary_notes JSONB DEFAULT '[]',
  contrast_problems JSONB DEFAULT '[]',
  why_not_methods JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Solutions table
CREATE TABLE solutions (
  id TEXT PRIMARY KEY,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('standard', 'insight', 'robust', 'teaching')),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  author_role TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  badge TEXT NOT NULL,
  origin TEXT NOT NULL,
  key_transform TEXT NOT NULL,
  thinking_cues JSONB NOT NULL,
  inspiration TEXT NOT NULL,
  transfer_value TEXT NOT NULL,
  suitable_for TEXT[] NOT NULL DEFAULT '{}',
  tradeoffs TEXT[] NOT NULL DEFAULT '{}',
  limitations TEXT[] NOT NULL DEFAULT '{}',
  summary TEXT[] NOT NULL DEFAULT '{}',
  scores JSONB NOT NULL, -- {correctness, examReady, elegance, calculation, explanation}
  scoring_reason TEXT NOT NULL,
  verification JSONB NOT NULL,
  estimated_minutes INTEGER NOT NULL,
  knowledge_ids TEXT[] DEFAULT '{}',
  insight_ids TEXT[] DEFAULT '{}',
  auto_matches JSONB DEFAULT '[]',
  manual_matches JSONB DEFAULT '[]',
  concept_links JSONB DEFAULT '[]',
  concept_contrasts JSONB DEFAULT '[]',
  boundary_notes JSONB DEFAULT '[]',
  contrast_problems JSONB DEFAULT '[]',
  why_not_methods JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Knowledge nodes table
CREATE TABLE knowledge_nodes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  summary TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  prerequisites TEXT[] DEFAULT '{}',
  related_ids TEXT[] DEFAULT '{}',
  examples TEXT[] DEFAULT '{}',
  concept_links JSONB DEFAULT '[]',
  concept_contrasts JSONB DEFAULT '[]',
  boundary_notes JSONB DEFAULT '[]',
  contrast_problems JSONB DEFAULT '[]',
  why_not_methods JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insight nodes table
CREATE TABLE insight_nodes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  trigger TEXT NOT NULL,
  idea TEXT NOT NULL,
  applies_to TEXT[] DEFAULT '{}',
  related_knowledge_ids TEXT[] DEFAULT '{}',
  related_problem_ids TEXT[] DEFAULT '{}',
  difficulty TEXT NOT NULL CHECK (difficulty IN ('基础', '中档', '压轴')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PHASE 2: Community Features
-- ============================================================================

-- User profiles (Supabase Auth handles authentication)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'contributor', 'moderator', 'admin')),
  reputation INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Community solution submissions
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_type TEXT NOT NULL DEFAULT 'solution' CHECK (submission_type IN ('problem', 'solution')),
  problem_id TEXT REFERENCES problems(id) ON DELETE CASCADE,
  problem_source TEXT,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('standard', 'insight', 'robust', 'teaching')),
  title TEXT NOT NULL,
  content JSONB NOT NULL, -- Full solution structure
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_revision')),
  moderator_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT submissions_problem_contract CHECK (
    (submission_type = 'solution' AND problem_id IS NOT NULL)
    OR
    (submission_type = 'problem' AND problem_id IS NULL AND problem_source IS NOT NULL)
  )
);

-- Votes (problems, solutions, submissions)
CREATE TABLE votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('problem', 'solution', 'submission', 'comment')),
  target_id TEXT NOT NULL, -- Can be problem.id, solution.id, submission.id, or comment.id
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, target_type, target_id)
);

-- User favorites
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, problem_id)
);

-- Comments (problems, solutions, submissions)
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('problem', 'solution', 'submission')),
  target_id TEXT NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE, -- For threaded comments
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- PHASE 3: Competition Features
-- ============================================================================

-- Competitions (arena battles and ranked matches)
CREATE TABLE competitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('arena', 'ranked', 'practice')),
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  rules JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Competition problems (many-to-many)
CREATE TABLE competition_problems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  points INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competition_id, problem_id)
);

-- Competition entries (user participation)
CREATE TABLE competition_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  solution_data JSONB NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  score INTEGER,
  rank INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(competition_id, user_id)
);

-- Leaderboards (computed rankings)
CREATE TABLE leaderboards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  competition_id UUID REFERENCES competitions(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  elo_rating INTEGER DEFAULT 1200, -- For ranked matches
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, competition_id)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- Problems indexes
CREATE INDEX idx_problems_year ON problems(year);
CREATE INDEX idx_problems_region ON problems(region);
CREATE INDEX idx_problems_difficulty ON problems(difficulty);
CREATE INDEX idx_problems_tags ON problems USING GIN(tags);
CREATE INDEX idx_problems_heat ON problems(heat DESC);

-- Solutions indexes
CREATE INDEX idx_solutions_problem_id ON solutions(problem_id);
CREATE INDEX idx_solutions_kind ON solutions(kind);

-- Submissions indexes
CREATE INDEX idx_submissions_user_id ON submissions(user_id);
CREATE INDEX idx_submissions_problem_id ON submissions(problem_id);
CREATE INDEX idx_submissions_status ON submissions(status);

-- Votes indexes
CREATE INDEX idx_votes_user_id ON votes(user_id);
CREATE INDEX idx_votes_target ON votes(target_type, target_id);

-- Comments indexes
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_target ON comments(target_type, target_id);

-- Competition indexes
CREATE INDEX idx_competitions_status ON competitions(status);
CREATE INDEX idx_competitions_type ON competitions(type);
CREATE INDEX idx_competitions_time ON competitions(start_time, end_time);

-- Leaderboards indexes
CREATE INDEX idx_leaderboards_competition ON leaderboards(competition_id, rank);
CREATE INDEX idx_leaderboards_user ON leaderboards(user_id);
CREATE INDEX idx_leaderboards_elo ON leaderboards(elo_rating DESC);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_entries ENABLE ROW LEVEL SECURITY;

-- User profiles: users can read all, update own
CREATE POLICY "Public profiles are viewable by everyone"
  ON user_profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Submissions: users can create own, moderators can update
CREATE POLICY "Users can create submissions"
  ON submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own submissions"
  ON submissions FOR SELECT
  USING (auth.uid() = user_id OR status = 'approved');

CREATE POLICY "Moderators can view submissions"
  ON submissions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('moderator', 'admin')
    )
    OR auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
  );

CREATE POLICY "Moderators can update submissions"
  ON submissions FOR UPDATE
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

-- Votes: users can create own, view all
CREATE POLICY "Users can vote"
  ON votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Votes are viewable by everyone"
  ON votes FOR SELECT
  USING (true);

-- Favorites: users can manage own
CREATE POLICY "Users can manage own favorites"
  ON favorites FOR ALL
  USING (auth.uid() = user_id);

-- Comments: users can create own, view all
CREATE POLICY "Users can comment"
  ON comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Comments are viewable by everyone"
  ON comments FOR SELECT
  USING (true);

-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create an application profile automatically when a Supabase Auth user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'username', ''), split_part(NEW.email, '@', 1)),
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''), NULLIF(NEW.raw_user_meta_data ->> 'username', ''), split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.user_profiles (id, username, display_name)
SELECT
  users.id,
  COALESCE(NULLIF(users.raw_user_meta_data ->> 'username', ''), split_part(users.email, '@', 1)),
  COALESCE(NULLIF(users.raw_user_meta_data ->> 'display_name', ''), NULLIF(users.raw_user_meta_data ->> 'username', ''), split_part(users.email, '@', 1))
FROM auth.users AS users
ON CONFLICT (id) DO NOTHING;

-- Apply to all tables with updated_at
CREATE TRIGGER update_problems_updated_at BEFORE UPDATE ON problems
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_solutions_updated_at BEFORE UPDATE ON solutions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_competitions_updated_at BEFORE UPDATE ON competitions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
