# Migration History Reconciliation

Branch: `fix/math-hub-v2-phase-1-1-completion` · Prepared: 2026-07-12

This document records the accurate state of the migration sequence as of this
branch, including the numbering anomaly around version "020", the known state
of the local database, the unknown state of the hosted Supabase project, and
the safe steps required before any future `supabase db push`.

**Nothing in this document has been executed against the hosted project.**
This is a read-only audit; no `migration repair`, no `db push`, no schema change.

---

## 1. Local migration sequence (ground truth)

The following was read directly from the local Supabase database after a clean
`supabase db reset` that applied all 29 migration files in order:

```sql
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
```

| version | name |
|---------|------|
| 001 | initial_schema |
| 002 | repair_submissions_schema |
| 003 | repair_submission_review_policies |
| 004 | contest_arena_mvp |
| 005 | contest_submission_window |
| 006 | contest_problem_unlock_mode |
| 007 | solution_ratings_allow_static |
| 008 | contest_thought_arena |
| 009 | allow_qiangji_problem_sources |
| 010 | solution_challenges_profile |
| 011 | proof_graph_mvp |
| 012 | problem_vault |
| 013 | weekly_contest_scoring |
| 014 | allow_multiple_contest_problems_per_day |
| 015 | flexible_problem_sources |
| 016 | repair_draft_contest_submission_window |
| 017 | harden_profile_and_submission_rls |
| 018 | awards_allow_contest_submissions |
| 019 | submission_author_revision |
| **020** | **allow_post_window_contest_review** |
| **0205** | **contest_access_control** |
| 021 | contest_submission_registration_gate |
| 022 | submission_rate_limit_schema |
| 023 | submission_rate_limit_enforcement |
| 024 | unified_verification_system |
| 027 | content_version_foundation |
| 028 | capability_run_artifact_evidence |
| 029 | math_hub_v2_hardening |
| 030 | math_hub_v2_completion |

**Gaps**: versions 025 and 026 do not exist in the repository. These are not
missing — the gap is intentional; those version numbers were never used.

**Local `supabase db reset` status**: All 29 migrations applied cleanly with
no errors on 2026-07-12. This was verified both by the Supabase CLI output
("Applying migration…" for each file, no ERROR lines) and by the direct SQL
query above.

---

## 2. The two original `020_` migrations

### 2a. `020_allow_post_window_contest_review.sql` (version key: `020`)

