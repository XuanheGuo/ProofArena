-- Math Hub v2 Phase 1.1: Runtime, Privacy, Semantic Correctness & Data Integrity Hardening
-- This migration fixes critical issues found in Phase 1 audit (see PHASE_1_1_AUDIT.md)

-- ============================================================================
-- P0-3: Fix Version Privacy (was: USING (true) allowed anon to read unpublished)
-- ============================================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Problem versions are viewable by everyone" ON problem_versions;
DROP POLICY IF EXISTS "Solution versions are viewable by everyone" ON solution_versions;

-- Anonymous users: only published versions
CREATE POLICY "anon_problem_versions_published" ON problem_versions FOR SELECT
  TO anon
  USING (published_at IS NOT NULL);

CREATE POLICY "anon_solution_versions_published" ON solution_versions FOR SELECT
  TO anon
  USING (published_at IS NOT NULL);

-- Authenticated users: published versions + own unpublished versions
CREATE POLICY "auth_problem_versions" ON problem_versions FOR SELECT
  TO authenticated
  USING (
    published_at IS NOT NULL
    OR created_by = auth.uid()
  );

CREATE POLICY "auth_solution_versions" ON solution_versions FOR SELECT
  TO authenticated
  USING (
    published_at IS NOT NULL
    OR created_by = auth.uid()
  );

-- Moderators/admin: all versions
CREATE POLICY "moderator_problem_versions" ON problem_versions FOR SELECT
  USING (
    auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
    OR EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
  );

CREATE POLICY "moderator_solution_versions" ON solution_versions FOR SELECT
  USING (
    auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
    OR EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
  );

-- Public views that exclude sensitive columns (source_snapshot)
CREATE OR REPLACE VIEW public_problem_versions WITH (security_barrier = true) AS
SELECT
  id, problem_id, version_number, parent_version_id,
  content, content_hash, change_summary,
  created_at, published_at
FROM problem_versions
WHERE published_at IS NOT NULL;

CREATE OR REPLACE VIEW public_solution_versions WITH (security_barrier = true) AS
SELECT
  id, solution_id, version_number, parent_version_id,
  content, content_hash, change_summary,
  created_at, published_at
FROM solution_versions
WHERE published_at IS NOT NULL;

GRANT SELECT ON public_problem_versions TO anon, authenticated;
GRANT SELECT ON public_solution_versions TO anon, authenticated;

-- ============================================================================
-- P1-3: Database Integrity Constraints
-- ============================================================================

-- Version content immutability: prevent UPDATE of critical fields after creation
CREATE OR REPLACE FUNCTION prevent_version_content_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.entity_id IS DISTINCT FROM NEW.entity_id
    OR OLD.version_number IS DISTINCT FROM NEW.version_number
    OR OLD.parent_version_id IS DISTINCT FROM NEW.parent_version_id
    OR OLD.content IS DISTINCT FROM NEW.content
    OR OLD.content_hash IS DISTINCT FROM NEW.content_hash
    OR OLD.created_by IS DISTINCT FROM NEW.created_by
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION 'version content fields are immutable after creation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_problem_version_mutation BEFORE UPDATE ON problem_versions
FOR EACH ROW EXECUTE FUNCTION prevent_version_content_mutation();

CREATE TRIGGER prevent_solution_version_mutation BEFORE UPDATE ON solution_versions
FOR EACH ROW EXECUTE FUNCTION prevent_version_content_mutation();

