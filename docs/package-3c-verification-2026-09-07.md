# Package 3C — Supabase client/auth verification

Date: 2026-09-07. Branch: `advanced-statistics`.
Prerequisite: `fcdc052` (Package 3B).
Status: local implementation, acceptance and independent review completed.
No push, deployment or hosted Supabase mutation is part of this delivery.

## Change and compatibility

Updated `@supabase/supabase-js` from resolved 2.86.2 to exact 2.116.0, the stable
registry target checked at implementation. Its auth/functions/PostgREST/realtime/
storage clients move together to 2.116.0. Realtime now brings
`@supabase/phoenix@0.4.5`; obsolete `ws`, `@types/ws` and `@types/phoenix` entries
drop out. Node types and undici-types become development-only, without changing
versions. No other direct dependency changes; the CLI stays at its independently
pinned 2.116.0. No new dependency lifecycle scripts or approvals were needed.

The SDK's Node requirement is `>=22.0.0`, satisfied by the existing Node 24
contract. Installed/runtime-tested versions: Node 24.20.0 and npm 11.19.0.
Application auth/client calls and SQL required no edits. New MFA recovery-code,
storage and OpenAPI APIs are not enabled by this package.

Primary sources: [Supabase JS 2.116.0 release](https://github.com/supabase/supabase-js/releases/tag/v2.116.0),
[runtime policy](https://github.com/supabase/supabase-js/blob/v2.116.0/packages/core/supabase-js/README.md#support-policy),
[password recovery API](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail),
[Mailpit API](https://mailpit.axllent.org/docs/api-v1/).

## Verification

- `npm run ci:install`: passed. Lockfile generated with scripts disabled;
  trusted clean install validated exact approvals and rebuilt only unchanged
  `unrs-resolver@1.11.1`.
- `npm test`: 59 passed in 11 files.
- `npm run test:coverage`: passed. Configured statistics/match-state scope:
  100% lines/functions, 91.35% branches, 99.28% statements. This is not whole-app
  or auth coverage; real auth behavior is exercised separately below.
- `npm run lint`, `npm run typecheck`: passed.
- `npm run build:local`: fresh production build passed. This runs the ordinary
  Next build with process-only loopback Supabase settings, leaving `.env.local`
  untouched. Served that bundle with Next `start` bound to 127.0.0.1:3000,
  identical local API/anon/site settings, `RDD_LOCAL_PREVIEW=1`, and blanked
  process-only GitHub integration variables.
- `npm run test:db:local`: 25 pgTAP assertions passed, with transaction-rolled-
  back synthetic fixtures. Existing local baseline/additive schema only; no
  migration was applied for 3C.
- `npm audit --omit=dev`: zero vulnerabilities. Full audit: one moderate
  development-only `@humanfs/node@0.16.7` finding through unchanged ESLint,
  still assigned to 3E; zero high/critical. Audit results are dated evidence.
- Standard Playwright 1.62.1 with installed Chrome: **3 scenarios passed in
  13.1 seconds**, with zero recorded uncaught page errors or external browser
  request attempts. The preflight verifies core health, explicit local engine
  selection and loopback publications before obtaining local credentials.

### Browser and authenticated SDK assertions

1. Browser signup, sign-out and sign-in; match create/edit persistence after
   reload; noncreator edit exclusion and denied update/spoofed insert; anonymous
   match reads; statistics filters, minimum-sample states, desktop/mobile layout.
2. Protected profile routes, authenticated auth-page redirect, home and dynamic
   profile rendering, query-string/Suspense rendering, native image optimization,
   and unauthenticated change-log API denial.
3. Missing recovery link rejected; password reset requested through the UI;
   uniquely named synthetic mail retrieved only from local Mailpit; recovery
   link validated against the local API and exact local reset redirect before
   navigation; password changed; new password signs in and survives reload;
   old password rejected specifically with `invalid_credentials`. An ordinary
   SDK session then rotates its refresh token, verifies the user and own-profile
   read, signs out and has no remaining session; signed-out profile, match and
   participant queries return no rows. Tokens/mail bodies are not logged.

The third scenario is added in this package. Test results/screenshots are ignored
local artifacts; synthetic accounts, messages and matches are retained locally
for inspection. No service-role bypass is used for application assertions.
Browser QA uses an installed standard QA runtime, not a new repository dependency
or a homebrew runner; it is not yet integrated into CI.

Independent review compared the complete package/lockfile, auth assertions and
delivery records against `fcdc052`. One introduced test timing issue was fixed:
the password-recovery test now waits for the authenticated destination and
explicitly signs out, rather than treating the temporary `/auth` redirect as a
signed-out state. The reviewer confirmed the correction and no remaining
actionable findings. All three browser scenarios passed again in 13.1 seconds,
and lint, refreshed audits and `git diff --check` were rerun successfully
(with the documented development-only audit advisory still present).

## Remaining gates and rollback

Local Auth disables email confirmation. The existing signup UI still shows
verify-email even when local Auth issues a session. Dynamic profile server
metadata still falls back after an anonymous RLS read failure; authenticated
client profile content works. These pre-existing behaviors were not changed by
the client upgrade. Delayed automatic refresh at actual token expiry, all
browsers, hosted confirmation/recovery email delivery, hosted redirect settings,
hosted RLS execution, Linux CI and Vercel are not established by this local run.

No hosted records, policies, migration history or environment files were changed.
Local policies come from the previously reviewed hosted baseline, plus the local
additive migration; this is rehearsal, not hosted acceptance. Existing hosted
schema/history/backup/rollback gates remain in force. Packages 3D–3F have not
started. Obtain approval before push/deployment or hosted test writes.

Revert this isolated 3C commit as one unit (package, lockfile, tests and matching
delivery records), retaining prerequisite 3B. Then rerun trusted installation
and verification. No database rollback accompanies this client-only upgrade.
