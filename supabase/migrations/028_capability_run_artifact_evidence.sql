-- Math Hub v2, Phase 1: generic Capability/Provider run bookkeeping plus the
-- standardized Artifact/Evidence model. See docs/ARCHITECTURE_V2.md §5, §8, §10.
-- This does not touch verification_tasks or any existing table beyond adding
-- one nullable bridge column below; the Lean/AXLE vertical slice is adapted
-- on top of this via domains/capabilities/adapters/lean-verification-adapter.ts,
-- which is application code, not a schema change.

CREATE TABLE IF NOT EXISTS capability_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  capability_key TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'timed_out', 'cancelled')),
  configuration JSONB NOT NULL DEFAULT '{}'::JSONB,
  input_hash TEXT NOT NULL,
  idempotency_key TEXT,
  -- Bridge to the pre-existing verification pipeline: verification_tasks stays
  -- the execution source of truth for Lean/AXLE runs; this row is a projection
  -- written only after that service has already returned. See ARCHITECTURE_V2 §6.
  legacy_verification_task_id UUID REFERENCES verification_tasks(id) ON DELETE SET NULL,
  error_code TEXT,
  error_message TEXT,
  cost_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS capability_run_inputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL REFERENCES capability_runs(id) ON DELETE CASCADE,
  -- object_id/version_id are intentionally polymorphic text/uuid without a hard
  -- FK: Postgres cannot express "REFERENCES problem_versions OR solution_versions"
  -- cleanly. Referential integrity for this pair is enforced at the application
  -- layer (domains/capabilities/capability-service.ts validates the referenced
  -- version exists before creating the row) and covered by
  -- capability-service.test.ts, not by the database.
  object_type TEXT NOT NULL CHECK (object_type IN ('problem', 'solution', 'problem_version', 'solution_version', 'submission')),
  object_id TEXT NOT NULL,
  version_id UUID,
  role TEXT NOT NULL DEFAULT 'primary',
  content_hash TEXT,
  snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Vocabulary matches the task's named artifact kinds; only 'verification_report'
  -- has a producer in Phase 1. Extending this list is a small additive migration,
  -- not a rename -- keeps the table typed instead of a free-text "kind".
  kind TEXT NOT NULL CHECK (kind IN (
    'verification_report', 'formalization', 'counterexample', 'reasoning_graph',
    'method_comparison', 'geometry_construction', 'cas_derivation', 'diagnostic_report'
  )),
  schema_version INTEGER NOT NULL DEFAULT 1,
  run_id UUID NOT NULL REFERENCES capability_runs(id) ON DELETE CASCADE,
  provider_key TEXT NOT NULL,
  producer_version TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  payload JSONB NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NOT is_public OR status = 'published')
);

CREATE TABLE IF NOT EXISTS artifact_relations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  relation TEXT NOT NULL CHECK (relation IN (
    'derived_from', 'verifies', 'formalizes', 'refutes', 'compares',
    'supersedes', 'explains', 'visualizes'
  )),
  -- Same polymorphic tradeoff as capability_run_inputs.version_id above.
  target_type TEXT NOT NULL CHECK (target_type IN ('problem_version', 'solution_version', 'artifact')),
  target_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evidence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artifact_id UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'lean_proof', 'symbolic_check', 'numerical_counterexample',
    'manual_review', 'provider_trace', 'test_result'
  )),
  payload JSONB NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Structural guarantee, not just an application convention: a raw provider
  -- trace can never be flagged public, even by a bug in application code.
  CHECK (kind <> 'provider_trace' OR NOT is_public)
);

