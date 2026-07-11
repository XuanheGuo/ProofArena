# Phase 1.1 Deployment Checklist

## Pre-Deployment

### ✅ Code Quality (Completed)
- [x] All tests passing (45/45)
- [x] Lint checks passing
- [x] Code merged to `main`
- [x] Code pushed to GitHub

### ⚠️ Database Migration (Required)

**File**: `supabase/migrations/029_math_hub_v2_hardening.sql`

**Steps**:
1. Open Supabase SQL Editor:
   ```
   https://supabase.com/dashboard/project/<your-project-id>/sql
   ```

2. Copy the entire contents of `029_math_hub_v2_hardening.sql`

3. Paste and execute in SQL Editor

4. Verify no errors in execution log

5. Run RLS validation tests:
   ```
   Execute: supabase/tests/029_rls_validation.sql
   ```

**What Migration 029 Does**:
- Fixes version privacy (unpublished versions now private)
- Adds version immutability triggers
- Adds content hash uniqueness constraints
- Adds referential integrity triggers
- Creates public security views

---

## Deployment

### Vercel Auto-Deploy
Pushing to `main` triggers automatic deployment.

Monitor:
```
https://vercel.com/[your-team]/proof-arena/deployments
```

---

## Post-Deployment Validation

### 1. Application Health

```bash
# Check homepage loads
curl https://proofarena.com/

# Check problems list
curl https://proofarena.com/problems

# Check API health
curl https://proofarena.com/api/capabilities
```

### 2. Registry Startup (P0-1 Fix)

Check Vercel logs for:
```
✓ Capability registry built: verify.lean, verify.axle, ...
```

**Should NOT see**:
```
✗ Registry key mismatch
✗ Capability not found
```

### 3. API Smoke Test

```bash
# Set your auth token
export AUTH_TOKEN="your-jwt-token"

# Run comprehensive smoke test
./scripts/smoke-test-api.sh
```

Expected: All tests pass (0 failures)

### 4. RLS Policy Verification

In Supabase SQL Editor:

```sql
-- Test 1: Anonymous cannot read unpublished versions
SET ROLE anon;
SELECT COUNT(*) FROM problem_versions WHERE published_at IS NULL;
-- Expected: 0

-- Test 2: Authenticated can read own unpublished
RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claims.sub TO '<your-user-uuid>';
SELECT COUNT(*) FROM problem_versions 
WHERE created_by = '<your-user-uuid>' AND published_at IS NULL;
-- Expected: count of your draft versions

-- Test 3: Moderator can read all
RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claims.email TO 'xuanheguo@icloud.com';
SELECT COUNT(*) FROM problem_versions;
-- Expected: all rows including unpublished
```

### 5. Manual UI Testing

**Test Case 1: Anonymous User**
- [ ] Can browse problems
- [ ] Can view published solutions
- [ ] CANNOT see unpublished versions
- [ ] CANNOT access `/admin/*`

**Test Case 2: Authenticated User (Non-Moderator)**
- [ ] Can submit problems/solutions
- [ ] Can see own draft submissions
- [ ] CANNOT see others' drafts
- [ ] CANNOT access `/admin/*`

**Test Case 3: Moderator**
- [ ] Can access `/admin/submissions`
- [ ] Can see all versions (published + unpublished)
- [ ] Can approve/reject submissions

**Test Case 4: Capability API**
- [ ] Create a Lean verification run
- [ ] Check run status shows "running" then "completed"
- [ ] Verify result shows "accepted"/"rejected"/"inconclusive" (NOT "refuted")
- [ ] Check artifact defaults to `status: draft, isPublic: false`

---

## Rollback Plan

### If Migration 029 Causes Issues

```sql
-- Revert RLS policies to permissive state
DROP POLICY IF EXISTS "anon_problem_versions_published" ON problem_versions;
DROP POLICY IF EXISTS "auth_problem_versions" ON problem_versions;
DROP POLICY IF EXISTS "moderator_problem_versions" ON problem_versions;

-- Temporarily restore permissive policy (emergency only)
CREATE POLICY "temp_all_read_problem_versions" ON problem_versions
  FOR SELECT USING (true);

-- Repeat for solution_versions, artifacts, etc.
```

