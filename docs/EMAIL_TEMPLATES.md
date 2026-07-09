# Supabase Auth Email Templates

Branded HTML templates for the six Supabase Auth email types, matching the
site's dark header / indigo accent (`--accent: #4f46e5`) and Chinese copy
voice. Source files live in `supabase/templates/`.

| File | Supabase template | Sent when |
|---|---|---|
| `confirmation.html` | Confirm signup | `supabase.auth.signUp()` — verifies a new account (`app/auth/signup/page.tsx`) |
| `recovery.html` | Reset Password | `supabase.auth.resetPasswordForEmail()` |
| `magic_link.html` | Magic Link | `supabase.auth.signInWithOtp()` |
| `email_change.html` | Change Email Address | `supabase.auth.updateUser({ email })` |
| `invite.html` | Invite user | `supabase.auth.admin.inviteUserByEmail()` (not currently wired into the app, included for completeness) |
| `reauthentication.html` | Reauthentication | `supabase.auth.reauthenticate()` — 6-digit code, not a link |

All link-based templates point at `{{ .ConfirmationURL }}`, which Supabase
builds from the project's **Site URL** / **Redirect URLs** config plus
`/auth/callback` — the route that already does `exchangeCodeForSession`
(`app/auth/callback/route.ts`). No app code changes are needed for these to
work; only Site URL/Redirect URLs need to be set correctly per environment.

## Applying the templates

Supabase Auth email templates are dashboard/project config, not something
`db push` deploys. For each project (staging/prod):

1. Open **Authentication → Emails → Templates** in the Supabase dashboard.
2. For each of the 6 types below, paste the matching HTML file's contents
   into the **Message body** and set the **Subject heading**.
3. Save. Optionally send a test email from the same screen to sanity-check
   rendering.

| Template | Subject heading |
|---|---|
| Confirm signup | `验证你的邮箱 · ProofArena` |
| Reset Password | `重置密码 · ProofArena` |
| Magic Link | `登录 ProofArena` |
| Change Email Address | `确认邮箱变更 · ProofArena` |
| Invite user | `邀请你加入 ProofArena` |
| Reauthentication | `安全验证码 · ProofArena` |

If the project ever adopts `supabase link` + CLI-managed config, these same
files can be wired up via `supabase/config.toml`:

```toml
[auth.email.template.confirmation]
subject = "验证你的邮箱 · ProofArena"
content_path = "./supabase/templates/confirmation.html"
```

(repeat per type — `recovery`, `magic_link`, `email_change`, `invite`,
`reauthentication`). No `config.toml` exists in this repo yet, so this repo
does not do that today; the dashboard is the source of truth.

## Design notes

- Table-based layout with inline styles only, for Outlook/Gmail/Apple Mail
  compatibility — no external CSS, no `border-radius` reliance for legibility
  (degrades gracefully to square corners in clients that ignore it).
- Fixed light background (`#f4f5f7` card on `#ffffff`, `#111827` text) rather
  than following the site's `data-theme` dark/light toggle — most mail
  clients don't reliably honor `prefers-color-scheme` in transactional mail,
  and a light card is the safer default for readability.
- Header bar (`#111318`) + indigo "PA" mark echoes `SiteHeader`'s dark nav
  and the `--accent` token (`#4f46e5`), without depending on an image asset
  (some clients block remote images by default, so the mark is a styled
  `<td>`, not a logo `<img>`).
- Every link template includes both a CTA button and the raw URL as plain
  text, for clients that strip button styling or block links.
- Copy mirrors the existing auth pages' tone (`app/auth/login/page.tsx`,
  `app/auth/signup/page.tsx`) — direct, short, no marketing filler — plus the
  homepage tagline "同一道题，多种解法，正面交锋。" in the footer for brand
  consistency.

## Also worth checking

- Supabase's built-in email sender is rate-limited (a handful of emails per
  hour) and sends from a `supabase.io` address. For a production project,
  configure **custom SMTP** under **Project Settings → Auth → SMTP Settings**
  so confirmation/reset emails are reliable and come from a ProofArena
  domain.
- **Site URL** and **Redirect URLs** (Authentication → URL Configuration)
  must include the deployed origin(s) — otherwise `{{ .ConfirmationURL }}`
  will point at the wrong host and `/auth/callback` will 404 or redirect
  somewhere unexpected.
