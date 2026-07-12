# Math Hub v2 — Phase 1.1 Completion Report

Branch: `fix/math-hub-v2-phase-1-1-completion` · Date: 2026-07-12

This report replaces the earlier Phase 1.1 documents (`PHASE_1_1_DELIVERY.md`
retained as history; the deployment checklist, executive summaries, and
"implementation guide" docs are deleted — they described work that had not
been done, referenced API routes that did not exist, and proposed a rollback
that would have reintroduced the `USING (true)` privacy leak).

## Status matrix

| Claim | Status | Proven by |
|---|---|---|
| Migration 030 fixes 029's broken triggers | done | `test:rls` trigger checks (mutation rejected, publish allowed, unpublish rejected) |
| 001–030 apply cleanly on an empty local DB | done | `supabase db reset` — 30 migrations, no errors |
| Version-bound inputs bind to the exact SolutionVersion | done | resolver unit tests + `test:api` (snapshot contains the stored source) |
| Ad-hoc inputs cannot impersonate a solution verification | done | SQL guard in `create_artifact_bundle` + `test:rls` forgery check |
| Server-resolved canonical inputs (client text rejected on version-bound) | done | `CLIENT_CONTENT_REJECTED` tests at unit + HTTP level |
| Default (server-computed) idempotency | done | unit + `test:api` replay checks |
| Concurrent duplicates never re-call the provider | done | gated-adapter unit test (5-way) + `test:api` (3-way, mock AXLE hit once) |
| Run + inputs atomic | done | RPC + orphan-rollback check in `test:rls` |
| Artifact + relations + evidence atomic | done | RPC + duplicate/forgery checks in `test:rls` |
| Projection repairable without re-calling AXLE | done | `repairProjection` unit tests (adapter.run count stays 1) |
| PublicationService is real (no skeleton) | done | unit tests + `test:api` moderator publish flow |
| Artifacts default private draft; publish is moderator-gated | done | `test:api` (owner→404 on publish, moderator→200, anon reads after) |
| Public surface leaks no private data | done | `test:rls` + `test:api` provider_trace/source checks |
| Service role only for controlled writes; user reads via RLS | done | two-client repositories; manual WHERE-clause RLS emulation removed |
| RLS acceptance automated | done | `npm run test:rls` — 44 PASS 0 FAIL |
| API smoke test hits real endpoints and asserts bodies | done | `npm run test:api` — 12 pass, 1 skip (opt-in real AXLE) |
| Legacy verification/contest/submission regression | done | full `npm test` (116) incl. all legacy suites + `verify-verification-rls.mts` (19 PASS) |

## The two input modes

`verify.lean` accepts exactly two input shapes; the old
`objectType:"solution"` + arbitrary `value` is rejected
(`UNSUPPORTED_OBJECT_TYPE`) because it is precisely the shape that let an
artifact look like a verification of a stored solution while executing
unrelated text.

**version-bound** — `{ objectType: "solution_version", objectId, versionId }`
- server loads the version, verifies `versionId` belongs to `objectId`, and
  applies the same visibility rule as RLS (published / creator / moderator)
- canonical source is `content.formalProofs.lean.source` — no heuristics; a
  version without it fails with `VERSION_HAS_NO_LEAN_SOURCE`
- client-supplied `value` / `contentHash` / `snapshot` → `CLIENT_CONTENT_REJECTED`
- missing / other-user's-draft / nonexistent all collapse to one
  `VERSION_NOT_FOUND` (no existence probing)
- artifact gets `verifies → solution_version(versionId)`; the SQL bundle
  function re-checks the relation targets a version-bound input of the SAME run

**ad-hoc** — `{ objectType: "ad_hoc_source", value: "<lean source>" }`
- `objectId`/`versionId` present → `AD_HOC_MUST_NOT_REFERENCE`
- size-capped (100k chars); hashed; snapshotted verbatim
- artifact gets NO `verifies` relation, and its claim text says "the submitted
  ad-hoc Lean source", so it can never render as an official solution badge

Staleness rule for future UI: a version-bound artifact is current iff its
`verifies` target equals `solutions.current_version_id`.

## Idempotency

