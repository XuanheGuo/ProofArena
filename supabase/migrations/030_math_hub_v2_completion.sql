-- Math Hub v2 Phase 1.1 Completion Migration
-- Fixes errors in 029 and completes deferred P0/P1 issues
-- See docs/PHASE_1_1_COMPLETION_AUDIT.md for full rationale

-- ============================================================================
-- Fix Migration 029 Trigger Errors
-- ============================================================================

-- Drop broken trigger and function from 029
DROP TRIGGER IF EXISTS prevent_problem_version_mutation ON problem_versions;
DROP TRIGGER IF EXISTS prevent_solution_version_mutation ON solution_versions;
DROP FUNCTION IF EXISTS prevent_version_content_mutation();

-- Create type-specific immutability functions with correct field names
CREATE OR REPLACE FUNCTION prevent_problem_version_content_mutation()
RETURNS TRIGGER AS $$
BEGIN
  -- Immutable fields after creation
  IF OLD.problem_id IS DISTINCT FROM NEW.problem_id
    OR OLD.version_number IS DISTINCT FROM NEW.version_number
    OR OLD.parent_version_id IS DISTINCT FROM NEW.parent_version_id
    OR OLD.content IS DISTINCT FROM NEW.content
    OR OLD.content_hash IS DISTINCT FROM NEW.content_hash
    OR OLD.source_snapshot IS DISTINCT FROM NEW.source_snapshot
    OR OLD.created_by IS DISTINCT FROM NEW.created_by
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
    OR OLD.change_summary IS DISTINCT FROM NEW.change_summary
  THEN
    RAISE EXCEPTION 'problem_version content fields are immutable after creation';
  END IF;

  -- Published state can only transition NULL → value (not back)
  IF OLD.published_at IS NOT NULL AND NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    RAISE EXCEPTION 'cannot unpublish a published version';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_solution_version_content_mutation()
RETURNS TRIGGER AS $$
BEGIN
  -- Immutable fields after creation
  IF OLD.solution_id IS DISTINCT FROM NEW.solution_id
    OR OLD.version_number IS DISTINCT FROM NEW.version_number
    OR OLD.parent_version_id IS DISTINCT FROM NEW.parent_version_id
    OR OLD.content IS DISTINCT FROM NEW.content
    OR OLD.content_hash IS DISTINCT FROM NEW.content_hash
    OR OLD.source_submission_id IS DISTINCT FROM NEW.source_submission_id
    OR OLD.source_snapshot IS DISTINCT FROM NEW.source_snapshot
    OR OLD.created_by IS DISTINCT FROM NEW.created_by
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
    OR OLD.change_summary IS DISTINCT FROM NEW.change_summary
  THEN
    RAISE EXCEPTION 'solution_version content fields are immutable after creation';
  END IF;

  -- Published state can only transition NULL → value (not back)
  IF OLD.published_at IS NOT NULL AND NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    RAISE EXCEPTION 'cannot unpublish a published version';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_problem_version_mutation BEFORE UPDATE ON problem_versions
FOR EACH ROW EXECUTE FUNCTION prevent_problem_version_content_mutation();

CREATE TRIGGER prevent_solution_version_mutation BEFORE UPDATE ON solution_versions
FOR EACH ROW EXECUTE FUNCTION prevent_solution_version_content_mutation();

-- ============================================================================
-- Extend object_type for ad-hoc inputs
-- ============================================================================

-- Add 'ad_hoc_source' to accepted types (phase 1.1 requirement)
ALTER TABLE capability_run_inputs DROP CONSTRAINT IF EXISTS capability_run_inputs_object_type_check;
ALTER TABLE capability_run_inputs ADD CONSTRAINT capability_run_inputs_object_type_check
  CHECK (object_type IN (
    'problem', 'solution', 'problem_version', 'solution_version', 'submission', 'ad_hoc_source'
  ));

-- ============================================================================
-- Add idempotency unique constraint
-- ============================================================================

-- Server-generated idempotency: unique per (requested_by, capability_key, input_hash, config_hash)
-- Client-provided idempotency_key is an additional user-controlled label, not the primary dedup mechanism
CREATE UNIQUE INDEX IF NOT EXISTS idx_capability_runs_idempotency
  ON capability_runs(requested_by, capability_key, input_hash, MD5(configuration::text))
  WHERE idempotency_key IS NULL;