-- Prevent duplicate content_hash within same entity
CREATE UNIQUE INDEX IF NOT EXISTS idx_problem_versions_unique_content
  ON problem_versions(problem_id, content_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_solution_versions_unique_content
  ON solution_versions(solution_id, content_hash);

-- Validate content_hash format (64-char hex for SHA-256)
ALTER TABLE problem_versions ADD CONSTRAINT check_content_hash_format
  CHECK (content_hash ~ '^[0-9a-f]{64}$');

ALTER TABLE solution_versions ADD CONSTRAINT check_content_hash_format
  CHECK (content_hash ~ '^[0-9a-f]{64}$');

-- current_version must belong to same entity (polymorphic FK validation via trigger)
CREATE OR REPLACE FUNCTION validate_current_version_belongs_to_entity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_version_id IS NOT NULL THEN
    IF TG_TABLE_NAME = 'problems' THEN
      IF NOT EXISTS (
        SELECT 1 FROM problem_versions
        WHERE id = NEW.current_version_id AND problem_id = NEW.id
      ) THEN
        RAISE EXCEPTION 'current_version_id must reference a version of this problem';
      END IF;
    ELSIF TG_TABLE_NAME = 'solutions' THEN
      IF NOT EXISTS (
        SELECT 1 FROM solution_versions
        WHERE id = NEW.current_version_id AND solution_id = NEW.id
      ) THEN
        RAISE EXCEPTION 'current_version_id must reference a version of this solution';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_problem_current_version BEFORE INSERT OR UPDATE ON problems
FOR EACH ROW EXECUTE FUNCTION validate_current_version_belongs_to_entity();

CREATE TRIGGER validate_solution_current_version BEFORE INSERT OR UPDATE ON solutions
FOR EACH ROW EXECUTE FUNCTION validate_current_version_belongs_to_entity();

-- parent_version must belong to same entity
CREATE OR REPLACE FUNCTION validate_parent_version_belongs_to_entity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.parent_version_id IS NOT NULL THEN
    IF TG_TABLE_NAME = 'problem_versions' THEN
      IF NOT EXISTS (
        SELECT 1 FROM problem_versions
        WHERE id = NEW.parent_version_id AND problem_id = NEW.problem_id
      ) THEN
        RAISE EXCEPTION 'parent_version_id must reference a version of the same problem';
      END IF;
    ELSIF TG_TABLE_NAME = 'solution_versions' THEN
      IF NOT EXISTS (
        SELECT 1 FROM solution_versions
        WHERE id = NEW.parent_version_id AND solution_id = NEW.solution_id
      ) THEN
        RAISE EXCEPTION 'parent_version_id must reference a version of the same solution';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_problem_parent_version BEFORE INSERT OR UPDATE ON problem_versions
FOR EACH ROW EXECUTE FUNCTION validate_parent_version_belongs_to_entity();

CREATE TRIGGER validate_solution_parent_version BEFORE INSERT OR UPDATE ON solution_versions
FOR EACH ROW EXECUTE FUNCTION validate_parent_version_belongs_to_entity();

-- Run lifecycle constraints
ALTER TABLE capability_runs ADD CONSTRAINT check_terminal_completed
  CHECK (
    status NOT IN ('succeeded', 'failed', 'timed_out', 'cancelled')
    OR completed_at IS NOT NULL
  );

ALTER TABLE capability_runs ADD CONSTRAINT check_running_started
  CHECK (status != 'running' OR started_at IS NOT NULL);

-- Artifact lifecycle constraints
ALTER TABLE artifacts ADD CONSTRAINT check_artifact_schema_version_positive
  CHECK (schema_version > 0);

-- Artifact relation target existence validation (polymorphic FK)
CREATE OR REPLACE FUNCTION validate_artifact_relation_target()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.target_type = 'problem_version' THEN
    IF NOT EXISTS (SELECT 1 FROM problem_versions WHERE id::text = NEW.target_id) THEN
      RAISE EXCEPTION 'artifact relation target_id must reference existing problem_version';
    END IF;
  ELSIF NEW.target_type = 'solution_version' THEN
    IF NOT EXISTS (SELECT 1 FROM solution_versions WHERE id::text = NEW.target_id) THEN
      RAISE EXCEPTION 'artifact relation target_id must reference existing solution_version';
    END IF;
  ELSIF NEW.target_type = 'artifact' THEN
    IF NOT EXISTS (SELECT 1 FROM artifacts WHERE id::text = NEW.target_id) THEN
      RAISE EXCEPTION 'artifact relation target_id must reference existing artifact';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_artifact_relation_target_exists BEFORE INSERT ON artifact_relations
FOR EACH ROW EXECUTE FUNCTION validate_artifact_relation_target();

-- CapabilityRunInput version existence validation
CREATE OR REPLACE FUNCTION validate_capability_input_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.version_id IS NOT NULL THEN
    IF NEW.object_type = 'problem_version' THEN
      IF NOT EXISTS (SELECT 1 FROM problem_versions WHERE id = NEW.version_id) THEN
        RAISE EXCEPTION 'capability input version_id must reference existing problem_version';
      END IF;
    ELSIF NEW.object_type = 'solution_version' THEN
      IF NOT EXISTS (SELECT 1 FROM solution_versions WHERE id = NEW.version_id) THEN
        RAISE EXCEPTION 'capability input version_id must reference existing solution_version';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_capability_input_version_exists BEFORE INSERT ON capability_run_inputs
FOR EACH ROW EXECUTE FUNCTION validate_capability_input_version();

NOTIFY pgrst, 'reload schema';
