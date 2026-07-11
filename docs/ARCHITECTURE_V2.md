# ProofArena Math Hub v2 — Architecture (Phase 1)

> Status: Phase 1 delivered — one real vertical slice exists end-to-end (Lean/AXLE
> verification running through the new Capability/Artifact/Evidence pipeline).
> Everything else described as "planned" below is a contract, not yet a second
> implementation. See [`MATH_HUB_MIGRATION.md`](./MATH_HUB_MIGRATION.md) for the
> phase-by-phase rollout and [`architecture/`](./architecture/) for the
> maintainability-refactor audit this builds on top of.

## 1. Positioning

ProofArena's product surface (problem bank, multi-solution comparison, contests) is
unchanged. What changes is the layer underneath it: ProofArena is evolving from "a
Next.js app with a `verification_tasks` table" into **an open hub that owns math
content identity, versioning, and provenance, and that can register and call
external math capabilities (formal verification today; formalization,
counterexample search, geometry, CAS, diagnostics later) through one uniform
Provider contract, recording every call as an auditable Run → Artifact → Evidence
chain.**

ProofArena owns:
- Stable identity and versioning for `Problem`, `Solution` (and, later, other
  content objects).
- Provenance: source, author, license, derivation lineage.
- Users, permissions, submissions, review, contests, community behavior.
- A capability registry and a uniform way to invoke external math tools.
- Capability run bookkeeping (`CapabilityRun`).
- Standardized `Artifact` + `Evidence` — the durable, replayable record of what a
  capability concluded about a specific content version.
- Composing artifacts (verification reports, later: counterexamples, reasoning
  graphs, method comparisons) into product surfaces.

Independent tools own their own internals (Lean elaboration, CAS internals,
counterexample search heuristics, NL formalization, geometry engines). ProofArena
never re-implements their logic — it defines the `Provider` boundary they're
called through.

## 2. Relationship to the in-flight maintainability refactor

This branch (`architecture/math-hub-v2`) was branched from
`refactor/architecture-governance` at commit `d6e9496`, which already contains a
completed audit for a **different, orthogonal** refactor: extracting
`domains/{solution, proof-intelligence, verification, arena, ...}` bounded
contexts out of today's oversized files (`SubmitForm.tsx`, `AdminContestsView.tsx`,
the 9 duplicated moderator checks, ...) — see
[`architecture/domain-map.md`](./architecture/domain-map.md),
[`architecture/principle-violations.md`](./architecture/principle-violations.md),
and [`MAINTAINABILITY_REFACTOR_PLAN.md`](./MAINTAINABILITY_REFACTOR_PLAN.md). That
plan's Phase 1.5 (authorization convergence into `lib/is-moderator.ts`) is already
merged into this branch's base commit. Its later phases (extracting
`domains/submissions/`, `domains/submission-review/`, etc.) are **not** part of
this work and are not duplicated here.

