# ProofArena Maintainability Notes

This project has grown quickly, so the main maintenance risk is not one bad
component. It is repeated inline UI classes, very large feature components, and
mixed data/UI concerns. Use this note as the first cleanup contract.

## UI Layer

Prefer the shared UI primitives in `components/ui` before writing raw visual
class strings:

- `Panel` / `SectionPanel`: bordered reading surfaces, cards, notices, empty
  states, and admin/contest modules.
- `Button` / `ButtonLink`: clickable commands and CTA links.
- `Badge`: status labels, phase labels, difficulty chips, and compact metadata.
- `cn`: compose conditional class names without template-string clutter.

Raw Tailwind is still fine for layout, typography, and one-off spacing. Avoid
repeating long strings such as `border border-white/10 bg-zinc-950 ...` in new
code; wrap that in a primitive or add a variant to an existing primitive.

## Feature Components

Large feature files should be split when they cross one of these thresholds:

- More than one data workflow, such as fetching plus mutation plus rendering.
- More than three reusable visual states, such as empty/loading/error/success.
- More than about 400 lines, unless the file is mostly static content.

Suggested split pattern:

- `components/<FeatureName>/index.tsx`: public entry component.
- `components/<FeatureName>/<FeatureName>Card.tsx`: repeated cards or rows.
- `components/<FeatureName>/<FeatureName>Form.tsx`: mutation forms.
- `components/<FeatureName>/meta.ts`: status labels, badge tone maps, and copy.
- `lib/<feature>.ts`: server data access and pure business helpers.

Do not mix database access, form submission, and table/card rendering in the
same component when adding new functionality.

## API And Data

For new APIs:

- Keep route handlers thin: validate input, call a `lib/*` helper, return a
  typed response.
- Keep Supabase queries in `lib/*` helpers so pages and components do not learn
  table details.
- Put status-to-copy/status-to-style maps in `lib/*-meta.ts` or a feature
  `meta.ts`, not inline in JSX.
- Prefer pure functions for contest/submission scoring rules, and cover them
  with focused tests before wiring them into UI.

## UI QA Checklist

Before finishing a UI change:

- Run `npm run lint`.
- Check mobile width for horizontal overflow.
- Check the page for console errors after a fresh reload.
- Scan for raw square controls when changing visual primitives.
- Confirm loading, empty, error, and success states still have coherent layout.

## Current Cleanup Priorities

1. Move more existing surfaces to `components/ui`.
2. Split `AdminSubmissionsView.tsx`, `AdminContestsView.tsx`, and `SubmitForm.tsx`
   into feature folders.
3. Extract contest detail sub-sections from `app/contests/[slug]/page.tsx`.
4. Add focused tests around contest scoring, submission publishing, and access
   control before extending those flows.

## Cleanup Progress

- `components/ui` now owns the first shared primitives: panel, badge, button,
  and basic text fields.
- `components/admin-submissions/model.ts` owns submission review data shapes,
  form conversion, markdown generation, score normalization, and scope-key
  helpers.
- `components/admin-submissions/ReviewPreviews.tsx` owns admin submission
  preview surfaces: contest review preview, standard-answer hint, and reviewed
  solution card preview.
- `AdminSubmissionsView.tsx` and `AdminContestsView.tsx` have started using the
  shared field components instead of local duplicated `TextField` / `TextArea`
  definitions.

Next safe extraction: move `GraphDraftSection` and the admin submission list
row/card rendering into `components/admin-submissions/*` files. Keep Supabase
mutations in `AdminSubmissionsView.tsx` until the presentation layer is thinner.