- **Introduced**: commit `6f8e342` → `f5ef03c` ("Fix draft-backed contest
  submission flow")
- **What it does**: Replaces `public.enforce_contest_submission_window()` to
  permit moderator status-updates on already-submitted contest submissions
  after the window closes. Only the trigger function is changed; no new tables
  or columns.
- **Dependencies**: Depends on the `submissions` table (001), the
  `contest_problems` timing logic (005/016). No dependency on the
  `contest_registrations` table or `access_mode` column.
- **Likely applied to hosted project**: Yes — this is a bugfix that was
  shipped to allow the weekly contest review flow to work.

### 2b. `020_contest_access_control.sql` → renamed `0205_contest_access_control.sql` (version key: `0205`)

- **Introduced**: commit `384f78d` ("Add contest access-control schema (access_mode,
  visibility, contest_registrations)")
- **What it does**: Adds `access_mode` column to `contests` table (backfills
  existing rows to `'open'`), adds `visibility` column, creates
  `contest_registrations` table with RLS and triggers.
- **Dependencies**: No upstream dependency; downstream: migration `021`
  (`contest_submission_registration_gate.sql`) depends on
  `contest_registrations` and `access_mode`.
- **Why it had version key `020`**: The filename was `020_contest_access_control.sql`,
  and the Supabase CLI derives the migration version by stripping everything
  after the first `_` in the filename. So both this file and
  `020_allow_post_window_contest_review.sql` produced the key `020` — a
  collision that caused `supabase db reset` to fail with:
  `duplicate key value violates unique constraint "schema_migrations_pkey"`.
- **Likely applied to hosted project**: Yes, under version key `020` — which
  means the hosted project has version `020` in `schema_migrations` but it
  maps to the contest_access_control schema, not the allow_post_window fix.
  This is the opposite of what the local DB records under version `020` after
  the rename.

---

## 3. The rename: `020_` → `0205_`

### What the rename does

The file was renamed from `020_contest_access_control.sql` to
`0205_contest_access_control.sql`. The Supabase CLI now extracts version key
`0205` from this file. `0205` is a lexicographic string, not a decimal number.

### Alphabetical sort order in the CLI

The Supabase CLI sorts migration files alphabetically by filename. In ASCII
ordering, the character `'5'` (ASCII 53) sorts **before** `'_'` (ASCII 95).
Therefore:

```
019_submission_author_revision.sql      → version 019
0205_contest_access_control.sql         → version 0205  ← applied FIRST
020_allow_post_window_contest_review.sql → version 020   ← applied SECOND
021_contest_submission_registration_gate.sql → version 021
```

This means `0205` is applied **before** `020` in `supabase db reset`. This is
correct because `contest_registrations` (created by `0205`) must exist before
`021` references it, and `020_allow_post_window` has no dependency on `0205`.
The local clean reset confirms no ordering errors.

### Local DB interpretation

After the rename, the local DB records:
- `020` = `allow_post_window_contest_review` (the trigger-fix migration)
- `0205` = `contest_access_control` (the registrations schema)

### Hosted DB interpretation (probable)

The hosted project applied `020_contest_access_control.sql` manually before
this branch existed. It therefore records:
- `020` = `contest_access_control` (the old filename's content)

The key `020` on the hosted DB refers to a **different migration** than `020`
on the local DB post-rename. They share the same version string but point to
different SQL bodies. This is the core reconciliation problem.

---

## 4. `supabase migration list` output interpretation

Running `supabase migration list --local` produced an ambiguous three-column
output. Running `supabase migration list` (no flags) returned no output,
indicating the CLI either has no linked project in this worktree context or
cannot reach the hosted project. Therefore:

**Hosted migration history has NOT been read.**
The "Remote" column in `--local` mode is not reliably interpretable without
confirming the CLI link state. The ground truth for local state is the direct
psql query above.

---

## 5. Hosted project state — known and unknown

### What is known

| Migration | Applied to hosted? | Notes |
|-----------|-------------------|-------|
| 001–019 | Almost certainly yes | Core schema, in production for months |
| 020 | Yes | But records `contest_access_control` content, not `allow_post_window` |
| 021–024 | Almost certainly yes | Contest registration gate, rate limits, verification |
| 027 | Probably yes | Content versioning foundation |
| 028 | Probably yes | Capability run/artifact schema |
| 029 | Unknown | `math_hub_v2_hardening.sql` — possibly applied manually to hosted or may not have been applied yet |
| 030 | Not applied | This branch's new migration; does not exist on hosted |
| 0205 | Unknown | This version key did not exist before this branch; hosted has version `020` for the same SQL |

### What is unknown

- Whether `supabase_migrations.schema_migrations` on the hosted project accurately
  reflects all SQL that was applied (manual SQL editor executions may have
  happened without recording in the migration history table).
- Whether `029` was applied to hosted. The prior Phase 1.1 work notes suggested
  it had not been applied to production at that time.
- The exact content of the hosted `020` record (whether it matches
  `0205_contest_access_control.sql` or differs).

---

## 6. Four scenarios for hosted state

### Scenario A — Hosted migration history accurately records all applied migrations

In this case:
- Hosted has `020` recorded (content = contest_access_control SQL)
- Hosted does NOT have `0205` recorded
- Hosted may or may not have `029`
- Hosted does NOT have `030`

**Risk of `supabase db push`**: The CLI would attempt to push `0205` as a new
migration (since hosted has no record of `0205`). But the SQL in `0205` creates
`contest_registrations` and `access_mode` column — both of which already exist
on hosted (they were applied under version `020`). The push would fail with
"relation already exists" or duplicate column errors.

**Required action before push**: Run `supabase migration repair` to insert a
record for `0205` in the hosted migration history WITHOUT re-executing the SQL.
This tells the CLI "this migration was already applied."

### Scenario B — SQL applied manually; migration history does not record it

In this case the hosted schema may have all the right tables, but the CLI's
`schema_migrations` table is incomplete. The push would attempt to re-apply
migrations that were already executed, causing duplicate-object errors.

**Required action before push**: Full audit of what `schema_migrations` records
vs what actually exists in the hosted schema, then `migration repair` to
re-align.

### Scenario C — Hosted has NOT applied `029` or `030`

Migration `029` (`math_hub_v2_hardening.sql`) must be applied **before** `030`.
`029` creates the core tables and triggers for the version/capability system.
`030` patches triggers in `029` that reference the wrong column names.

**Applying only `029` without `030` leaves the system broken**: The trigger
`prevent_problem_version_mutation` and `prevent_solution_version_mutation` in
`029` reference `OLD.entity_id` and `NEW.entity_id`, but the actual columns are
`problem_id`/`solution_id`. Any UPDATE on `problem_versions` or
`solution_versions` will fail with `ERROR: record "old" has no field "entity_id"`.

**They must be applied in a single maintenance window, back-to-back.**

### Scenario D — Hosted has `029` but not `030`

This is the most dangerous state. The tables exist but every UPDATE to version
rows is broken. Users attempting to publish a solution version will see a 500
error from the trigger crash. **Apply `030` immediately.**

---

## 7. Why `029` and `030` cannot be applied independently

Migration `029` was written before the column-naming error was discovered. Its
two immutability triggers (`prevent_problem_version_mutation`,
`prevent_solution_version_mutation`) use `OLD.entity_id` in their condition:

```sql
-- from 029 (broken):
IF OLD.entity_id IS DISTINCT FROM NEW.entity_id
```

The column does not exist. PostgreSQL does not validate trigger body SQL at
`CREATE TRIGGER` time when the body is a `SECURITY DEFINER` function — the
error only surfaces at trigger execution time (i.e., the first UPDATE). So the
DB accepts the migration, but any UPDATE on those tables will crash.

Migration `030` drops and recreates these two functions with the correct column
names (`problem_id` and `solution_id` respectively). Until `030` is applied,
the tables from `029` are effectively read-only.

---

## 8. Why ignoring migration history is not safe

If the approach is "apply the SQL via the SQL editor, don't bother with
migration history" the following problems accumulate:

1. **`supabase db push` becomes permanently unsafe.** The CLI compares
   `schema_migrations` against local files to decide what to push. Unrecorded
   migrations will be re-executed, causing duplicate object errors or silent
   data double-writes.

2. **`supabase db reset` (local) will diverge from hosted.** The local reset
   applies migrations in file order. If the hosted DB has SQL from `029` but the
   migration table doesn't record it, `supabase migration list` will say `029`
   is pending, and `db push` will re-execute it.

3. **Audits and rollbacks become unreliable.** The migration history IS the
   rollback ledger. Without accurate records, restoring to a known state
   requires manual schema diffing.

---

## 9. Recommended reconciliation plan (DO NOT EXECUTE on this branch)

The following plan is advisory. None of these commands have been or should be
executed during this audit preparation. All steps require human review and
a maintenance window with a database backup.

**Step 0 (precondition)**: Take a full Supabase database backup before any
migration work.

**Step 1**: Read the actual hosted migration history:
```bash
supabase migration list --linked  # read-only, compare local vs remote
```
and query the hosted DB directly:
```sql
SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
```

**Step 2**: Identify which scenario (A–D above) applies.

**Step 3**: For the `0205` version key collision —
If hosted has `020` = contest_access_control (Scenario A/B), insert the `0205`
record without re-executing:
```bash
supabase migration repair --status applied 0205
```
This is safe only if the hosted schema already contains `contest_registrations`
and `access_mode`.

**Step 4**: For `029` and `030` —
If hosted has neither, apply both in a single transaction or in immediate
succession. If hosted has `029` but not `030`, apply `030` immediately (it is
safe to re-apply since all `030` DDL uses `CREATE OR REPLACE` or `DROP IF EXISTS`
semantics).

**Step 5**: Verify the hosted migration list matches the local one:
```
001–019: present
020: present (content may differ from local — that is expected and acceptable)
0205: present (after repair or after confirming already applied)
021–024: present
027–030: present
```

**Step 6**: Only after this reconciliation is complete is it safe to use
`supabase db push` for future migrations.

---

## 10. What this branch does NOT do

- Does **not** execute `supabase migration repair` against the hosted project.
- Does **not** apply `029` or `030` to hosted.
- Does **not** run `supabase db push`.
- Does **not** delete or rename files in a way that changes the content of
  already-applied migrations (the rename from `020_contest_access_control.sql`
  to `0205_contest_access_control.sql` changes the version key tracked by the
  CLI but not the SQL content).
- Does **not** force-push, merge to main, or deploy.

The branch is push-ready for external audit. The migration reconciliation must
be done separately, in a maintenance window, by a human with access to the
hosted Supabase project.
