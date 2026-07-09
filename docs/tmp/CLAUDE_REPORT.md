# Claude Report — Solution PR Semantics MVP (Design Only)

## Scope of this session

This session was a **design-only** task: "Design Solution PR Semantics MVP. Do not edit files yet." No source files were created or modified. This report documents the design deliverable and the repository state at the end of the session.

## Files changed

None. No `Edit`, `Write`, or file-modifying tool calls were made in this session.

## Files read (research only)

- `components/AdminSubmissionsView.tsx`
- `components/ProblemDetailExperience.tsx`
- `lib/publish-submission.ts`
- `lib/db.ts`
- `lib/types.ts`

## Design deliverable summary

Goal: make the existing submission review flow feel like a "math Git Pull Request" flow for forked solutions, without adding new schema (building on the prior Solution Fork MVP, which stores `forkOf` provenance in `content.json.solution` and `thinking_cues.forkOf`).

### 1. Labeling fork submissions as "Fork PR" in admin review

- Add a derived helper `isForkPR(sub)` that checks `sub.content.json?.solution?.forkOf` — no new query needed since `content` is already part of the `Submission` type and loaded for every row.
- Render a "Fork PR" badge (violet, `GitBranch` icon) in the submission list card badge row, alongside the existing status badge and scope label (`普通投稿` / `比赛投稿`).
- The existing read-only "Fork 来源" banner in the review modal (already implemented in a prior cycle) needs no change.
- Optional: extend `scopeFilter` state with a `'fork'` option (not required for MVP).

### 2. Framing publish/approve as "merge" without changing status values

- No changes to `SubmissionStatus` (`pending | approved | rejected | needs_revision`).
- Purely conditional copy changes at 4 call sites, branched on `isForkPR(sub)`:
  - "保存并通过" → "保存并批准合并"
  - "发布到题库" → "合并到题库"
  - Success message "审核通过，已发布到题库。" → "Fork PR 已合并到题库。"
  - Status badge gets a small merge icon when `isForkPR` is true (copy-only, same badge)
- Reject / needs-revision paths keep existing labels for MVP; "close" / "request changes" framing deferred.

### 3. Published solution card fork provenance

- `SolutionCompareCard` in `ProblemDetailExperience.tsx` gets a new badge chip: "Fork of {title}", rendered only when `solution.thinkingCues?.forkOf` exists.
- Placed in the same badges row as existing `contestType` / `isPostContest` tags.
- Optional stretch: make the chip a same-page anchor (`href="#{forkOf.solutionId}"`) to the source solution's card.

### 4. Solution type change needed

- **Yes** — add optional `forkOf` field to `ThinkingCues` in `lib/types.ts`:
  ```ts
  export interface ThinkingCues {
    observations: string[];
    keySignals: string[];
    reasoning: string;
    suggestedMethods: string[];
    confidence?: number;
    forkOf?: {
      solutionId: string;
      solutionTitle: string;
      solutionAuthor: string;
    };
  }
  ```
- This is additive/optional — no migration, no mapper change. The data already flows into `thinking_cues` JSONB via `publish-submission.ts` and is already cast through `toSolution` in `lib/db.ts`; this only adds proper typing so `solution.thinkingCues.forkOf` type-checks without an unsafe cast.

### 5. Implementation plan (no migration)

- **Cycle A** — Admin labeling: `isForkPR` helper, "Fork PR" badge, 4 copy branches for merge framing.
- **Cycle B** — Type + display: `ThinkingCues.forkOf` type addition, fork provenance chip on `SolutionCompareCard`, optional anchor link.
- **Cycle C** (optional) — `scopeFilter` fork option, "request changes"/"close" language, fork-count badge on problem list cards.

### 6. Explicitly out of scope for this MVP

- Git-style line-level diff in admin (already covered publicly by `SolutionDiffPanel`)
- New `submission_type` or new status enum value
- Merge conflict detection between fork and edited source
- Multi-parent fork chains
- Auto-closing/superseding older forks of the same source
- `fork_of_solution_id` dedicated column + FK constraint

## Validation results

Not applicable — no code was changed in this session, so `npm run lint` / `npm run build` were not run as part of this task.

## Git status (end of session)

```
On branch main
Your branch is up to date with 'origin/main'.

Changes not staged for commit:
  modified:   api/cas_service.py

Untracked files:
  audit-tj09-desktop.png
  tests/
```

These three items are pre-existing and unrelated to this session; they were not touched.

Most recent commits on `main`:

```
6d4fa37 Add solution fork submission flow
ac2d7fe Add solution diff comparison panel
b5336b4 Improve Proof Graph editor problem filtering
0824619 Add navigation entry points for Proof Graph
d4789e3 Proof Graph Editor MVP (#6)
```

## Next step

Awaiting approval to implement Cycle A (admin labeling) and/or Cycle B (type + display) of the Solution PR Semantics MVP described above.
