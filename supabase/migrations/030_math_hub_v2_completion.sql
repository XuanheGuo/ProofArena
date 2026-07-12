-- Math Hub v2 Phase 1.1 Completion. Fixes the broken triggers shipped in 029
-- and adds the database half of the trusted vertical slice: atomic run/artifact
-- writes, server-side idempotency, publication lifecycle, and projection
-- repair bookkeeping. 027/028/029 are already applied and are not modified;
-- everything here is additive or a drop-and-recreate of 029's broken objects.

-- ============================================================================
-- 1. Fix 029's version-immutability triggers
-- ----------------------------------------------------------------------------
-- 029's prevent_version_content_mutation() reads OLD.entity_id / NEW.entity_id,
-- but the columns are problem_versions.problem_id and solution_versions
-- .solution_id — every UPDATE on either table fails with
-- `record "old" has no field "entity_id"`, including legitimate publishes.
-- Replace with two table-specific functions.
--
-- Immutability contract (see docs/ARCHITECTURE_V2.md §4):
--   immutable after INSERT: entity id, version_number, parent_version_id,
--     content, content_hash, source_submission_id (solutions), source_snapshot,
--     change_summary, created_by, created_at
--   mutable: published_at, but only NULL -> non-NULL (publishing). Unpublishing
--     is forbidden.
-- DELETE is deliberately NOT blocked: versions are content-immutable, not
-- undeletable — they CASCADE with their parent problem/solution (027), and the
-- existing admin delete flows rely on that.
-- ============================================================================

DROP TRIGGER IF EXISTS prevent_problem_version_mutation ON problem_versions;
DROP TRIGGER IF EXISTS prevent_solution_version_mutation ON solution_versions;
DROP FUNCTION IF EXISTS prevent_version_content_mutation();

CREATE OR REPLACE FUNCTION public.prevent_problem_version_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.problem_id        IS DISTINCT FROM NEW.problem_id
    OR OLD.version_number    IS DISTINCT FROM NEW.version_number
    OR OLD.parent_version_id IS DISTINCT FROM NEW.parent_version_id
    OR OLD.content           IS DISTINCT FROM NEW.content
    OR OLD.content_hash      IS DISTINCT FROM NEW.content_hash
    OR OLD.source_snapshot   IS DISTINCT FROM NEW.source_snapshot
    OR OLD.change_summary    IS DISTINCT FROM NEW.change_summary
    OR OLD.created_by        IS DISTINCT FROM NEW.created_by
    OR OLD.created_at        IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION 'problem_version fields are immutable after creation';
  END IF;
  IF OLD.published_at IS NOT NULL AND NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    RAISE EXCEPTION 'a published problem_version cannot be unpublished or re-dated';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.prevent_solution_version_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.solution_id       IS DISTINCT FROM NEW.solution_id
    OR OLD.version_number       IS DISTINCT FROM NEW.version_number
    OR OLD.parent_version_id    IS DISTINCT FROM NEW.parent_version_id
    OR OLD.content              IS DISTINCT FROM NEW.content
    OR OLD.content_hash         IS DISTINCT FROM NEW.content_hash
    OR OLD.source_submission_id IS DISTINCT FROM NEW.source_submission_id
    OR OLD.source_snapshot      IS DISTINCT FROM NEW.source_snapshot
    OR OLD.change_summary       IS DISTINCT FROM NEW.change_summary
    OR OLD.created_by           IS DISTINCT FROM NEW.created_by
    OR OLD.created_at           IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION 'solution_version fields are immutable after creation';
  END IF;
  IF OLD.published_at IS NOT NULL AND NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    RAISE EXCEPTION 'a published solution_version cannot be unpublished or re-dated';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER prevent_problem_version_mutation BEFORE UPDATE ON problem_versions
FOR EACH ROW EXECUTE FUNCTION public.prevent_problem_version_mutation();

CREATE TRIGGER prevent_solution_version_mutation BEFORE UPDATE ON solution_versions
FOR EACH ROW EXECUTE FUNCTION public.prevent_solution_version_mutation();

