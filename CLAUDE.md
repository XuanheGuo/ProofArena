# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start dev server at localhost:3000
npm run lint         # TypeScript type check (tsc --noEmit)
npm run build        # static build + postbuild standalone prep
npm run start        # production server (after build)
```

Before committing: run `npm run lint` then `npm run build`.

There is no test suite. Lint runs TypeScript only — no ESLint or test runner.

## Architecture

ProofArena is a Next.js App Router app backed by **Supabase** (Postgres + Auth + Storage). Public reads (`/`, `/problems`, `/problems/[id]`, `/contests`) go through a cookie-free client (`lib/supabase-public.ts`) so those routes stay statically cacheable/ISR (`revalidate`); anything requiring a session (submitting, admin, profile) uses the cookie-aware client in `lib/supabase-server.ts` / `lib/supabase-client.ts`. `data/problems.ts` is only a build-time fallback (`markFallbackProblem`) for when Supabase env vars are absent — it is not the source of truth. Authorization is enforced in two layers: Postgres RLS policies + `SECURITY DEFINER` triggers (`supabase/migrations/`) as the hard boundary, and `lib/require-moderator.ts` as the server-action-level check for moderator/admin-only writes (publishing submissions, promoting Problem Vault drafts, etc.).

**Data flow (public read path):**

```
Supabase (problems, solutions, contests, ...)
  →  lib/db.ts / lib/contests.ts (createPublicClient queries)
  →  lib/types.ts (type contracts)
  →  app/problems/page.tsx (list, server component, ISR)
  →  app/problems/[id]/page.tsx (detail, generateStaticParams + revalidate)
  →  components/ (rendering)
```

**Content submission/review flow:** `SubmitForm` (client) inserts into `submissions` (status starts `pending`, enforced server-side by a BEFORE INSERT trigger regardless of what the client sends) → a moderator reviews at `/admin/submissions` (`AdminSubmissionsView`) and sets `approved` / `rejected` / `needs_revision` (+ `moderator_notes`) → `approved` triggers `lib/publish-submission.ts` to insert into `problems`/`solutions`. If a submission is `needs_revision`, its author can edit and resubmit it from `/profile` (`EditSubmissionForm`) — gated by an author-only UPDATE RLS policy + trigger (`019_submission_author_revision.sql`) that forces the row back to `pending` and clears `moderator_notes`, scoped to non-contest submissions only.

**Solution kinds** (`lib/solution-kinds.ts`): `standard` | `insight` | `robust` | `teaching` — maps to badge labels and colors.

## Routing

| Route | Component |
|---|---|
| `/` | `app/page.tsx` — homepage with featured problems |
| `/problems` | server page + `ProblemExplorer` (client, handles search/filter) |
| `/problems/[id]` | detail page with `SolutionCard`, `MathVisualization`, `VerificationPanel` |
| `/library`, `/library/[id]` | knowledge/insight library |
| `/contests`, `/contests/[slug]` | contest list + detail (sprint panel, leaderboard, submissions) |
| `/submit` | `SubmitForm` — problem/solution submission, contest-aware |
| `/profile`, `/profile/[username]` | own dashboard (submissions, revision flow) / public profile |
| `/auth/login`, `/auth/signup` | Supabase Auth |
| `/admin`, `/admin/submissions`, `/admin/contests`, `/admin/problem-vault`, `/admin/proof-graph` | moderator/admin-only, gated by `lib/require-moderator.ts` |
| `/studio` | structured submission workbench for any logged-in contributor; hidden from public nav, redirects anonymous visitors to `/auth/login` |

## Theming

Three modes: `system` / `light` / `dark`. An inline script in `app/layout.tsx` sets `data-theme` before hydration to prevent flash. `ThemeToggle` handles toggling + `localStorage`. Light-mode overrides for dark utility classes are in `app/globals.css` — when adding new color classes, verify they render correctly in light mode too.

## Math & Visualization

- `MathBlock` splits strings on `$...$` and renders `InlineMath`. No block `$$...$$` support.
- In TypeScript string data, use double backslashes: `"\\frac{1}{2}"`.
- `MathVisualization` looks up a visualization by `problemId` — currently hardcoded per problem. To add a new one: add a `VisualizationSpec`, implement a draw function, and register the ID in the `hasVisualization` set in the detail page.

## Adding Content

The primary work area for content changes is `data/problems.ts`. The type contract in `lib/types.ts` defines `Problem`, `Solution`, `SolutionScores`, `Verification`, `ThinkingCues`, `LearningGuide`, and `SolutionTree`.

Scoring dimensions in `SolutionScores`: `correctness`, `examReady`, `elegance`, `calculation`, `explanation`.

## Deployment

Primary deployment target is Vercel (auto-deploys from `main`). `next.config.ts` currently does **not** set `output: "standalone"` and `scripts/prepare-standalone.mjs` is a no-op — the self-hosted OpenResty/Nginx path documented in `docs/OPENRESTY_NODE_DEPLOY.md` needs that config added back before it works again.
