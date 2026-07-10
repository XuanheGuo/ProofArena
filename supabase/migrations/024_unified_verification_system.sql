-- Unified mathematical verification task store (Lean/AXLE is the first implementation).
CREATE TABLE IF NOT EXISTS verification_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  problem_id TEXT REFERENCES problems(id) ON DELETE SET NULL,
  solution_id TEXT REFERENCES solutions(id) ON DELETE SET NULL,
  submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  engine TEXT NOT NULL CHECK (engine IN ('lean', 'cas', 'numerical', 'z3')),
  provider TEXT NOT NULL CHECK (provider IN ('axle', 'kimina', 'sympy', 'sage', 'internal')),
  environment TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  verdict TEXT CHECK (verdict IS NULL OR verdict IN ('accepted', 'rejected', 'invalid_request', 'timeout', 'rate_limited', 'resource_limit', 'provider_error', 'cancelled')),
  valid BOOLEAN NOT NULL DEFAULT FALSE,
  compiles BOOLEAN,
  source_hash TEXT NOT NULL,
  source_snapshot TEXT,
  source_size INTEGER NOT NULL CHECK (source_size >= 0),
  messages JSONB NOT NULL DEFAULT '[]'::JSONB,
  failed_declarations JSONB NOT NULL DEFAULT '[]'::JSONB,
  result_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  cached BOOLEAN NOT NULL DEFAULT FALSE,
  cache_source_id UUID REFERENCES verification_tasks(id) ON DELETE SET NULL,
  provider_request_id TEXT,
  provider_error_code TEXT,
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_tasks_user_created ON verification_tasks(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verification_tasks_problem ON verification_tasks(problem_id);
CREATE INDEX IF NOT EXISTS idx_verification_tasks_solution ON verification_tasks(solution_id);
CREATE INDEX IF NOT EXISTS idx_verification_tasks_submission ON verification_tasks(submission_id);
CREATE INDEX IF NOT EXISTS idx_verification_tasks_engine_provider ON verification_tasks(engine, provider);
CREATE INDEX IF NOT EXISTS idx_verification_tasks_status ON verification_tasks(status);
CREATE INDEX IF NOT EXISTS idx_verification_tasks_cache ON verification_tasks(source_hash, engine, provider, environment, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_tasks_one_active_hash
  ON verification_tasks(source_hash) WHERE status IN ('queued', 'running');

ALTER TABLE verification_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own verification tasks" ON verification_tasks;
CREATE POLICY "Users can view own verification tasks" ON verification_tasks FOR SELECT
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Moderators can view verification tasks" ON verification_tasks;
CREATE POLICY "Moderators can view verification tasks" ON verification_tasks FOR SELECT
  USING (
    auth.jwt() ->> 'email' = 'xuanheguo@icloud.com'
    OR EXISTS (SELECT 1 FROM user_profiles p WHERE p.id = auth.uid() AND p.role IN ('moderator', 'admin'))
  );

-- No INSERT/UPDATE/DELETE policy is defined for any role: Postgres RLS
-- default-denies those commands entirely for anon/authenticated. All writes
-- go through the service-role client (lib/supabase-server.ts createServiceClient),
-- which bypasses RLS. This is intentional defense-in-depth, not an oversight.

-- Guard against internally-inconsistent rows even from the trusted service-role
-- write path (RLS already blocks external forgery; these are a second layer).
ALTER TABLE verification_tasks DROP CONSTRAINT IF EXISTS verification_tasks_terminal_verdict_check;
ALTER TABLE verification_tasks ADD CONSTRAINT verification_tasks_terminal_verdict_check
  CHECK (status NOT IN ('completed', 'failed', 'cancelled') OR verdict IS NOT NULL);

ALTER TABLE verification_tasks DROP CONSTRAINT IF EXISTS verification_tasks_running_started_check;
ALTER TABLE verification_tasks ADD CONSTRAINT verification_tasks_running_started_check
  CHECK (status <> 'running' OR started_at IS NOT NULL);

ALTER TABLE verification_tasks DROP CONSTRAINT IF EXISTS verification_tasks_cache_source_check;
ALTER TABLE verification_tasks ADD CONSTRAINT verification_tasks_cache_source_check
  CHECK (NOT cached OR cache_source_id IS NOT NULL);

ALTER TABLE verification_tasks DROP CONSTRAINT IF EXISTS verification_tasks_accepted_consistency_check;
ALTER TABLE verification_tasks ADD CONSTRAINT verification_tasks_accepted_consistency_check
  CHECK (verdict <> 'accepted' OR (valid AND jsonb_array_length(failed_declarations) = 0));

-- Writes are server-only via service role. Public pages consume only this redacted view.
CREATE OR REPLACE VIEW public_verification_summaries WITH (security_barrier = true) AS
SELECT id, problem_id, solution_id, engine, provider, environment, status, verdict,
       valid, failed_declarations, duration_ms, cached, created_at, completed_at
FROM verification_tasks
WHERE status = 'completed' AND verdict = 'accepted' AND valid = TRUE
  AND jsonb_array_length(failed_declarations) = 0
  AND (problem_id IS NOT NULL OR solution_id IS NOT NULL);
REVOKE ALL ON public_verification_summaries FROM PUBLIC;
GRANT SELECT ON public_verification_summaries TO anon, authenticated;

-- Reserved, disabled-by-default fixed statement mode. The statement is assembled only server-side.
ALTER TABLE problems
  ADD COLUMN IF NOT EXISTS lean_statement TEXT,
  ADD COLUMN IF NOT EXISTS lean_statement_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS lean_statement_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.touch_verification_task_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at := NOW(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;
DROP TRIGGER IF EXISTS touch_verification_task_updated_at ON verification_tasks;
CREATE TRIGGER touch_verification_task_updated_at BEFORE UPDATE ON verification_tasks
FOR EACH ROW EXECUTE FUNCTION public.touch_verification_task_updated_at();

NOTIFY pgrst, 'reload schema';