Key = `auto:sha256(capabilityKey : defVersion : providerKey : sha256(canonical config) : inputHash)`
where `inputHash` hashes the RESOLVED inputs (type/id/version/role/contentHash).
Client-supplied keys are namespaced `client:<key>`; replaying one with
different inputs → HTTP 409 `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_INPUT`.
Uniqueness is `(requested_by, capability_key, idempotency_key)` (028's index),
so keys are per-user. Concurrency: the loser of the unique-index race
(`DuplicateRunError` ← SQLSTATE 23505) re-reads and returns the winner's run.

## Atomic writes and projection repair

Two `SECURITY DEFINER` RPCs (service-role only, `REVOKE`d from anon/authenticated):

- `create_capability_run_with_inputs` — run + all input rows in one
  transaction; validates version↔solution binding in SQL; any bad input rolls
  the run back (no orphans — asserted in `test:rls`).
- `create_artifact_bundle` — artifact + relations + evidence in one
  transaction; always `draft`/`is_public=false`; a `verifies` relation must
  match a version-bound input of the run; one artifact per
  `(run, kind, schema_version)` via unique index.

`capability_runs.projection_status` (`pending|completed|failed|not_applicable`)
tracks the bundle write separately from `status`. A bundle failure after a
successful provider execution leaves `status='succeeded'` untouched and marks
`projection_status='failed'`; `CapabilityService.repairProjection(runId)`
rebuilds the bundle from the stored `verification_tasks` row via
`adapter.reproject()` — a read, never a re-execution — and is idempotent via
the unique index.

## Publication

`publish_artifact` RPC is the only draft→published path: locks the row,
verifies every input version is itself published and no provider_trace is
public, then sets `status/is_public/published_at/published_by` in one UPDATE.
Idempotent; `published → draft` does not exist. Application gate:
`requireModerator()` (the repo's single moderator check) on
`POST /api/artifacts/[id]/publish`; non-moderators (including the artifact's
owner) receive the same 404 as a missing artifact.

## Lean verdict → conclusion (unchanged from 1.1, now tested against the real export)

| VerificationVerdict | Run status | Artifact | conclusion |
|---|---|---|---|
| accepted | succeeded | yes | verified |
| rejected | succeeded | yes | **inconclusive** (never refuted) |
| invalid_request | failed | no | — |
| timeout | timed_out | no | — |
| rate_limited / provider_error / resource_limit | failed | no | — |
| cancelled | cancelled | no | — |

## RLS permission matrix (verified by `npm run test:rls`)

| Object | anon | stranger | owner | moderator |
|---|---|---|---|---|
| published version | read | read | read | read |
| unpublished version | — | — | read | read |
| public version view | read (no snapshot/creator cols) | read | read | read |
| capability run / inputs | — | — | read | read |
| draft artifact / relations | — | — | read | read |
| published artifact / relations | read | read | read | read |
| public evidence (lean_proof) | read | read | read | read |
| provider_trace evidence | — | — | read | read |
| any INSERT/UPDATE on these tables | — | — | — | — (service role only) |
| the three RPCs | — | — | — | — (service role only) |

## Verification commands actually run (2026-07-12, this machine)

| Command | Result |
|---|---|
| `npm run lint` | pass (tsc + knowledge refs; `remotion-promo/` excluded from tsc — user asset from aeab5fa, untouched) |
| `npm test` | 116/116 pass (all legacy verification suites + new resolver/service/publication/adapter suites) |
| `npm run build` | pass |
| `supabase db reset` (local) | 30 migrations applied, no errors |
| `npm run test:rls` | 44 PASS / 0 FAIL |
| `npx tsx scripts/verify-verification-rls.mts` | 19 PASS / 0 FAIL (legacy system regression) |
| `npm run test:api` | 12 pass / 1 skip (skip = opt-in `RUN_AXLE_SMOKE_TEST=true` real-provider call) |

Real AXLE was NOT called: the smoke suite runs the full internal path
(route → registry → service → resolver → adapter → VerificationService →
LeanEngine → AxleProvider over HTTP) against a local mock AXLE server.

Not run / not done, explicitly: no deploy, no remote migration (029 and 030
both still need to be applied to the hosted project — 030 must go out with or
immediately after 029, since 029 alone leaves version UPDATEs broken), no push
(awaiting authorization), Remotion assets untouched.

Note for the remote migration: local history had two migrations numbered 020,
which broke `supabase db reset` (duplicate key in the CLI's migration table).
`020_contest_access_control.sql` was renamed to `0205_contest_access_control.sql`
(content unchanged). The rename makes it sort BEFORE
`020_allow_post_window_contest_review.sql`; the two are independent (one adds
the registrations table/columns, the other patches a trigger function from
016), and the clean 30-migration reset — including 021, which depends on
contest_registrations — verifies the new order. The hosted project (migrated
manually via the SQL editor) is unaffected, but review any future
`supabase db push` with this rename in mind.