### If Code Issues Found

```bash
# Revert to previous commit
cd /Users/lcq/Documents/ProofArena
git revert 7ac8356
git push origin main
```

Vercel will auto-deploy the revert.

---

## Known Limitations (Document for Users)

### ⚠️ Capabilities API - Ad-Hoc Verification Only

**Current State**:
- Capability API accepts arbitrary input values
- Artifact `verifies` relation may not accurately reflect what was verified
- No enforcement that input came from a specific version

**User Impact**:
- Do NOT show "✓ Verified" badges on solution pages yet
- Do NOT rely on `verifies` relation for trust decisions
- Verification results are for exploration only

**Mitigation**:
- Document in API docs: "Ad-hoc verification mode"
- Phase 2 will add input binding to canonical versions

### ⚠️ Artifact Publishing Flow Incomplete

**Current State**:
- All artifacts default to `status: draft, isPublic: false`
- No UI for publishing artifacts
- `artifact-publication-service.ts` is a skeleton

**User Impact**:
- Created artifacts are private by default
- Manual database update needed to publish

**Mitigation**:
- Phase 2 will add moderator publishing UI
- For now, moderators can manually UPDATE in Supabase

---

## Monitoring

### Key Metrics

1. **Error Rate**: Should remain < 1%
   - Monitor Vercel error logs
   - Check Supabase logs for RLS violations

2. **API Latency**: `/api/capabilities/runs`
   - Expected: < 500ms for synchronous part
   - Provider calls (Lean/AXLE) may take 5-30s

3. **Database Growth**: `capability_runs` table
   - Expected: ~100-1000 rows/day (depends on usage)
   - Monitor for unexpected spikes (could indicate DoS)

4. **RLS Policy Violations**: Should be 0
   - Check Supabase logs for "permission denied" errors
   - If non-zero, investigate immediately

### Alerts to Set Up

1. **Critical**: Application startup failure
2. **High**: RLS policy violations
3. **Medium**: API error rate > 5%
4. **Low**: Slow query warnings

---

## Success Criteria

✅ **Deployment Successful If**:
- [ ] Application loads without errors
- [ ] Registry builds correctly (no key mismatch errors)
- [ ] All smoke tests pass
- [ ] RLS policies enforce privacy correctly
- [ ] No regressions in existing features
- [ ] Lean verification returns semantically correct results

❌ **Rollback If**:
- Application fails to start
- Registry key mismatch errors in logs
- RLS allows unauthorized access
- Existing features broken

---

## Post-Deployment Communication

### To Users:
```
✅ Deployed: Math Hub v2 Phase 1.1

Improvements:
- More reliable verification system
- Better privacy for draft content
- Improved data integrity

Known limitations:
- Verification is in "ad-hoc mode" (results for exploration only)
- Artifacts require manual publishing

Full release notes: [link to GitHub release]
```

### To Team:
```
Phase 1.1 deployed successfully.

Fixed:
- P0-1: Registry key mismatch (crash prevention)
- P0-2: Semantic correctness (rejected ≠ refuted)
- P0-3: Version privacy leak
- P0-4: Artifact auto-publication

Phase 2 priorities:
- P0-5: Input binding to versions
- Publishing flow UI
- Idempotency implementation

See PHASE_1_1_DELIVERY.md for full details.
```

---

## Appendix: Quick Command Reference

```bash
# Check deployment status
curl -I https://proofarena.com/

# Run smoke tests
export AUTH_TOKEN="your-token"
./scripts/smoke-test-api.sh

# Check Vercel logs
vercel logs proofarena.com --follow

# Check database
psql $DATABASE_URL -c "SELECT COUNT(*) FROM capability_runs WHERE created_at > now() - interval '1 hour';"

# Emergency: disable new runs
# (Add to Vercel env vars)
CAPABILITY_API_DISABLED=true
```
