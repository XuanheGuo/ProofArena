# Unified Mathematical Verification

ProofArena's verification subsystem is a modular monolith inside the Next.js deployment. Product code submits a generic verification task; it never calls or parses AXLE directly.

```text
API / UI -> VerificationService -> LeanEngine -> AxleProvider -> AXLE
                         |-> VerificationRepository -> Supabase
```

An **engine** is a kind of mathematical verification (`lean`, later `cas`, `numerical`, `z3`). A **provider** executes an engine (`axle`, later `kimina`). Task lifecycle status (`queued`, `running`, `completed`, `failed`, `cancelled`) is deliberately separate from the verdict (`accepted`, `rejected`, `invalid_request`, `timeout`, `rate_limited`, `resource_limit`, `provider_error`, `cancelled`). A normal proof failure is `completed/rejected`; an AXLE outage is `failed/provider_error`.

## Setup

1. Create an AXLE API key using the AXLE account/playground linked from the [official AXLE documentation](https://axle.axiommath.ai/v1/docs/).
2. Apply all Supabase migrations through `supabase/migrations/024_unified_verification_system.sql`. The rollback is: drop `public_verification_summaries`, drop `verification_tasks`, drop `touch_verification_task_updated_at`, and drop the three `problems.lean_statement*` columns after confirming they contain no needed data.
3. Configure `.env.local`:

   ```dotenv
   LEAN_VERIFICATION_ENABLED=false
   LEAN_VERIFICATION_PROVIDER=axle
   AXLE_API_KEY=your-server-only-key
   AXLE_BASE_URL=https://axle.axiommath.ai
   AXLE_ENVIRONMENT=lean-4.28.0
   AXLE_TIMEOUT_SECONDS=120
   ```

4. Start with the flag disabled, run `npm test`, `npm run lint`, and `npm run build:webpack`, then set `LEAN_VERIFICATION_ENABLED=true`.

For Vercel, add the same values in Project Settings → Environment Variables. `AXLE_API_KEY` must never have a `NEXT_PUBLIC_` prefix. Redeploy after changing build-time feature flag values. To disable new work immediately, set `LEAN_VERIFICATION_ENABLED=false`; existing history remains readable.

`AXLE_ENVIRONMENT` is the server allowlist. A comma-separated value permits multiple environments and uses the first as default. Browser requests cannot select a Provider or environment.

## AXLE mapping

The full-file MVP uses `POST {AXLE_BASE_URL}/api/v1/check` with `Authorization: Bearer ...` and this body:

```json
{
  "content": "import Mathlib\n...",
  "environment": "lean-4.28.0",
  "mathlib_options": false,
  "ignore_imports": true,
  "timeout_seconds": 120
}
```

The adapter reads only documented fields: `okay`, `lean_messages`, `tool_messages`, `failed_declarations`, `timings.total_ms`, and optional `request_id`. It validates untrusted JSON defensively and does not persist the complete raw response. HTTP 400/422 maps to `invalid_request`, 429 to `rate_limited`, 401/403/5xx and malformed responses to `provider_error`, and AbortController expiry to `timeout`. Provider authentication details are stored only as an admin-visible, sanitized code. A response with `okay:true` but missing or malformed `lean_messages`/`tool_messages`/`failed_declarations` is treated as an incomplete/malformed response (`provider_error`), never as an implicit pass — "field absent" is never conflated with "field present and empty."

`ignore_imports` is always sent as `true` and is not user-configurable. Per AXLE's documented behavior, this means any `import ...` lines in the submitted source are **superseded**, not executed: AXLE substitutes its own prebuilt environment cache tied to the `environment` value instead of resolving the user's own imports. The submitted source is still sent verbatim (including any import lines) for readability/auditing, but those lines have no effect on what actually gets checked. The verification workspace UI discloses this next to the source editor.

`accepted` requires all of:

- AXLE `okay === true`;
- no normalized Lean or tool errors;
- `failed_declarations` is empty;
- ProofArena's precheck found no executable `sorry`, `admit`, `axiom`, or `unsafe` token;
- the task reached `completed`, has `verdict=accepted`, and `valid=true`.

HTTP 200 or `okay=true` alone never produces a Lean Verified badge. The precheck removes comments and literals before scanning, but it is explicitly quick feedback rather than a Lean parser or security boundary.

## API and manual acceptance

- `POST /api/verifications` creates a task. Authentication is derived from the Supabase session.
- `GET /api/verifications?problemId=...` lists the caller's history (admins may filter globally).
- `GET /api/verifications/:id` returns an authorized task.
- `/admin/verifications` provides recent tasks, filters, health diagnostics, and retry for timeout/provider errors.

Manual test:

1. Sign in and open a problem.
2. Select **形式化验证**.
3. Submit `import Mathlib\ntheorem example : 1 + 1 = 2 := by norm_num` and confirm `completed/accepted` plus Lean Verified.
4. Submit a theorem containing `sorry`; confirm `completed/invalid_request` and no badge.
5. Resubmit the accepted source; confirm a new history row with the cache marker.
6. Disable the flag; confirm creation is disabled while history still loads.

## Security, cache, and limits

The default source limit is 64 KiB (hard ceiling 256 KiB), timeout 120 seconds (hard ceiling 300), ten requests per ten minutes, and two concurrent tasks per user. The application-level rate checks are deliberately simple and may admit a small race across instances; the database partial unique index on active `source_hash` protects the expensive Provider call from same-content duplication.

The SHA-256 key covers normalized source, engine, provider, environment, policy version, and provider options. Accepted and rejected tasks are reusable; timeout, rate-limit, invalid-request, and provider-error results are not reused. A cache hit creates a new audit row pointing to `cache_source_id`. Stale running tasks are failed on a later create request.

RLS permits users to read only their own task rows and moderators/admins to read all rows. Public pages may read only the column-limited `public_verification_summaries` view for strict accepted results. Source snapshots, result metadata, and Provider errors are not in that view. API responses remove internal result metadata and Provider error codes for ordinary users.

## Degradation and known limits

AXLE failures affect only verification routes. Problem reading, submissions, contests, auth, and existing history do not depend on Provider availability. Phase one is synchronous from the route's perspective; an active duplicate receives the existing queued/running task and the UI polls it. There is no durable background queue, Redis lock, Lean AST policy parser, real-key CI test, or adversarial sandbox guarantee. AXLE itself documents limitations for hostile metaprogramming; do not use this MVP as a high-stakes untrusted proof judge without an isolated checker.

Fixed-statement mode is reserved by `problems.lean_statement`, `lean_statement_version`, and `lean_statement_enabled` plus the `LeanStatementBinding` domain type. It is disabled and has no ordinary-user API. A future implementation must assemble statement plus proof body on the server and bind the statement version into the source hash.

## Extension path

To add Kimina, implement `VerificationProviderAdapter<LeanVerificationRequest, VerificationResult>`, normalize its private response inside `verification/providers/kimina`, register it in the service factory, add server configuration, and extend mock contract tests. No product API, task table, or UI response shape changes are needed.

To add CAS, implement a CAS engine request/policy plus one or more Provider adapters (SymPy/Sage), register routing in `VerificationService`, and add engine-specific authorization/input policy tests. The legacy `/api/cas` helper is not yet migrated into task execution and remains separate during phase one.
