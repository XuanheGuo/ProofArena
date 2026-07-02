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

ProofArena is a **pure static Next.js App Router** app with no backend, no database, and no auth. All data lives in `data/problems.ts`. Pages are statically generated at build time.

**Data flow:**

```
data/problems.ts  →  lib/types.ts (type contracts)
                  →  app/problems/page.tsx (list, server component)
                  →  app/problems/[id]/page.tsx (detail, generateStaticParams)
                  →  components/ (rendering)
```

**Key data layer exports** (`data/problems.ts`): `problems`, `getProblem`, `getAverageScore`, `getSolutionAverage`, `getBestSolution`, `getLearningIndex`.

**Solution kinds** (`lib/solution-kinds.ts`): `standard` | `insight` | `robust` | `teaching` — maps to badge labels and colors.

## Routing

| Route | Component |
|---|---|
| `/` | `app/page.tsx` — homepage with featured problems |
| `/problems` | server page + `ProblemExplorer` (client, handles search/filter) |
| `/problems/[id]` | detail page with `SolutionCard`, `MathVisualization`, `VerificationPanel` |
| `/library` | knowledge/insight library |
| `/submit` | static submission instructions |

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

`next.config.ts` uses `output: "standalone"`. Production startup:

```bash
npm run build
HOSTNAME=127.0.0.1 PORT=3000 node .next/standalone/server.js
```

OpenResty/Nginx reverse proxies to that Node process. See `docs/OPENRESTY_NODE_DEPLOY.md` for full deploy guide.
