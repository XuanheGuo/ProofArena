# Security Notes

Tracked findings from dependency/security audits that don't have a clean
immediate fix, plus what was actually resolved. Update this file whenever
`npm audit` turns up something new.

## Resolved

- **@supabase/auth-js insecure path routing** ([GHSA-8r88-6cj9-9fh5](https://github.com/advisories/GHSA-8r88-6cj9-9fh5))
  Fixed by upgrading `@supabase/supabase-js` to `2.110.1` and `@supabase/ssr`
  to `0.12.0` (both latest stable, non-breaking within the same major/minor
  API surface this project uses).
- **user_profiles privilege escalation via self-update** — the
  `"Users can update own profile"` RLS policy only checked
  `auth.uid() = id`, letting any authenticated user set their own `role` to
  `admin`/`moderator` or inflate `reputation` (and letting an existing
  moderator promote themselves to `admin` the same way). Fixed in
  `supabase/migrations/017_harden_profile_and_submission_rls.sql` with a
  `BEFORE UPDATE` trigger that reverts `role`/`reputation` to their stored
  value unless the actor is already `admin`, the hardcoded owner account, or
  the service-role key. Moderators cannot change `role`/`reputation` at all,
  including their own — only `admin` (or above) can.
- **submissions forged approval** — the `"Users can create submissions"`
  INSERT policy only checked `auth.uid() = user_id`, letting a client insert
  a row with `status = 'approved'` directly. Fixed in the same migration:
  the INSERT policy now requires `status = 'pending' AND moderator_notes IS
  NULL`, backed by a `BEFORE INSERT` trigger that force-resets both fields
  for non-privileged actors.

Run `npx tsx scripts/verify-security.mts` against a real Supabase project to
confirm these are enforced.

## Open

### PostCSS XSS via unescaped `</style>` in stringify output

- Advisory: [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93)
- Affected: `postcss < 8.5.10`, pinned internally by Next.js at
  `node_modules/next/node_modules/postcss` — this is Next's own bundled copy
  used by its build pipeline, not project's `@tailwindcss/postcss`/`tailwindcss`
  devDependencies.
- Checked as of this audit: every Next release from `9.3.4` up through the
  `16.3.0` canary line still bundles `postcss@8.4.31` (`npm audit`'s only
  suggested fix is to downgrade to `next@9.3.3`, which is not viable for an
  App Router project). There is currently no stable Next 16.x release that
  bundles a patched postcss.
- Decision: do **not** force-downgrade Next or pull in a canary/RC build to
  chase this fix. `npm run build:webpack` runs entirely at build time on
  trusted, first-party source — the stringify path this advisory targets
  processes attacker-controlled CSS at *runtime*, which does not apply to
  this project's static build pipeline.
- Plan: re-run `npm audit --registry=https://registry.npmjs.org` on each
  Next upgrade and pull in the first stable release that bundles
  `postcss >= 8.5.10`.
