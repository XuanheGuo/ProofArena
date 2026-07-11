# ProofArena Remotion Promo

This folder contains the first Remotion version of the ProofArena promo film.

## Run

```bash
npm install
npm run dev
```

Render:

```bash
npm run render
```

## Composition

- `ProofArenaPromo60`
- 1920 x 1080
- 30 fps
- 60 seconds

## Structure

- `src/scenes/` holds the five film chapters.
- `src/components/` holds reusable visual elements.
- `src/data/` holds copy, formulas, and mock ProofArena content.
- `src/styles/theme.ts` centralizes visual tokens and timing.

The product-demo section is intentionally a cinematic reenactment of the ProofArena UI instead of a raw screen recording. It can later be replaced with real Playwright screenshots.
