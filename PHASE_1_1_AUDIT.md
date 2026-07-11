# Math Hub v2 Phase 1.1 Audit Report

## Audit Date
2026-07-11

## Audit Scope
Review Math Hub v2 Phase 1 implementation (commits e521a7d through cc8a99a, merged as 7e4a24c) for runtime, security, semantic correctness, and data integrity issues.

## P0 Issues Found

### P0-1: Registry Key Mismatch (Runtime Crash)
**Location:** `domains/capabilities/default-registry.ts` + `domains/capabilities/adapters/lean-verification-adapter.ts`

**Problem:**
- CapabilityDefinition uses: `key: "verify.lean"`
- LeanVerificationAdapter uses: `capabilityKey = "lean_verification"`
- Registry.register() enforces strict equality, causing runtime exception on first buildDefaultRegistry() call

**Impact:** Application crashes on startup when attempting to register capabilities

**Root Cause:** Inconsistent naming during initial implementation

---

### P0-2: Incorrect Mathematical Semantics (Lean rejection → refuted)
**Location:** `domains/capabilities/adapters/lean-verification-adapter.ts:122`

**Problem:**
```typescript
} else if (task.verdict === "rejected") {
  conclusion = "refuted";  // ❌ WRONG
  evidenceLevel = "machine_checked";
}
```

**Mathematical Error:**
- "Lean proof rejected" means "this proof attempt failed to compile/typecheck"
- It does NOT mean "the original mathematical statement is false"
- Only a verified counterexample or negation proof can produce `conclusion: "refuted"`

**Impact:** 
- Misleads users about mathematical correctness
- Violates semantic model in docs/architecture/verification-semantics.md
- Could cause incorrect problem classification

**Correct Mapping:**
- `accepted` → `verified` ✓
- `rejected` → `inconclusive` (not refuted)
- `timeout` → no artifact (Run timed_out)
- `invalid_request` → `unsupported` or no artifact
- `provider_error` → no artifact (Run failed)

---

### P0-3: Version Privacy Leak
**Location:** `supabase/migrations/027_content_version_foundation.sql:61-62, 65-66`

**Problem:**
```sql
CREATE POLICY "Problem versions are viewable by everyone" ON problem_versions FOR SELECT
  USING (true);  -- ❌ Allows anon to read unpublished/draft versions
```

**Impact:**
- Anonymous users can read unpublished problem versions
- Anonymous users can read unpublished solution versions
- `source_snapshot` (may contain private submission data) exposed
- Draft content visible before author intends

**Required Fix:**
- Anonymous: only `published_at IS NOT NULL`
- Authenticated: own versions + published versions
- Moderators: all versions
- Remove email whitelist dependency
- Create safe public views that exclude sensitive columns

---

### P0-4: Artifacts Auto-Published and Public
**Location:** `domains/capabilities/capability-service.ts:103-106`

**Problem:**
```typescript
const artifact = await this.deps.artifactRepository.create({
  status: "published",  // ❌ Auto-published
  isPublic: true,       // ❌ Auto-public
  createdBy: actor.userId,
});
```

**Impact:**
- Machine-checked success does not equal "ready for public consumption"
- No editorial review before publication
- Private inputs could leak through public artifacts
- No way to fix errors before making artifact visible

**Required Fix:**
- Default: `status: "draft", isPublic: false`
- Add explicit publication service
- Publication validates: input versions published, no private data leaks, provider_trace stays private
- Public artifact GET must allow anon (currently requires auth)
- Private artifact GET returns 404 for non-owners (not 403, prevents existence leak)

---

### P0-5: Capability Input Not Bound to Canonical Version
**Location:** `app/api/capabilities/runs/route.ts`, `domains/capabilities/capability-service.ts`

**Problem:**
- API accepts `objectType="solution"` with arbitrary `value` (proof_source)
- No validation that proof_source matches the solution content
- Client can submit versionId + unrelated proof_source
- Artifact claims to verify a solution_version but actually verified different content

**Impact:**
- Artifact.verifies relation is dishonest
- Cannot trust "this solution is verified" badges
- Version history loses meaning

**Required Fix:**
- Only accept `solution_version` with required `versionId`
- Server fetches version content and extracts canonical Lean source
- Or: separate `ad_hoc_source` mode that doesn't claim to verify a specific version
- Artifact relations only created when input version binding is verified
- CapabilityRunInput must persist actual executed content (snapshot + hash)

---

## P1 Issues Found

### P1-1: Missing Idempotency Implementation
**Location:** `domains/capabilities/capability-service.ts:56-62`

**Problem:**
- Code checks `idempotencyKey` but doesn't generate server-side key when absent
- Docs claim "default input hash idempotency" but not implemented
- Concurrent identical requests could create duplicate runs

**Required Fix:**
- Generate stable idempotency key from: capability+version, provider, config, input hash, actor
- Handle unique constraint violations (concurrent requests)
- Don't re-call AXLE for duplicate requests

---

### P1-2: Non-Atomic Multi-Table Writes
**Location:** `domains/capabilities/capability-service.ts:96-120`

**Problem:**
- Run created
- Adapter executes
- Artifact created
- Evidence loop (multiple inserts)

If evidence insert fails partway:
- Artifact exists but incomplete
- Public artifact with missing evidence
- No transaction boundary

**Required Fix:**
- Use Postgres RPC or explicit transaction for artifact bundle
- If projection fails, don't re-call AXLE
- Provide repair mechanism for failed projections

---

### P1-3: Database Integrity Constraints Missing
**Location:** `supabase/migrations/027_content_version_foundation.sql`, `028_capability_run_artifact_evidence.sql`

**Missing Constraints:**
- current_version_id must belong to same problem/solution (not cross-entity)
- parent_version_id must belong to same problem/solution
- Version content immutability (prevent UPDATE of content/hash after creation)
- Duplicate content_hash prevention: UNIQUE(problem_id, content_hash)
- Run terminal states require completed_at
- Artifact public requires published
- provider_trace evidence cannot be public (CHECK exists but need trigger)

**Required Fix:**
- Create 029_math_hub_v2_hardening.sql
- Add triggers/constraints for all invariants
- Add version immutability trigger
- Add relation target existence triggers (polymorphic FK validation)

---

### P1-4: Service Role Used for User Reads
**Location:** `app/api/capabilities/runs/route.ts`, `app/api/artifacts/[id]/route.ts`

**Problem:**
- GET endpoints use `getServiceClient()` then manually filter by owner
- RLS not actually enforcing access control for reads
- Duplicates authorization logic in every repository

**Required Fix:**
- User reads use user-context client, let RLS enforce
- Service role only for: capability execution writes, controlled publication, admin repairs
- Moderator identity from user_profiles.role (not auth role="authenticated")
- Delete duplicate email whitelist checks

---

### P1-5: Missing Documented Files
**Location:** `docs/ARCHITECTURE_V2.md:102,242`

**Problem:**
- Docs reference `domains/artifacts/verification-artifact-mapper.ts`
- File does not exist
- Mapping logic embedded in adapter

**Required Fix:**
- Remove false claims from docs OR
- Extract mapper to standalone module if genuinely needed

---

## Summary

**P0 Issues:** 5 (all block production deployment)
**P1 Issues:** 5 (must fix before Phase 2)

**Next Steps:**
1. Fix P0 issues (commits 1-6)
2. Fix P1 issues (commits 7-10)
3. Add acceptance tests (commit 11)
4. Update docs (commit 12)
5. Generate Phase 1.1 delivery report

**No Production Deployment Until:**
- All P0/P1 fixed
- RLS acceptance tests pass
- API smoke test passes
- No regression in existing verification system