-- ============================================================================
-- 2. Input modes: allow explicit ad-hoc sources
-- ----------------------------------------------------------------------------
-- 'ad_hoc_source' marks an input that is user-supplied content with NO claim
-- of binding to any stored entity. Rows of this type must not carry a
-- version_id, and artifacts produced from them must never carry a `verifies`
-- relation (enforced in create_artifact_bundle below).
-- ============================================================================

ALTER TABLE capability_run_inputs DROP CONSTRAINT IF EXISTS capability_run_inputs_object_type_check;
ALTER TABLE capability_run_inputs ADD CONSTRAINT capability_run_inputs_object_type_check
  CHECK (object_type IN (
    'problem', 'solution', 'problem_version', 'solution_version', 'submission', 'ad_hoc_source'
  ));

ALTER TABLE capability_run_inputs ADD CONSTRAINT capability_run_inputs_ad_hoc_no_version
  CHECK (object_type <> 'ad_hoc_source' OR version_id IS NULL);

-- ============================================================================
-- 3. Projection bookkeeping on capability_runs
-- ----------------------------------------------------------------------------
-- `status` answers "did the provider execution finish and how" — it must never
-- be rewritten because a *bookkeeping* write (artifact bundle) failed after
-- the provider already returned. projection_status tracks that second axis so
-- a succeeded-but-unprojected run is visible and repairable WITHOUT re-calling
-- the provider (see CapabilityService.repairProjection).
-- ============================================================================

ALTER TABLE capability_runs ADD COLUMN IF NOT EXISTS projection_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (projection_status IN ('pending', 'completed', 'failed', 'not_applicable'));
ALTER TABLE capability_runs ADD COLUMN IF NOT EXISTS projection_error TEXT;

-- One primary artifact per (run, kind, schema_version): makes both the happy
-- path and projection repair idempotent at the database level — a duplicate
-- bundle write degrades to a unique-violation, never to a second artifact.
CREATE UNIQUE INDEX IF NOT EXISTS idx_artifacts_one_per_run_kind
  ON artifacts(run_id, kind, schema_version);

-- NOTE on legacy_verification_task_id: deliberately NOT unique. The existing
-- VerificationService dedups by (user, source_hash) and may return the SAME
-- verification task for two distinct capability runs (e.g. different
-- idempotency keys hitting the dedup/cache path). Each such run legitimately
-- projects its own artifact; uniqueness is enforced per-run by the index above.

-- ============================================================================
-- 4. Publication lifecycle on artifacts
-- ============================================================================

ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE artifacts ADD COLUMN IF NOT EXISTS published_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL;

