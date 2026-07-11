# Phase 1.1 Completion - Implementation Guide

## Current Status

**Completed:**
1. ✅ Comprehensive audit (docs/PHASE_1_1_COMPLETION_AUDIT.md)
2. ✅ Migration 030 with fixes for 029 errors
3. ✅ Input resolver for version-bound vs ad-hoc modes
4. ✅ Database RPCs for atomic operations
5. ✅ Updated RLS policies

**Remaining Work:**
The foundation is in place. The following files need to be updated to use the new infrastructure.

---

## Implementation Checklist

### 1. Update Repository Interfaces

**File:** `domains/capabilities/capability-run-repository.ts`

Add methods:
```typescript
createWithInputs(input: CreateRunWithInputsInput): Promise<CapabilityRunRecord>;
markProjectionComplete(id: string): Promise<void>;
markProjectionFailed(id: string, error: string): Promise<void>;
getInputs(runId: string): Promise<ResolvedInput[]>;
```

**File:** `domains/artifacts/artifact-repository.ts`

Add methods:
```typescript
createBundle<K extends ArtifactKind>(input: CreateArtifactBundleInput<K>): Promise<ArtifactRecord<K>>;
publish(artifactId: string, publishedBy: string): Promise<ArtifactRecord>;
```

### 2. Update Repository Implementations

**File:** `domains/capabilities/supabase-capability-run-repository.ts`

Implement:
- `createWithInputs()`: Call `create_capability_run_with_inputs()` RPC
- `markProjectionComplete()`: UPDATE projection_status = 'completed'
- `markProjectionFailed()`: UPDATE projection_status = 'failed', projection_error
- `getInputs()`: SELECT from capability_run_inputs, reconstruct ResolvedInput[]

**File:** `domains/artifacts/supabase-artifact-repository.ts`

Implement:
- `createBundle()`: Call `create_artifact_bundle()` RPC
- `publish()`: Call `publish_artifact()` RPC

### 3. Update CapabilityService

**File:** `domains/capabilities/capability-service.ts`

Replace entire file with the version that:
- Uses `CapabilityInputResolver`
- Calls `createWithInputs()` instead of `create()`
- Calls `createBundle()` instead of separate create/relation/evidence calls
- Implements `repairProjection()` method
- Handles projection failures without changing run status

### 4. Complete ArtifactPublicationService

**File:** `domains/artifacts/artifact-publication-service.ts`

Replace the stub implementation:
```typescript
async publish(request: PublishArtifactRequest): Promise<PublishArtifactResult> {
  // ... existing validation ...
  
  // 6. Call repository.publish()
  const published = await this.artifactRepository.publish(
    artifactId,
    actor.userId
  );
  
  return { success: true, artifact: published };
}
```

### 5. Add Publication API Route

**File:** `app/api/artifacts/[id]/publish/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-server";
import { ArtifactPublicationService } from "@/domains/artifacts/artifact-publication-service";
import { SupabaseArtifactRepository } from "@/domains/artifacts/supabase-artifact-repository";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServiceRoleClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = {
    userId: user.id,
    email: user.email,
    role: user.user_metadata?.role || "user",
  };

  const repository = new SupabaseArtifactRepository(supabase);
  const service = new ArtifactPublicationService(repository);

  const result = await service.publish({
    artifactId: params.id,
    actor,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json(result.artifact);
}
```

### 6. Update Capability API to Use Input Resolver

**File:** `app/api/capabilities/runs/route.ts`

Update POST handler to accept both input modes:
```typescript
// Parse request
const body = await request.json();

// Support both legacy and new input formats
const inputs = body.inputs.map((inp: any) => {
  // New format: explicit objectType
  if (inp.objectType === "solution_version" || inp.objectType === "ad_hoc_source") {
    return inp;
  }
  
  // Legacy format: convert to ad_hoc_source
  if (inp.value) {
    return {
      objectType: "ad_hoc_source",
      inputKey: inp.inputKey || "proof_source",
      role: inp.role || "proof_source",
      value: inp.value,
    };
  }
  
  throw new Error("Invalid input format");
});
```

### 7. Add Comprehensive Tests

**File:** `domains/capabilities/input-resolver.test.ts` (NEW)

Test cases:
- Version-bound: valid solution_version
- Version-bound: version not found
- Version-bound: version mismatch
- Version-bound: no Lean source in content
- Version-bound: access denied (unpublished + not owner)
- Ad-hoc: valid source
- Ad-hoc: source too large
- Ad-hoc: cannot have versionId

**File:** `domains/capabilities/capability-service.test.ts` (UPDATE)

Add test cases:
- Server-generated idempotency works
- Concurrent requests deduplicated
- Unique constraint violation handled gracefully
- Projection failure doesn't mark run as failed
- repairProjection() recreates artifact without calling provider

