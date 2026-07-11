# Math Hub v2 Phase 1.1 Completion - Pre-Implementation Audit

## Audit Date
2026-07-11

## Audit Purpose
Verify actual state of Phase 1.1 claims and identify all remaining work needed for true completion.

---

## Previous Agent Claims vs Reality

### Claimed: "Phase 1.1 Complete"
**Reality:** Only partial fixes delivered, critical P0/P1 issues explicitly deferred to Phase 2.

### Claimed: "49/49 tests passing"
**Reality:** Test count dropped from Phase 1's 79 tests. Investigation needed.

### Test Script Analysis
```json
// package.json test script
"test": "node --import tsx --test lib/is-moderator.test.ts verification/api.test.ts verification/ui-meta.test.ts verification/providers/axle/axle-provider.test.ts verification/service/*.test.ts"
```

**Missing from test run:**
- `contracts/evidence.test.ts` (exists in worktree)
- `domains/capabilities/registry.test.ts` (exists in worktree)
- `domains/capabilities/adapters/lean-verification-adapter.test.ts` (exists)
- `domains/content/versioning/content-hash.test.ts` (exists)
- `domains/content/versioning/version-repository.test.ts` (exists)

**Conclusion:** Test suite is incomplete. Many Math Hub v2 tests are not being run.

---

## Migration 029 Critical Errors

### Error 1: Invalid Field Names in Trigger
**File:** `supabase/migrations/029_math_hub_v2_hardening.sql:77-78`

```sql
IF OLD.entity_id IS DISTINCT FROM NEW.entity_id  -- ❌ No such column
```

**Actual Fields:**
- `problem_versions.problem_id` (not entity_id)
- `solution_versions.solution_id` (not entity_id)

**Impact:** Trigger will fail at runtime with "column entity_id does not exist"

### Error 2: Incomplete Immutability Specification
Function doesn't check:
- `source_submission_id`
- `source_snapshot`
- `change_summary` mutability unclear

### Error 3: No DELETE policy
Trigger only prevents UPDATE. DELETE semantics undefined.

---

## Capability Input Binding - Not Implemented

### Current State
```typescript
// API accepts:
{
  objectType: "solution",
  objectId: "arbitrary-string",
  value: "arbitrary Lean source"
}
```

**Problems:**
1. No validation that `value` matches `solution` content
2. No version binding
3. Client can claim to verify Solution X while submitting unrelated proof
4. Artifact `verifies` relation is dishonest

### Required: Two Distinct Modes

#### Mode 1: Version-Bound
```typescript
{
  objectType: "solution_version",
  objectId: "solution-stable-id",
  versionId: "uuid",
  // NO value field - server extracts from version
}
```

Server responsibilities:
- Validate versionId exists
- Validate versionId.solution_id === objectId
- Check user can read version (RLS)
- Extract Lean source from version.content
- Compute canonical content_hash
- Store snapshot with actual executed content
- Create artifact with `verifies → solution_version`

#### Mode 2: Ad-Hoc
```typescript
{
  objectType: "ad_hoc_source",
  value: "theorem test : 1 = 1 := rfl"
  // NO objectId/versionId
}
```

Server responsibilities:
- Accept arbitrary Lean source
- Validate size limits
- Compute source hash
- Store complete snapshot
- Create artifact with NO `verifies` relation
- Mark as exploratory/non-canonical

---

## Idempotency - Not Implemented

### Current Code
```typescript
if (request.idempotencyKey) {
  const existing = await this.deps.runRepository.findByIdempotencyKey(...)
  if (existing) return existing;
}
```

**Problems:**
1. Only works if client provides key
2. Docs claim "server-generated default idempotency" - not implemented
3. Concurrent identical requests can create duplicates
4. No unique constraint to catch races

### Required Implementation
Server must generate idempotency key from:
- capability_key
- capability version
- provider_key
- canonical configuration hash
- canonical input hash
- actor/scope

Handle unique violations gracefully (return existing Run).

---

## Atomic Operations - Not Implemented

### Problem 1: Run + Inputs
```typescript
// Current: Two separate operations
let run = await repository.create({...});  // 1. Create run
                                            // 2. Inputs created separately
```

**Risk:** Inputs insert fails → orphaned Run

**Required:** Database RPC function `create_capability_run_with_inputs(...)`

### Problem 2: Artifact + Relations + Evidence
```typescript
// Current: Three separate operations
const artifact = await repository.create({...});           // 1
await repository.createRelation({...});                    // 2
await repository.createEvidence({...});                    // 3
```

**Risk:** Step 2 or 3 fails → incomplete artifact bundle

**Required:** Database RPC function `create_artifact_bundle(...)`

---

## Projection Failure Recovery - Not Implemented

### Current Behavior
```
VerificationService.create() succeeds
  → Artifact creation fails
  → CapabilityRun marked "failed" 
  → AXLE result lost
```

**Problems:**
1. Math verification succeeded but system shows failure
2. Retry would call AXLE again (waste + inconsistency)
3. No way to recover without re-execution