**Naming collision, resolved on purpose:** that audit uses `capabilities/` to mean
cross-cutting *platform* services (quota, moderation, notifications, jobs, audit,
observability — i.e. supporting infrastructure every domain depends on). Math Hub
v2 uses **Capability** to mean something more specific and business-facing: *a
generic, callable math-tool operation* (`verify.lean`, later `formalize.statement`,
`search.counterexample`, ...) with a versioned contract and a swappable Provider
behind it. These are different concepts that happen to share an English word.
Rather than let that collide, this document uses:
- `domains/capabilities/` — the new Capability/Provider/Run/Artifact platform
  (this document's subject).
- `platform/` — supporting infrastructure Math Hub v2 itself needs (a database
  client seam, a permissions seam). This intentionally does **not** absorb the
  maintainability refactor's planned `capabilities/{quota,moderation,...}/` tree.

**Recommendation for whoever executes the maintainability refactor's later
phases:** rename its `capabilities/` to `platform/` (or `shared/services/`) before
physically creating that directory, to keep "Capability" meaning one thing
repo-wide. Nothing on disk depends on the old name yet, so this is a free rename
today and won't be free later.

## 3. Bounded contexts introduced in Phase 1

```
contracts/                       # framework-free type contracts, no runtime deps on Supabase
  content.ts                     # ContentVersionRecord<T>, VersionedEntityId
  capability.ts                  # CapabilityKey, CapabilityDefinition, CapabilityRunRecord
  artifact.ts                    # ArtifactKind, ArtifactRelationType, ArtifactRecord<TPayload>
  evidence.ts                    # EvidenceKind, EvidenceLevel, Conclusion, RunConclusion, EvidenceRecord
  references.ts                  # ObjectType, VersionedRef, ArtifactRelationInput

domains/
  content/
    versioning/                  # content hashing + version/lineage primitives (shared by problem & solution)
      content-hash.ts
      version-repository.ts          (interface)
      supabase-version-repository.ts (impl, generic over problem_versions/solution_versions)
    problem/
      problem-versions.ts         # createProblemVersion(), getCurrentProblemVersion()
    solution/
      solution-versions.ts        # createSolutionVersion(), getCurrentSolutionVersion()
  capabilities/
    registry.ts                  # capability registration + lookup
    capability-service.ts        # CapabilityService.run()/get()/retry()
    capability-run-repository.ts (interface) + supabase-capability-run-repository.ts
    adapters/
      lean-verification-adapter.ts   # wraps the EXISTING VerificationService, unmodified
  artifacts/
    artifact-repository.ts (interface) + supabase-artifact-repository.ts
    verification-artifact-mapper.ts  # VerificationTaskDto -> Artifact + Evidence[]
    current-artifact.ts              # pure staleness/currency check against a version pointer
  identity/
    actor.ts                     # re-exports lib/is-moderator.ts + lib/require-moderator.ts as a stable seam

platform/
  database/
    service-client.ts            # re-exports lib/supabase-server's service client under a stable import path
  providers/
    provider-adapter.ts           # generic CapabilityProviderAdapter<TRequest,TResult> contract

app/api/capabilities/runs/route.ts          # POST create, GET list
app/api/capabilities/runs/[id]/route.ts     # GET one
app/api/capabilities/runs/[id]/retry/route.ts  # POST retry
app/api/artifacts/[id]/route.ts             # GET one (public/owner/moderator visibility)
```

`domains/arena/` is **not** created as code in Phase 1. The Arena/Solution boundary
below is delivered as a *contract* (`contracts/references.ts`'s `VersionedRef`) plus
a design decision, not a rewrite of the contest submission pipeline — see §7.

Deliberately **not** created: `platform/events/`, `platform/permissions/` as
separate trees, `domains/artifacts` schema for anything beyond
`verification_report`. Nothing in the real vertical slice needs an event bus or a
second permissions seam beyond `domains/identity`; adding them now would be
abstraction with no caller, which principle #15 of this task explicitly forbids.

## 4. Canonical objects and versioning

`problems` and `solutions` remain the stable-entity tables (their `TEXT` ids are
the entity identity ProofArena already publishes URLs and cross-references
against — not renamed, not replaced).

New: an **immutable version table per entity**, added by
`supabase/migrations/025_content_version_foundation.sql`:

```
problem_versions / solution_versions
  id                  UUID PK
  <problem|solution>_id  TEXT  REFERENCES problems|solutions(id)
  version_number      INTEGER          -- 1, 2, 3... per entity
  parent_version_id   UUID REFERENCES <same table>(id)
  content             JSONB            -- full snapshot of the versioned fields
  content_hash        TEXT             -- sha256 of a canonical serialization of `content`
  change_summary      TEXT
  source_submission_id UUID REFERENCES submissions(id)   -- solution_versions only
  created_by          UUID REFERENCES user_profiles(id)
  created_at          TIMESTAMPTZ
  published_at        TIMESTAMPTZ NULL
  UNIQUE(<entity>_id, version_number)
```

`problems.current_version_id` / `solutions.current_version_id` are added as
nullable columns on the existing tables (no existing read path changes — nothing
queries this column yet). `content_hash` is computed by
`domains/content/versioning/content-hash.ts` (canonical JSON + sha256) in
TypeScript, never in SQL — so a version created by the future
`ContentVersioningService` and a version backfilled by
`scripts/backfill-content-versions.mts` are hashed identically and comparable.
Creating a new version when `content_hash` is unchanged is a documented no-op
(the version-lineage audit's finding that solutions are "accidentally immutable"
today is treated as should-stay-explicit, not incidental).

This is intentionally the minimum version model, not the full "ProblemVersion +
SolutionRevision + ProofIRVersion" chain `version-lineage.md` sketches — ProofIR
(the Proof Graph's own versioning) is explicitly out of scope here and needs its
own design pass, per that document's own recommendation.

## 5. Capability / Provider / Run

A **Capability** is a named, versioned operation (`capability_key`, e.g.
`verify.lean`) with a declared input shape, output Artifact kind, and permission
policy — registered in code (`domains/capabilities/registry.ts`), not a database
CMS, per this task's explicit instruction to prefer a code registry in Phase 1:

```ts
interface CapabilityDefinition {
  key: string;                 // "verify.lean"
  version: number;
  acceptedInputTypes: ObjectType[]; // ["solution_version", "problem_version"]
  outputArtifactKind: ArtifactKind; // "verification_report"
  providerKey: string;         // "axle" (matches verification's existing `provider`)
  configurationSchema?: (config: unknown) => string[]; // returns validation errors, no Zod
  permissionPolicy: (actor: Actor, input: CapabilityRunInput) => boolean;
  retryPolicy: { maxAttempts: number };
}
```

A **Provider** executes a Capability (`domains/capabilities/adapters/*`, backed by
`platform/providers/provider-adapter.ts`'s generic
`CapabilityProviderAdapter<TRequest, TResult>` — this generalizes, and does not
replace, `verification/providers/provider-interface.ts`'s existing
`VerificationProviderAdapter<TRequest,TResult>`).

A **CapabilityRun** (`capability_runs` table, migration 026) is the execution
record:

```
capability_runs
  id                UUID PK
  capability_key    TEXT
  provider_key      TEXT
  requested_by      UUID REFERENCES user_profiles(id)
  status            TEXT CHECK IN (queued, running, succeeded, failed, cancelled)
  configuration     JSONB
  input_hash        TEXT
  idempotency_key   TEXT NULL         -- UNIQUE per (requested_by, capability_key) when set
  legacy_verification_task_id UUID REFERENCES verification_tasks(id)
  error_code        TEXT NULL
  error_message     TEXT NULL
  cost_metadata     JSONB
  started_at / completed_at / created_at / updated_at  TIMESTAMPTZ

capability_run_inputs
  id, run_id, object_type (problem_version|solution_version|problem|solution|submission),
  object_id, version_id, role, content_hash, snapshot JSONB
```

`legacy_verification_task_id` is the seam described in §6 — it is how a
`capability_runs` row stays a thin, honest wrapper around the pre-existing
`verification_tasks` row instead of a second, competing source of truth.

## 6. Adapting existing Lean/AXLE verification (the real vertical slice)

Nothing in `verification/` is modified. `VerificationService`, `LeanEngine`,
`AxleProvider`, `SupabaseVerificationRepository`, and both existing
`/api/verifications` routes are untouched and keep their current behavior,
caching, rate limiting, and RLS exactly as-is.

```
POST /api/capabilities/runs { capabilityKey: "verify.lean", input: {...} }
  -> CapabilityService.run()
  -> registry lookup: "verify.lean" -> LeanVerificationCapabilityAdapter
  -> adapter calls the EXISTING createVerificationService().create(actor, request)
       (one call; all dedup/cache/rate-limit logic is the existing service's,
       unchanged — this adapter never talks to AXLE directly)
  -> adapter maps the returned VerificationTaskDto into:
       - capability_runs row (status projected from task status,
         legacy_verification_task_id = task.id)
       - artifacts row, kind="verification_report", payload = the standardized
         result (see §8), via verification-artifact-mapper.ts
       - evidence row(s): kind="provider_trace" (source snapshot + messages,
         is_public=false always) and, when accepted, kind="lean_proof"
  -> API responds with { run, artifact }
```

**Execution source of truth:** `verification_tasks` remains authoritative for
"did AXLE run and what did it say" — `VerificationService` already owns atomic
create/cache/rate-limit against it. `capability_runs` is a *projection*, written
only after `VerificationService.create()` has already returned. This means:
- AXLE is invoked at most once per logical request, bounded entirely by
  `VerificationService`'s existing coalescing — the adapter adds no second call
  path.
- If the `capability_runs`/`artifacts` write fails **after** a successful
  `VerificationService` call, no math result is lost (`verification_tasks` already
  has it); the CapabilityRun projection can be repaired by re-querying
  `source_hash` without re-invoking AXLE. Covered by
  `capability-service.test.ts`'s "adapter write fails after provider succeeds"
  case.
- `idempotency_key` defaults to `input_hash` when the caller doesn't supply one,
  so retrying identical content is naturally idempotent at the CapabilityRun
  layer, on top of (not instead of) `VerificationService`'s own `source_hash`
  cache.

## 7. Arena / Solution boundary

Confirmed by migration `004_contest_arena_mvp.sql` and `lib/types.ts`:
`ContestAward.solutionId` and `submissions`/`solutions`' `contest_*` columns are
plain FKs to the live, mutable `solutions` row — there is no snapshot. An award
today references *whatever `solutions.id` currently contains*, not what it
contained at contest time. This is real, documented, load-bearing behavior
(`docs/CONTESTS.md`), not hypothetical.

Phase 1 does not rewrite the contest submission pipeline — that is explicitly a
larger, separately-scoped effort (this task's own guidance: "如果完整迁移风险过大，
先写出明确领域契约"). What Phase 1 delivers:

- `contracts/references.ts`'s `VersionedRef = { objectType, objectId, versionId }`
  is the shape any future `ArenaSubmission` model must use instead of a bare FK.
- Since `solution_versions` (§4) now exists, `solutions.current_version_id`
  gives every solution a concrete version identity *today*, even though nothing
  currently mutates published solution content. An award or capability run that
  wants a tamper-proof reference can point at `solution_versions.id` right now.
- The **test** that matters in Phase 1 is not a rewritten Arena — it's
  `domains/artifacts/current-artifact.test.ts` proving that if a solution *were*
  edited (i.e. a second `solution_versions` row appears), an `Artifact` created
  against version 1 is never reported as "current" for version 2. That's the
  concrete, checkable guarantee this phase can make without touching
  `AdminContestsView.tsx` or the awards flow.

Next phase (not this one): give `ContestAward` and contest-tagged `submissions`/
`solutions` rows a `solution_version_id` column populated at submission time, and
stop trusting `solutions.id` alone for "what did this contestant actually submit."

## 8. Standardized capability result (why it's not the flat enum verbatim)

The task's brief lists a flat result enum (`formally_verified`,
`symbolically_verified`, `conditionally_valid`, `counterexample_found`,
`ambiguous`, `unsupported`, `failed`). `docs/architecture/verification-semantics.md`
— written by the concurrent governance audit against this exact codebase — already
designed a strictly more expressive model that this document adopts verbatim,
because collapsing it back into one flat enum would re-introduce the very bug
that doc flags as the worst offender today (`Solution.verification`'s single
`status` field conflating an infra outcome with a math conclusion):

```ts
// capability_runs.status (infra lifecycle, DB CHECK constraint):
//   "queued" | "running" | "succeeded" | "failed" | "timed_out" | "cancelled"

// artifacts.payload (math conclusion — only exists when status = "succeeded";
// an infra failure/timeout/cancellation leaves error_code/error_message on the
// capability_runs row and produces NO artifact, since there is nothing to report):
interface RunConclusion {
  conclusion: "verified" | "refuted" | "inconclusive" | "unsupported" | "not_assessed";
  evidenceLevel: "machine_checked" | "symbolic_spot_check" | "editorial_claim";
  coverage: { checked: number; total: number; failedDeclarations: string[] };
  assumptions: { kind: string; detail: string }[];
  claim: string;
  verifiedScope: string[];
  unverifiedScope: string[];
  missingConditions: string[];
}
```

The task's flat states are recoverable as *views* over this, not lost:
`formally_verified` = `conclusion:verified` + `evidenceLevel:machine_checked`;
`symbolically_verified` = `conclusion:verified` + `evidenceLevel:symbolic_spot_check`;
`conditionally_valid` = `conclusion:verified` + non-empty `assumptions`;
`counterexample_found` = `conclusion:refuted`; `ambiguous` = `inconclusive`;
`unsupported` = `unsupported`; `failed` = `capability_runs.status = 'failed'`
(infra, at a different layer than `conclusion` entirely — a failed run has no
artifact at all, so there is no `conclusion` value competing with it). **No
aggregate trust/confidence score is ever computed or stored** — this is a hard
rule carried over from `verification-semantics.md`, and the API/RLS layer
enforces it structurally by never exposing a field that could be mistaken for
one.

`Evidence` kinds (`lean_proof`, `symbolic_check`, `numerical_counterexample`,
`manual_review`, `provider_trace`, `test_result`) map onto `evidenceLevel` as:
`lean_proof`/`test_result` → `machine_checked`; `symbolic_check` →
`symbolic_spot_check`; `manual_review` → `editorial_claim`; `provider_trace` is
orthogonal (raw diagnostic, always `is_public=false`, never itself a conclusion
source).

## 9. Data flow

```
Solution (mutable row, entity identity)
  → SolutionVersion (immutable snapshot + content_hash, backfilled today from current content)
  → CapabilityRun (capability_key="verify.lean", references SolutionVersion via capability_run_inputs)
  → [adapter] → existing VerificationService → existing LeanEngine → existing AxleProvider → AXLE
  → VerificationTaskDto (verification_tasks row, unchanged source of truth)
  → Artifact (kind="verification_report", standardized payload per §8)
  → Evidence (provider_trace private, lean_proof when accepted)
  → GET /api/artifacts/:id  (public only if artifacts.is_public, else owner/moderator)
  → existing problem/solution detail pages' VerificationPanel (Phase 2: wire this Artifact in
    as an alternative renderer; Phase 1 does not touch the existing panel's data source)
```

## 10. Permission boundaries

- `capability_runs`: RLS mirrors `verification_tasks` exactly — owner SELECT,
  moderator SELECT all, **no INSERT/UPDATE/DELETE policy for any client role** —
  every write goes through `SupabaseCapabilityRunRepository` using the service-role
  client from `platform/database/service-client.ts` (itself just a re-export of
  `lib/supabase-server.ts`'s `createServiceClient`, not a new client).
- `artifacts` / `artifact_relations` / `evidence`: same no-client-write rule.
  SELECT is: owner or moderator of the parent run, OR `is_public = true` (artifacts)
  / the parent artifact is public (relations, evidence). A `public_artifacts`
  security-barrier view (mirroring the existing `public_verification_summaries`
  pattern) redacts everything except the standardized §8 payload and `summary`.
- CHECK constraints enforce internal consistency even for the trusted
  service-role writer (mirrors `verification_tasks`' existing
  `..._terminal_verdict_check` etc. pattern) — e.g. `status='succeeded'` requires
  a non-null artifact link; `is_public=true` on `evidence` requires the parent
  artifact to also be public.
- API routes (`app/api/capabilities/runs/*`, `app/api/artifacts/*`) authenticate
  via the existing `getVerificationActor()`-style pattern, authorize via
  `domains/identity/actor.ts` (which is `lib/is-moderator.ts` /
  `lib/require-moderator.ts`, not a reimplementation), enforce a request body size
  cap and a per-user rate limit on `POST /runs` (reusing the existing
  `RATE_LIMIT_REQUESTS`/`RATE_LIMIT_WINDOW_MINUTES` policy constants from
  `verification/domain/policies.ts` rather than inventing new numbers), and never
  accept a client-supplied `status`, `provider`, `conclusion`, or `evidence` value
  for a run the client didn't just create through the adapter.

## 11. Progressive migration strategy

See [`MATH_HUB_MIGRATION.md`](./MATH_HUB_MIGRATION.md) for the full phase list,
backfill/rollback plan, and the production migration checklist. Summary: Phase 1
(this work) adds tables and code with zero behavior change to any existing route;
nothing here requires a backfill to be *run* for existing functionality to keep
working (all new columns are nullable, all new tables are additively joined).

## 12. Non-goals (Phase 1)

Everything listed in the task's "非目标" section: no StepVerify/CounterLab/NL→Lean/
geometry recognition implementation, no message queue, no microservices, no
Kubernetes, no plugin marketplace, no billing, no full UI rewrite, no i18n, no
deletion of `data/problems.ts` or any existing table, no production deploy, no
production migration execution, no `git push`. Additionally, Phase 1 does not:
rewrite the contest submission pipeline (§7), design ProofIR versioning
(`version-lineage.md`'s explicit recommendation), touch anything in
`docs/architecture/`'s maintainability-refactor scope, or introduce Zod/a new
validation dependency (a small hand-written validator matches
`verification/api.ts`'s existing `parseCreateBody` convention instead).