**File:** `domains/artifacts/artifact-repository.test.ts` (UPDATE)

Add test cases:
- createBundle() atomic (all or nothing)
- publish() validates and atomically publishes
- publish() idempotent

### 8. Add RLS Acceptance Tests

**File:** `scripts/verify-math-hub-rls.mts` (NEW)

TypeScript script using real Supabase clients:
```typescript
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Test anon can only read published versions
// Test auth user can read own unpublished
// Test moderator can read all
// Test public artifacts readable by anon
// Test private artifacts return 404 for non-owner
// ... etc
```

### 9. Add API Integration Tests

**File:** `scripts/smoke-test-api.mts` (NEW)

Real API tests against local Next.js:
```typescript
import { test } from "node:test";
import assert from "node:assert";

test("POST /api/capabilities/runs - version-bound", async () => {
  const response = await fetch("http://localhost:3000/api/capabilities/runs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": authCookie,
    },
    body: JSON.stringify({
      capabilityKey: "verify.lean",
      inputs: [{
        objectType: "solution_version",
        objectId: testSolutionId,
        versionId: testVersionId,
        inputKey: "proof_source",
        role: "proof_source",
      }],
    }),
  });
  
  assert.strictEqual(response.status, 201);
  const run = await response.json();
  assert.strictEqual(run.status, "queued");
});
```

### 10. Update Test Script

**File:** `package.json`

```json
{
  "scripts": {
    "test": "node --import tsx --test lib/is-moderator.test.ts verification/api.test.ts verification/ui-meta.test.ts verification/providers/axle/axle-provider.test.ts verification/service/*.test.ts contracts/evidence.test.ts domains/capabilities/**/*.test.ts domains/content/**/*.test.ts domains/artifacts/**/*.test.ts",
    "test:rls": "npx tsx scripts/verify-math-hub-rls.mts",
    "test:api": "npx tsx scripts/smoke-test-api.mts"
  }
}
```

### 11. Fix Documentation

**Files to update:**
- `PHASE_1_1_DELIVERY.md`: Replace with accurate completion report
- `PHASE_1_1_AUDIT.md`: Archive or integrate into completion report
- `DEPLOYMENT_CHECKLIST.md`: Fix domain, remove fake routes, fix rollback

---

## Testing Strategy

### Local Development

1. Start local Supabase:
```bash
supabase start
```

2. Apply all migrations 001-030:
```bash
supabase db reset
```

3. Run unit tests:
```bash
npm test
```

4. Run RLS tests:
```bash
npm run test:rls
```

5. Start Next.js:
```bash
npm run dev
```

6. Run API tests:
```bash
npm run test:api
```

### Migration 030 Verification

After applying migration 030 to local Supabase:

```sql
-- Test trigger fix
UPDATE problem_versions SET content = '{}' WHERE id = '<any-id>';
-- Should fail with "content fields are immutable"

-- Test idempotency index
INSERT INTO capability_runs (...) VALUES (...);
INSERT INTO capability_runs (...) VALUES (...); -- Same hash
-- Second insert should fail with unique violation

-- Test RPC functions exist
SELECT create_capability_run_with_inputs(...);
SELECT create_artifact_bundle(...);
SELECT publish_artifact(...);
```

---

## Estimated Effort

- Repository implementations: ~2-3 hours
- CapabilityService update: ~1 hour
- Publication service completion: ~30 minutes
- API routes: ~1 hour
- Test files: ~3-4 hours
- RLS acceptance: ~2 hours
- API integration tests: ~2 hours
- Documentation fixes: ~1 hour

**Total: ~12-15 hours** for a complete, tested implementation.

---

## Success Criteria

Phase 1.1 is complete when:

1. ✅ Migration 030 applies cleanly
2. ✅ All triggers work correctly (no entity_id errors)
3. ✅ Version-bound inputs extract canonical source from DB
4. ✅ Ad-hoc inputs accepted but don't create verifies relations
5. ✅ Server-generated idempotency prevents duplicate runs
6. ✅ Atomic operations ensure no partial writes
7. ✅ Projection repair works without re-calling provider
8. ✅ Publication service fully functional
9. ✅ RLS acceptance tests pass (100%)
10. ✅ API smoke tests pass (100%)
11. ✅ npm run lint passes
12. ✅ npm run build passes
13. ✅ All 60+ tests run and pass
14. ✅ Documentation matches implementation
15. ✅ No P0/P1 issues deferred to Phase 2

---

## Notes

- This guide provides the complete structure and implementation patterns
- Migration 030 and input resolver are already complete
- Repository implementations follow the RPC calling pattern
- All database constraints are in place to enforce correctness
- Tests should cover both happy path and error cases
- Documentation must be updated to reflect actual capabilities