CREATE INDEX IF NOT EXISTS idx_capability_runs_requested_by ON capability_runs(requested_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_capability_runs_capability ON capability_runs(capability_key, status);
CREATE INDEX IF NOT EXISTS idx_capability_runs_input_hash ON capability_runs(input_hash);
CREATE INDEX IF NOT EXISTS idx_capability_runs_legacy_task ON capability_runs(legacy_verification_task_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_capability_runs_idempotency
  ON capability_runs(requested_by, capability_key, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_capability_run_inputs_run ON capability_run_inputs(run_id);
CREATE INDEX IF NOT EXISTS idx_capability_run_inputs_object ON capability_run_inputs(object_type, object_id);

CREATE INDEX IF NOT EXISTS idx_artifacts_run ON artifacts(run_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_kind_public ON artifacts(kind, is_public);

CREATE INDEX IF NOT EXISTS idx_artifact_relations_artifact ON artifact_relations(artifact_id);
CREATE INDEX IF NOT EXISTS idx_artifact_relations_target ON artifact_relations(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_evidence_artifact ON evidence(artifact_id);

ALTER TABLE capability_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE capability_run_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

-- No INSERT/UPDATE/DELETE policy is defined anywhere in this file for any
-- client role, on purpose: every write goes through the service-role client
-- (platform/database/service-client.ts -> lib/supabase-server.ts
-- createServiceClient), which bypasses RLS. This mirrors verification_tasks'
-- existing convention exactly (024_unified_verification_system.sql).

DROP POLICY IF EXISTS "Users can view own capability runs" ON capability_runs;
CREATE POLICY "Users can view own capability runs" ON capability_runs FOR SELECT
  USING (auth.uid() = requested_by);
DROP POLICY IF EXISTS "Moderators can view capability runs" ON capability_runs;
CREATE POLICY "Moderators can view capability runs" ON capability_runs FOR SELECT
  USING (
    auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
    OR EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
  );

DROP POLICY IF EXISTS "Users can view own capability run inputs" ON capability_run_inputs;
CREATE POLICY "Users can view own capability run inputs" ON capability_run_inputs FOR SELECT
  USING (EXISTS (SELECT 1 FROM capability_runs cr WHERE cr.id = run_id AND cr.requested_by = auth.uid()));
DROP POLICY IF EXISTS "Moderators can view capability run inputs" ON capability_run_inputs;
CREATE POLICY "Moderators can view capability run inputs" ON capability_run_inputs FOR SELECT
  USING (
    auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
    OR EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
  );

DROP POLICY IF EXISTS "Public artifacts are viewable by everyone" ON artifacts;
CREATE POLICY "Public artifacts are viewable by everyone" ON artifacts FOR SELECT
  USING (is_public);
DROP POLICY IF EXISTS "Owners can view their own artifacts" ON artifacts;
CREATE POLICY "Owners can view their own artifacts" ON artifacts FOR SELECT
  USING (EXISTS (SELECT 1 FROM capability_runs cr WHERE cr.id = run_id AND cr.requested_by = auth.uid()));
DROP POLICY IF EXISTS "Moderators can view all artifacts" ON artifacts;
CREATE POLICY "Moderators can view all artifacts" ON artifacts FOR SELECT
  USING (
    auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
    OR EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
  );

DROP POLICY IF EXISTS "Public artifact relations are viewable by everyone" ON artifact_relations;
CREATE POLICY "Public artifact relations are viewable by everyone" ON artifact_relations FOR SELECT
  USING (EXISTS (SELECT 1 FROM artifacts a WHERE a.id = artifact_id AND a.is_public));
DROP POLICY IF EXISTS "Owners can view their own artifact relations" ON artifact_relations;
CREATE POLICY "Owners can view their own artifact relations" ON artifact_relations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM artifacts a JOIN capability_runs cr ON cr.id = a.run_id
    WHERE a.id = artifact_id AND cr.requested_by = auth.uid()
  ));
DROP POLICY IF EXISTS "Moderators can view all artifact relations" ON artifact_relations;
CREATE POLICY "Moderators can view all artifact relations" ON artifact_relations FOR SELECT
  USING (
    auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
    OR EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
  );

DROP POLICY IF EXISTS "Public evidence on public artifacts is viewable by everyone" ON evidence;
CREATE POLICY "Public evidence on public artifacts is viewable by everyone" ON evidence FOR SELECT
  USING (is_public AND EXISTS (SELECT 1 FROM artifacts a WHERE a.id = artifact_id AND a.is_public));
DROP POLICY IF EXISTS "Owners can view their own evidence" ON evidence;
CREATE POLICY "Owners can view their own evidence" ON evidence FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM artifacts a JOIN capability_runs cr ON cr.id = a.run_id
    WHERE a.id = artifact_id AND cr.requested_by = auth.uid()
  ));
DROP POLICY IF EXISTS "Moderators can view all evidence" ON evidence;
CREATE POLICY "Moderators can view all evidence" ON evidence FOR SELECT
  USING (
    auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
    OR EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
  );

-- Redacted public surface for anonymous/unauthenticated reads, mirroring
-- public_verification_summaries. Hides run_id/created_by (internal linkage)
-- even though the base-table RLS above would already allow an authenticated
-- public artifact read -- this is the ergonomic, pre-joined surface product
-- pages should query instead of duplicating the is_public/ownership logic.
CREATE OR REPLACE VIEW public_artifacts WITH (security_barrier = true) AS
SELECT id, kind, schema_version, provider_key, producer_version, payload, summary, created_at
FROM artifacts
WHERE is_public;
REVOKE ALL ON public_artifacts FROM PUBLIC;
GRANT SELECT ON public_artifacts TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.touch_capability_run_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at := NOW(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;
DROP TRIGGER IF EXISTS touch_capability_run_updated_at ON capability_runs;
CREATE TRIGGER touch_capability_run_updated_at BEFORE UPDATE ON capability_runs
FOR EACH ROW EXECUTE FUNCTION public.touch_capability_run_updated_at();

NOTIFY pgrst, 'reload schema';
