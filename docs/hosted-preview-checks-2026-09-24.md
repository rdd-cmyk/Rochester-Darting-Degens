# Hosted preview follow-up — 2026-09-24

Project: `hrqsbzmsfichiimtxijj` (RDD Main Project). Branch:
`advanced-statistics`. This record continues the hosted checks following
commit `95d4503`; no database migration or league match write is part of it.

## Current evidence

- The user created, verified and signed in with a designated test account on
  the Vercel preview. The app exposed hosted matches, statistics and the
  account's own profile. The signed-out matches page denied the normal UI.
  This is browser behavior, not a server-side authorization proof.
- Supabase's production Auth Site URL is `https://rocdartdegens.com`.
  The Auth redirect allowlist contains `http://localhost:3000`, production
  root, and production `/reset-password`; it does not contain the preview.
  The earlier recovery email pointed at production because the old client
  explicitly requested the production origin. The missing preview redirect
  is a separate obstacle to the corrected flow. The reset email template uses
  `{{ .ConfirmationURL }}`, rather than a hard-coded production link. A
  recovery link is credential-bearing and should not be copied into diagnostics.
- The Supabase organization has a Vercel connection to the
  `rochester-darting-degens` project. Its project connection syncs production
  Supabase credentials to Vercel Production only; Preview and Development
  sync are off. The Supabase organization and project integration views show
  no connected GitHub repository. These settings do not explain how the
  existing preview received its current environment values.
- The hosted policy page shows RLS enabled for `profiles`, `matches` and
  `match_players`. Policy presence alone does not test row-level behavior.
- The current Vercel account can open the protected preview, but its
  deployment dashboard returns 404. The account cannot confirm Analytics or
  Speed Insights dashboard receipt for the owner's project.

## Source correction

`app/auth/page.tsx` now requests recovery back to the current browser origin's
`/reset-password` page. This makes the requested redirect match the deployment
where the user started recovery, including the preview. The component test
uses a preview-like HTTPS origin and reproduced the former production redirect
with `NEXT_PUBLIC_SITE_URL` set to production, then passed after the correction.

Trusted clean install passed with zero audit findings. `npm test` and coverage
passed 167 tests in 18 files; statistics coverage remained 100% lines and
functions. Lint and typecheck passed. The optimized `npm run build` passed
with process-only synthetic localhost settings because the guarded local
Supabase stack was unavailable. No `.env` file was modified.

## Hosted completion sequence

1. Push the reviewed source correction and confirm CI plus the exact new
   Vercel Preview deployment. The preview URL changes with a new deployment.
2. Add only that new preview's `/reset-password` URL to Supabase Auth's
   Additional Redirect URLs. Review the security implication before saving:
   a recovery session may be delivered to this Vercel preview origin. Keep
   the production Site URL and existing redirects unchanged.
3. Request a fresh recovery email from the new preview. The test account owner
   opens it and enters the replacement password privately. Verify the host
   and final app state without recording the token or email link.
4. Review current hosted schema and policies against the recorded baseline.
   Test server-side permissions with a disposable, authorized fixture or a
   rollback-safe read-only query. UI controls alone are not evidence of RLS.
5. Inspect Vercel Analytics and Speed Insights enablement, filtered preview
   events and dashboard receipt. Supabase's Vercel integration does not
   provide evidence of those Vercel products.

Production schema and migration gates in
`docs/advanced-statistics-roadmap.md` remain separate.
