# Math Hub v2 Migration Guide

This document describes the progressive rollout plan for Math Hub v2 Phase 1 — the immutable versioning + capability/artifact platform. See `docs/ARCHITECTURE_V2.md` for the architectural design.

## Overview

Math Hub v2 introduces:
- **Immutable content versioning** (`problem_versions`, `solution_versions`) with content-hash deduplication
- **Generic capability platform** (`capability_runs`, `artifacts`, `evidence`) abstracting math tool execution
- **Lean/AXLE adapter** as the first vertical slice — projects existing verification onto the new platform without modifying `verification/`

Everything is **additive only**: no existing table or column is touched, no current behavior changes. The new tables and APIs coexist with the existing `problems`, `solutions`, and `verification_tasks` until all consumers migrate.

## Phase Boundaries

### Phase 1 (This Implementation)
**Status:** Ready for staging deployment and internal testing  
**Scope:**
- ✅ Content versioning foundation (migrations 025, 026)
- ✅ Capability/artifact/evidence tables + RLS
- ✅ `verify.lean` capability with LeanVerificationAdapter
- ✅ API routes: POST /api/capabilities/runs, GET /api/capabilities/runs, GET /api/capabilities/runs/[id], GET /api/artifacts/[id]
- ✅ Test coverage: content hash stability, version dedup, adapter mapping, contract assertions
- ✅ TypeScript contracts layer (framework-free)

**NOT in Phase 1:**
- No UI changes (existing routes stay unchanged)
- No production deployment
- No backfill of existing problems/solutions into `*_versions` tables
- No migration of existing consumers from `verification_tasks` to `capability_runs`

### Phase 2 (Future)
- Backfill script: copy `problems` → `problem_versions`, `solutions` → `solution_versions` (v1)
- Update submission flow to write to both `solutions` (current) and `solution_versions` (forward-compat)
- Update contest sprint panel to read from `solution_versions` when available, fall back to `solutions`
- UI components for version history browsing

### Phase 3 (Future)
- Deprecate direct writes to `solutions.verification` — route all new verification through capability_runs
- Arena integration: contest problems reference `problem_versions` instead of raw `problems`
- New capabilities: CAS symbolic check, numerical counterexample search

## Migration Steps

### 1. Apply Migrations (Staging First)

```bash
# Review migration files first
cat supabase/migrations/025_content_version_foundation.sql
cat supabase/migrations/026_capability_run_artifact_evidence.sql

# Apply to staging (via Supabase dashboard or CLI)
supabase db push

# Verify tables exist
psql $STAGING_DATABASE_URL -c "\d problem_versions"
psql $STAGING_DATABASE_URL -c "\d capability_runs"
psql $STAGING_DATABASE_URL -c "\d artifacts"
```

### 2. Deploy Application Code (Staging)

```bash
# Ensure environment variables are set
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY

# Deploy to staging (Vercel preview or self-hosted staging)
git push staging math-hub-v2-branch

# Smoke test API routes
curl -X POST https://staging.proofarena.com/api/capabilities/runs \
  -H "Authorization: Bearer $STAGING_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "capabilityKey": "verify.lean",
    "inputs": [
      {"objectType": "solution", "objectId": "sol_test", "role": "proof_source", "inputKey": "proof_source", "value": "theorem test : 1 + 1 = 2 := rfl"}
    ]
  }'
```

### 3. Internal Testing Checklist

- [ ] Create a capability run via API
- [ ] Verify run appears in `capability_runs` table with status progression (queued → running → succeeded)
- [ ] Verify artifact created in `artifacts` table with `kind="verification_report"`
- [ ] Verify evidence created in `evidence` table (provider_trace + lean_proof)
- [ ] Verify RLS: non-owner cannot see private runs/artifacts
- [ ] Verify RLS: moderator can see all runs/artifacts
- [ ] Verify idempotency: duplicate requests return same run ID
- [ ] Verify legacy bridge: `capability_runs.legacy_verification_task_id` points to correct `verification_tasks.id`
- [ ] Test version repository: create version, verify dedup on identical content
- [ ] Test version repository: verify content hash ignores key order

### 4. Monitoring

After staging deployment, monitor:
- `capability_runs` table growth rate
- `artifacts` and `evidence` table growth rate
- API route latency (`/api/capabilities/runs`)
- Error rates in CloudWatch/Sentry for new routes
- Supabase RLS policy violations (should be zero)

If any issues arise, the new tables are write-only and isolated — no rollback of existing features required.

### 5. Production Deployment (After Staging Validation)

**Pre-deployment checklist:**
- [ ] All staging tests pass
- [ ] No RLS violations in staging logs
- [ ] Migration SQL reviewed by second engineer
- [ ] Rollback plan documented (migrations are additive, so rollback = no-op; just don't use new APIs)

**Deployment:**
```bash
# Apply migrations to production
supabase db push --project production

# Deploy application code
git push production main

# Verify health
curl https://proofarena.com/api/capabilities/runs
```

## Rollback Plan

Since Phase 1 is **additive only**, rollback is straightforward:

**If application code has issues:**
1. Revert deployment to previous commit
2. New tables remain in database but unused (no data loss)
3. All existing routes continue working

**If migration has issues (unlikely — migrations are schema-only, no data transformation):**
1. Drop new tables via migration down (or manual `DROP TABLE`)
2. Revert application code
3. No existing data affected

## Backfill Strategy (Phase 2)

Once Phase 1 is validated in production, backfill existing content:

```sql
-- Backfill problems → problem_versions (v1 snapshot)
INSERT INTO problem_versions (id, problem_id, version_number, content, content_hash, created_by, created_at, published_at)
SELECT 
  gen_random_uuid(),
  id,
  1,
  jsonb_build_object('title', title, 'statement', statement, 'answer', answer, 'tags', tags),
  -- content_hash computed by application layer, not SQL
  'BACKFILL_PLACEHOLDER',
  created_by,
  created_at,
  created_at
FROM problems;

-- Similar for solutions → solution_versions
```

**Important:** Content hash must be computed by the application layer (using `computeContentHash()`) to match the canonical JSON serialization. The SQL placeholder is replaced by a backfill script that reads each row, computes hash, and updates.

## Testing in Production (Phase 1)

During Phase 1, new APIs are **read-by-owner-only** (moderators can see all). No UI surfaces them yet. Safe to test with:
- Internal moderator accounts
- Postman/curl scripts
- Automated integration tests in CI

## Success Metrics

Phase 1 is successful when:
- [ ] New tables receive 100+ capability_runs from internal testing with zero RLS violations
- [ ] All runs transition to terminal status (no stuck `running` rows)
- [ ] Artifacts and evidence correctly linked (no orphaned rows)
- [ ] Version deduplication works (creating same content twice returns `created: false`)
- [ ] Legacy bridge field populated correctly (all runs have `legacy_verification_task_id`)

## Known Limitations (Phase 1)

1. **No UI**: New APIs exist but no frontend consumes them yet
2. **No backfill**: Existing problems/solutions not versioned yet
3. **Single capability**: Only `verify.lean` registered; CAS/numerical not implemented
4. **No version history UI**: Can query versions via API but no browse/diff UI
5. **No current_version pointer**: `problems` and `solutions` tables not yet linked to `*_versions`

These are addressed in Phase 2/3.

## Questions?

- Architecture decisions: see `docs/ARCHITECTURE_V2.md`
- Schema details: see migration files in `supabase/migrations/025_*.sql` and `026_*.sql`
- Code structure: see `contracts/`, `domains/`, `platform/` for layer boundaries
