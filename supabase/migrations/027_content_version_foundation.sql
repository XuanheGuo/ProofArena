-- Math Hub v2, Phase 1: immutable version + provenance foundation for the
-- existing `problems` and `solutions` stable-entity tables. See
-- docs/ARCHITECTURE_V2.md §4. Additive only: no existing column is touched,
-- no existing read path is required to change.

CREATE TABLE IF NOT EXISTS problem_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  problem_id TEXT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  parent_version_id UUID REFERENCES problem_versions(id) ON DELETE SET NULL,
  content JSONB NOT NULL,
  content_hash TEXT NOT NULL,
  change_summary TEXT NOT NULL DEFAULT '',
  source_snapshot JSONB,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  UNIQUE (problem_id, version_number),
  CHECK (published_at IS NULL OR published_at >= created_at)
);

CREATE TABLE IF NOT EXISTS solution_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  solution_id TEXT NOT NULL REFERENCES solutions(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL CHECK (version_number > 0),
  parent_version_id UUID REFERENCES solution_versions(id) ON DELETE SET NULL,
  content JSONB NOT NULL,
  content_hash TEXT NOT NULL,
  change_summary TEXT NOT NULL DEFAULT '',
  source_submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  source_snapshot JSONB,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  UNIQUE (solution_id, version_number),
  CHECK (published_at IS NULL OR published_at >= created_at)
);

CREATE INDEX IF NOT EXISTS idx_problem_versions_problem ON problem_versions(problem_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_problem_versions_hash ON problem_versions(problem_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_solution_versions_solution ON solution_versions(solution_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_solution_versions_hash ON solution_versions(solution_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_solution_versions_submission ON solution_versions(source_submission_id);

-- Pointer to the current version. Nullable and unused by any existing query --
-- adding it does not change behavior of any existing route. Populated by
-- scripts/backfill-content-versions.mts and, going forward, by
-- domains/content/versioning on every new version.
ALTER TABLE problems ADD COLUMN IF NOT EXISTS current_version_id UUID REFERENCES problem_versions(id) ON DELETE SET NULL;
ALTER TABLE solutions ADD COLUMN IF NOT EXISTS current_version_id UUID REFERENCES solution_versions(id) ON DELETE SET NULL;

ALTER TABLE problem_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE solution_versions ENABLE ROW LEVEL SECURITY;

-- problems/solutions themselves carry no RLS (open catalog, see lib/db.ts) --
-- versions mirror that: readable by everyone. No INSERT/UPDATE/DELETE policy
-- for anon/authenticated exists for either table: every version is created by
-- the service-role client only (domains/content/versioning), matching the
-- verification_tasks convention of "service-role is the only writer."
DROP POLICY IF EXISTS "Problem versions are viewable by everyone" ON problem_versions;
CREATE POLICY "Problem versions are viewable by everyone" ON problem_versions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Solution versions are viewable by everyone" ON solution_versions;
CREATE POLICY "Solution versions are viewable by everyone" ON solution_versions FOR SELECT
  USING (true);

NOTIFY pgrst, 'reload schema';