-- published_by is intentionally NOT required to stay non-null forever (the
-- publishing moderator's account may be deleted -> SET NULL), so the CHECK
-- only pins published_at to the status.
ALTER TABLE artifacts DROP CONSTRAINT IF EXISTS artifacts_publication_consistency;
ALTER TABLE artifacts ADD CONSTRAINT artifacts_publication_consistency
  CHECK (
    (status = 'published' AND published_at IS NOT NULL)
    OR (status <> 'published' AND published_at IS NULL)
  );

-- ============================================================================
-- 5. Atomic run + inputs creation
-- ----------------------------------------------------------------------------
-- A single SQL function call is a single transaction: if any input row is
-- invalid, the run row rolls back with it — no orphaned runs, no partial
-- input sets. Service-role only; the API layer never calls this directly.
-- Raises unique_violation (23505) on an idempotency-key collision, which the
-- repository converts into "return the existing run".
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_capability_run_with_inputs(
  p_capability_key TEXT,
  p_provider_key TEXT,
  p_requested_by UUID,
  p_configuration JSONB,
  p_input_hash TEXT,
  p_idempotency_key TEXT,
  p_inputs JSONB
) RETURNS UUID AS $$
DECLARE
  v_run_id UUID;
  v_input JSONB;
  v_object_type TEXT;
  v_version_id UUID;
BEGIN
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) = 0 THEN
    RAISE EXCEPTION 'idempotency_key is required (the service always supplies a server-computed default)';
  END IF;
  IF p_inputs IS NULL OR jsonb_typeof(p_inputs) <> 'array' OR jsonb_array_length(p_inputs) = 0 THEN
    RAISE EXCEPTION 'p_inputs must be a non-empty JSON array';
  END IF;

  INSERT INTO capability_runs (
    capability_key, provider_key, requested_by, configuration, input_hash, idempotency_key
  ) VALUES (
    p_capability_key, p_provider_key, p_requested_by, COALESCE(p_configuration, '{}'::jsonb), p_input_hash, p_idempotency_key
  ) RETURNING id INTO v_run_id;

  FOR v_input IN SELECT * FROM jsonb_array_elements(p_inputs) LOOP
    v_object_type := v_input->>'object_type';
    v_version_id := NULLIF(v_input->>'version_id', '')::uuid;

    -- Version-bound inputs must reference a version that really belongs to the
    -- named stable entity. (029's trigger checks existence; this checks binding.)
    IF v_object_type = 'solution_version' THEN
      IF v_version_id IS NULL THEN
        RAISE EXCEPTION 'solution_version input requires version_id';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM solution_versions sv
        WHERE sv.id = v_version_id AND sv.solution_id = v_input->>'object_id'
      ) THEN
        RAISE EXCEPTION 'version % does not belong to solution %', v_version_id, v_input->>'object_id';
      END IF;
    ELSIF v_object_type = 'problem_version' THEN
      IF v_version_id IS NULL THEN
        RAISE EXCEPTION 'problem_version input requires version_id';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM problem_versions pv
        WHERE pv.id = v_version_id AND pv.problem_id = v_input->>'object_id'
      ) THEN
        RAISE EXCEPTION 'version % does not belong to problem %', v_version_id, v_input->>'object_id';
      END IF;
    END IF;

    INSERT INTO capability_run_inputs (
      run_id, object_type, object_id, version_id, role, content_hash, snapshot
    ) VALUES (
      v_run_id,
      v_object_type,
      COALESCE(v_input->>'object_id', ''),
      v_version_id,
      COALESCE(v_input->>'role', 'primary'),
      v_input->>'content_hash',
      v_input->'snapshot'
    );
  END LOOP;

  RETURN v_run_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.create_capability_run_with_inputs(TEXT, TEXT, UUID, JSONB, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_capability_run_with_inputs(TEXT, TEXT, UUID, JSONB, TEXT, TEXT, JSONB) TO service_role;

-- ============================================================================
-- 6. Atomic artifact bundle creation
-- ----------------------------------------------------------------------------
-- Artifact + relations + evidence in one transaction. Also enforces the
-- honesty rule that application code alone cannot be trusted with: a
-- `verifies` relation may only target a version that is a version-bound input
-- of the SAME run — an ad-hoc run structurally cannot produce an artifact
-- that claims to verify a stored solution version.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_artifact_bundle(
  p_kind TEXT,
  p_schema_version INTEGER,
  p_run_id UUID,
  p_provider_key TEXT,
  p_producer_version TEXT,
  p_payload JSONB,
  p_summary TEXT,
  p_created_by UUID,
  p_relations JSONB,
  p_evidence JSONB
) RETURNS UUID AS $$
DECLARE
  v_artifact_id UUID;
  v_rel JSONB;
  v_ev JSONB;
BEGIN
  -- Bundles are always created as private drafts; publication is a separate,
  -- validated transition (publish_artifact below).
  INSERT INTO artifacts (
    kind, schema_version, run_id, provider_key, producer_version,
    status, payload, summary, is_public, created_by
  ) VALUES (
    p_kind, p_schema_version, p_run_id, p_provider_key, p_producer_version,
    'draft', p_payload, COALESCE(p_summary, ''), FALSE, p_created_by
  ) RETURNING id INTO v_artifact_id;

  IF p_relations IS NOT NULL AND jsonb_typeof(p_relations) = 'array' THEN
    FOR v_rel IN SELECT * FROM jsonb_array_elements(p_relations) LOOP
      IF v_rel->>'relation' = 'verifies' THEN
        IF NOT EXISTS (
          SELECT 1 FROM capability_run_inputs i
          WHERE i.run_id = p_run_id
            AND i.object_type = v_rel->>'target_type'
            AND i.version_id::text = v_rel->>'target_id'
        ) THEN
          RAISE EXCEPTION 'a verifies relation must target a version-bound input of the same run';
        END IF;
      END IF;
      INSERT INTO artifact_relations (artifact_id, relation, target_type, target_id)
      VALUES (v_artifact_id, v_rel->>'relation', v_rel->>'target_type', v_rel->>'target_id');
    END LOOP;
  END IF;

  IF p_evidence IS NOT NULL AND jsonb_typeof(p_evidence) = 'array' THEN
    FOR v_ev IN SELECT * FROM jsonb_array_elements(p_evidence) LOOP
      -- provider_trace/is_public consistency is enforced by 028's CHECK; a
      -- violating row aborts the whole bundle, which is exactly what we want.
      INSERT INTO evidence (artifact_id, kind, payload, is_public)
      VALUES (
        v_artifact_id,
        v_ev->>'kind',
        v_ev->'payload',
        COALESCE((v_ev->>'is_public')::boolean, FALSE)
      );
    END LOOP;
  END IF;

  RETURN v_artifact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.create_artifact_bundle(TEXT, INTEGER, UUID, TEXT, TEXT, JSONB, TEXT, UUID, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_artifact_bundle(TEXT, INTEGER, UUID, TEXT, TEXT, JSONB, TEXT, UUID, JSONB, JSONB) TO service_role;

-- ============================================================================
-- 7. Controlled publication
-- ----------------------------------------------------------------------------
-- The only path that flips draft -> published. Validations that involve other
-- rows (input versions must themselves be published) live here so they hold
-- atomically with the flip. Idempotent: publishing an already-published
-- artifact is a no-op that returns TRUE. published -> draft does not exist.
-- Authorization (moderator/admin) is enforced by the application layer via
-- requireModerator(); this function is service-role-only so it is unreachable
-- from client credentials either way.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.publish_artifact(
  p_artifact_id UUID,
  p_published_by UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_status TEXT;
  v_run_id UUID;
BEGIN
  SELECT status, run_id INTO v_status, v_run_id FROM artifacts WHERE id = p_artifact_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'artifact not found';
  END IF;
  IF v_status = 'published' THEN
    RETURN TRUE; -- idempotent
  END IF;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'cannot publish artifact with status %', v_status;
  END IF;

  -- A version-bound artifact may only be published once every version it was
  -- computed from is itself published (no leaking private drafts by proxy).
  IF EXISTS (
    SELECT 1 FROM capability_run_inputs i
    LEFT JOIN solution_versions sv ON sv.id = i.version_id
    WHERE i.run_id = v_run_id AND i.object_type = 'solution_version'
      AND (sv.id IS NULL OR sv.published_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'cannot publish: an input solution_version is not published';
  END IF;
  IF EXISTS (
    SELECT 1 FROM capability_run_inputs i
    LEFT JOIN problem_versions pv ON pv.id = i.version_id
    WHERE i.run_id = v_run_id AND i.object_type = 'problem_version'
      AND (pv.id IS NULL OR pv.published_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'cannot publish: an input problem_version is not published';
  END IF;

  -- Structurally guaranteed by 028's CHECK, but assert anyway so a future
  -- schema change cannot silently drop the invariant.
  IF EXISTS (
    SELECT 1 FROM evidence e WHERE e.artifact_id = p_artifact_id AND e.kind = 'provider_trace' AND e.is_public
  ) THEN
    RAISE EXCEPTION 'cannot publish: provider_trace evidence is public';
  END IF;

  UPDATE artifacts SET
    status = 'published',
    is_public = TRUE,
    published_at = NOW(),
    published_by = p_published_by
  WHERE id = p_artifact_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.publish_artifact(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_artifact(UUID, UUID) TO service_role;

-- RLS note: 028 already defines the correct SELECT policies for
-- capability_runs / capability_run_inputs / artifacts / artifact_relations /
-- evidence (owner via capability_runs.requested_by, moderator via
-- user_profiles.role, public via is_public) and defines NO client write
-- policies — writes stay service-role-only. This migration adds none, on
-- purpose: ownership truth stays Run.requested_by, not a second policy set.

NOTIFY pgrst, 'reload schema';