### Required: Projection Repair
```typescript
async repairCapabilityProjection(runId: string): Promise<void> {
  // 1. Check run has legacy_verification_task_id
  // 2. Fetch task result
  // 3. Recreate artifact bundle from task
  // 4. Do NOT call AXLE again
  // 5. Mark projection_status = "complete"
}
```

---

## Publication Service - Skeleton Only

### Current Implementation
```typescript
return {
  success: false,
  error: "Publication not yet implemented - requires repository.updateStatus() method",
};
```

**Status:** Placeholder that always fails

### Required Implementation
1. Extend `ArtifactRepository` with `updateStatus()` method
2. Atomic publication: `status=published, isPublic=true, published_at=now(), published_by=actor`
3. Validate before publish:
   - Artifact is draft
   - No private data in payload
   - provider_trace is private
   - Referenced versions are published (for version-bound)
4. Authorization: moderator/admin only (phase 1.1 policy)
5. POST `/api/artifacts/[id]/publish` route
6. Idempotent (already published → success)

---

## RLS and Service Role Separation - Not Implemented

### Current State
All API routes use Service Role client with manual permission checks:

```typescript
// app/api/artifacts/[id]/route.ts uses service role
const client = createServiceRoleClient();
// Then manually checks ownership
```

**Problems:**
1. Bypasses RLS entirely
2. Permission logic duplicated across routes
3. Easy to miss security checks
4. Moderator logic scattered

### Required Implementation
1. User reads: use cookie client (RLS enforced)
2. Service Role: only for controlled writes via repository
3. Moderator check: use `lib/is-moderator.ts` everywhere
4. No direct email whitelists in new code

---

## Test Scripts - Incomplete and Broken

### RLS Validation Script
**File:** `supabase/tests/029_rls_validation.sql`

**Problems:**
1. Uses random UUIDs without FK targets
2. `hash_published` doesn't match `^[0-9a-f]{64}$` constraint
3. Only comments for expected results (no assertions)
4. No cleanup guarantee
5. Would fail on any real database

### API Smoke Test
**File:** `scripts/smoke-test-api.sh`

**Problems:**
1. Calls non-existent routes:
   - `/api/capabilities` (doesn't exist)
   - `/api/capabilities/verify.lean` (doesn't exist)
   - `/api/problems/versions` (doesn't exist)
   - `/api/solutions/versions` (doesn't exist)
   - `/api/artifacts` (GET list doesn't exist)
2. Uses hardcoded domain `https://proofarena.com` (wrong)
3. Shell script can't properly handle Next.js auth cookies

---

## Documentation Accuracy Issues

### DEPLOYMENT_CHECKLIST.md
**Problems:**
1. Claims Phase 1.1 is complete
2. Lists non-existent API routes
3. Rollback strategy suggests restoring `USING(true)` (security vulnerability)
4. Contains personal file paths `/Users/lcq/Documents/ProofArena`
5. References wrong domain

### PHASE_1_1_DELIVERY.md
**Problems:**
1. "Partial completion" but titled as delivery
2. Defers P0-5 to Phase 2 (unacceptable for P0)
3. Claims 49 tests pass but doesn't mention 30+ tests not running

---

## Commit aeab5fa - Unrelated Files

**Commit message:** "Add deployment tooling for Phase 1.1"

**Actually contains:**
- Deployment docs (correct)
- Test scripts (correct)
- **36 Remotion promotional video files** (unrelated)
  - `remotion-promo/` entire directory
  - 2943-line package-lock.json
  - Animation components, scenes, mock data
  - 1091-line CSS file

**Issue:** Commit isolation failure. Remotion files may be user assets and should not be deleted, but should not have been in this commit.

---

## Summary: Work Required for True Completion

### Must Fix in Phase 1.1 Completion
1. ✅ Fix Migration 029 trigger errors (create 030)
2. ✅ Implement version-bound vs ad-hoc input modes
3. ✅ Implement server-generated idempotency
4. ✅ Implement atomic Run+Inputs creation
5. ✅ Implement atomic Artifact bundle creation
6. ✅ Implement projection repair mechanism
7. ✅ Complete publication service implementation
8. ✅ Separate RLS reads from service writes
9. ✅ Add all Math Hub tests to npm test script
10. ✅ Write working RLS acceptance tests (TypeScript)
11. ✅ Write working API smoke tests (TypeScript)
12. ✅ Fix all documentation inaccuracies
13. ✅ API hardening (size limits, validation)

### NOT in Scope
- Deleting or modifying Remotion files (user asset)
- Modifying existing migrations 027-029
- Deploying to staging/production
- Executing remote migrations
- Pushing to GitHub (unless authorized)

---

## Completion Criteria

Phase 1.1 is complete when:
1. Migration 030 fixes all 029 errors
2. Both input modes implemented and tested
3. Default idempotency works without client key
4. Atomic operations prevent partial writes
5. Projection repair tested
6. Publication fully functional
7. RLS properly enforced for reads
8. ALL tests run via npm test (60+ tests)
9. RLS acceptance passes on local Supabase
10. API smoke test passes on local Next.js
11. Documentation matches implementation
12. npm run lint passes
13. npm run build passes
14. No P0/P1 issues deferred to Phase 2