-- If client provides explicit idempotency_key, honor it (existing constraint from 028)
CREATE UNIQUE INDEX IF NOT EXISTS idx_capability_runs_explicit_idempotency
  ON capability_runs(requested_by, capability_key, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ============================================================================
-- Add artifact publication fields
-- ============================================================================

ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

-- Published artifacts must have published_at and published_by
ALTER TABLE artifacts ADD CONSTRAINT artifacts_publication_consistency
  CHECK (
    (status = 'published' AND published_at IS NOT NULL AND published_by IS NOT NULL)
    OR (status != 'published' AND published_at IS NULL AND published_by IS NULL)
  );

-- ============================================================================
-- Add projection status tracking
-- ============================================================================

-- Track whether artifact projection succeeded independently of provider execution
ALTER TABLE capability_runs ADD COLUMN IF NOT EXISTS projection_status TEXT
  DEFAULT 'pending'
  CHECK (projection_status IN ('pending', 'completed', 'failed'));

ALTER TABLE capability_runs ADD COLUMN IF NOT EXISTS projection_error TEXT;

-- ============================================================================
-- Atomic run creation RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION create_capability_run_with_inputs(
  p_capability_key TEXT,
  p_provider_key TEXT,
  p_requested_by UUID,
  p_configuration JSONB,
  p_input_hash TEXT,
  p_idempotency_key TEXT,
  p_inputs JSONB  -- Array of {object_type, object_id, version_id, role, input_key, content_hash, snapshot}
) RETURNS UUID AS $$
DECLARE
  v_run_id UUID;
  v_input JSONB;
BEGIN
  -- Insert run
  INSERT INTO capability_runs (
    capability_key, provider_key, requested_by, configuration, input_hash, idempotency_key
  ) VALUES (
    p_capability_key, p_provider_key, p_requested_by, p_configuration, p_input_hash, p_idempotency_key
  ) RETURNING id INTO v_run_id;

  -- Insert all inputs in same transaction
  FOR v_input IN SELECT * FROM jsonb_array_elements(p_inputs)
  LOOP
    INSERT INTO capability_run_inputs (
      run_id, object_type, object_id, version_id, role, content_hash, snapshot
    ) VALUES (
      v_run_id,
      v_input->>'object_type',
      v_input->>'object_id',
      (v_input->>'version_id')::UUID,
      COALESCE(v_input->>'role', 'primary'),
      v_input->>'content_hash',
      v_input->'snapshot'
    );
  END LOOP;

  RETURN v_run_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only service role can call this
REVOKE ALL ON FUNCTION create_capability_run_with_inputs FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_capability_run_with_inputs TO service_role;

-- ============================================================================
-- Atomic artifact bundle creation RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION create_artifact_bundle(
  p_kind TEXT,
  p_schema_version INTEGER,
  p_run_id UUID,
  p_provider_key TEXT,
  p_producer_version TEXT,
  p_status TEXT,
  p_payload JSONB,
  p_summary TEXT,
  p_is_public BOOLEAN,
  p_created_by UUID,
  p_relations JSONB,  -- Array of {relation, target_type, target_id}
  p_evidence JSONB    -- Array of {kind, payload, is_public}
) RETURNS UUID AS $$
DECLARE
  v_artifact_id UUID;
  v_relation JSONB;
  v_ev JSONB;
BEGIN
  -- Insert artifact
  INSERT INTO artifacts (
    kind, schema_version, run_id, provider_key, producer_version,
    status, payload, summary, is_public, created_by
  ) VALUES (
    p_kind, p_schema_version, p_run_id, p_provider_key, p_producer_version,
    p_status, p_payload, p_summary, p_is_public, p_created_by
  ) RETURNING id INTO v_artifact_id;

  -- Insert relations
  IF p_relations IS NOT NULL THEN
    FOR v_relation IN SELECT * FROM jsonb_array_elements(p_relations)
    LOOP
      INSERT INTO artifact_relations (artifact_id, relation, target_type, target_id)
      VALUES (
        v_artifact_id,
        v_relation->>'relation',
        v_relation->>'target_type',
        v_relation->>'target_id'
      );
    END LOOP;
  END IF;

  -- Insert evidence
  IF p_evidence IS NOT NULL THEN
    FOR v_ev IN SELECT * FROM jsonb_array_elements(p_evidence)
    LOOP
      INSERT INTO evidence (artifact_id, kind, payload, is_public)
      VALUES (
        v_artifact_id,
        v_ev->>'kind',
        v_ev->'payload',
        (v_ev->>'is_public')::BOOLEAN
      );
    END LOOP;
  END IF;

  RETURN v_artifact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION create_artifact_bundle FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_artifact_bundle TO service_role;

-- ============================================================================
-- Artifact publication RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION publish_artifact(
  p_artifact_id UUID,
  p_published_by UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_status TEXT;
BEGIN
  -- Get current status
  SELECT status INTO v_current_status FROM artifacts WHERE id = p_artifact_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Artifact not found: %', p_artifact_id;
  END IF;

  -- Idempotent: already published
  IF v_current_status = 'published' THEN
    RETURN TRUE;
  END IF;

  -- Can only publish drafts
  IF v_current_status != 'draft' THEN
    RAISE EXCEPTION 'Cannot publish artifact with status: %', v_current_status;
  END IF;

  -- Atomically publish
  UPDATE artifacts SET
    status = 'published',
    is_public = TRUE,
    published_at = NOW(),
    published_by = p_published_by
  WHERE id = p_artifact_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION publish_artifact FROM PUBLIC;
GRANT EXECUTE ON FUNCTION publish_artifact TO service_role;

-- ============================================================================
-- RLS policies for artifacts and evidence
-- ============================================================================

-- Artifacts: public ones readable by anyone, private ones only by owner/moderator
DROP POLICY IF EXISTS "Artifacts are viewable by everyone" ON artifacts;

CREATE POLICY "anon_artifacts_public" ON artifacts FOR SELECT
  TO anon
  USING (is_public = TRUE AND status = 'published');

CREATE POLICY "auth_artifacts" ON artifacts FOR SELECT
  TO authenticated
  USING (
    (is_public = TRUE AND status = 'published')
    OR created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
  );

-- Evidence: same logic (public evidence readable by anyone, private only by owner/moderator)
DROP POLICY IF EXISTS "Evidence is viewable by authorized users" ON evidence;

CREATE POLICY "anon_evidence_public" ON evidence FOR SELECT
  TO anon
  USING (
    is_public = TRUE
    AND EXISTS (
      SELECT 1 FROM artifacts a
      WHERE a.id = evidence.artifact_id
      AND a.is_public = TRUE
      AND a.status = 'published'
    )
  );

CREATE POLICY "auth_evidence" ON evidence FOR SELECT
  TO authenticated
  USING (
    is_public = TRUE
    OR EXISTS (
      SELECT 1 FROM artifacts a
      WHERE a.id = evidence.artifact_id
      AND (
        a.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
      )
    )
  );

-- Capability runs: owner can read own runs, moderators can read all
DROP POLICY IF EXISTS "Users can view their own capability runs" ON capability_runs;

CREATE POLICY "auth_capability_runs" ON capability_runs FOR SELECT
  TO authenticated
  USING (
    requested_by = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
  );

-- Capability run inputs: readable if parent run is readable
DROP POLICY IF EXISTS "Users can view inputs for their runs" ON capability_run_inputs;

CREATE POLICY "auth_capability_run_inputs" ON capability_run_inputs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM capability_runs r
      WHERE r.id = capability_run_inputs.run_id
      AND (
        r.requested_by = auth.uid()
        OR EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
      )
    )
  );

-- Artifact relations: readable if artifact is readable
DROP POLICY IF EXISTS "Artifact relations follow artifact visibility" ON artifact_relations;

CREATE POLICY "artifact_relations_visibility" ON artifact_relations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM artifacts a
      WHERE a.id = artifact_relations.artifact_id
      -- Use same logic as artifact policies
      AND (
        (a.is_public = TRUE AND a.status = 'published')
        OR a.created_by = auth.uid()
        OR EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
      )
    )
  );

NOTIFY pgrst, 'reload schema';
