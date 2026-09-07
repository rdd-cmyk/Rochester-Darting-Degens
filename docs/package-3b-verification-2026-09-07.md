# Package 3B — security baseline verification

Date: 2026-09-07. Branch: `advanced-statistics`.
Prerequisite: `877264a` preserves the separately approved local Supabase setup.
Status: local implementation, acceptance and independent review completed.
The isolated commit containing this record is the Package 3B rollback unit.
No push, Vercel deployment, or hosted Supabase mutation is part of this record.

## Reviewed versions

| Package | Before | After |
| --- | --- | --- |
| Next.js / eslint-config-next | 16.0.7 | 16.3.4 |
| React / React DOM | 19.2.0 | 19.2.8 |
| @types/react | 19.2.7 | 19.2.18 |
| @types/react-dom | 19.2.3 | 19.2.7 |
| Next's PostCSS | 8.4.31 | 8.5.23 |
| Next's Sharp | 0.34.5 | 0.35.4 |

Exact stable registry versions, engines and peers were checked. Next and React
remain on their existing major lines. No codemod or opt-in Cache Components,
React Compiler, or application refactor was required. Lockfile changes also
include their platform binaries/native dependencies and ESLint helper updates;
all other direct dependency versions remain unchanged.

Sources reviewed: [Next security release](https://nextjs.org/blog/august-2026-security-release),
[Next 16.3.4 release](https://github.com/vercel/next.js/releases/tag/v16.3.4),
[Next 16 migration guide](https://nextjs.org/docs/app/guides/upgrading/version-16),
[React 19.2.8 release](https://github.com/react/react/releases/tag/v19.2.8).
Next 16.3.4 is the patched follow-up that restores AVIF optimization; the
application's default image configuration was not changed to opt into AVIF.

## Installation and security

Resolved the lockfile and installed with lifecycle scripts disabled before
inspecting new metadata. Sharp 0.35.4 has no preinstall/install/postinstall hook;
removed only its obsolete exact approval and rebuild target. The unchanged
`unrs-resolver@1.11.1` postinstall remains the sole explicitly approved/rebuilt
hook. `npm run ci:install` passed through the existing npm 11.19.0 bootstrap and
the fail-closed install-script check. No broad script approval or audit override.

- `npm audit --omit=dev`: **0 vulnerabilities**, down from 3 high.
- Full `npm audit`: **1 moderate**, 0 high/critical. The remaining
  [humanfs symlink-copy advisory](https://github.com/advisories/GHSA-p498-v437-472g)
  affects development-only `@humanfs/node@0.16.7` via unchanged ESLint 9.39.1;
  explicitly tracked for 3E rather than expanding 3B.
- Node 24.20.0/npm 11.19.0 contract unchanged. Sharp native loading and image
  optimization were exercised on this Windows host; Linux/Vercel execution is
  still a remote delivery gate, not inferred from Windows success. Sharp's
  Linux x64 binary requires x86-64-v2; verify the actual deployment platform.

## Executable acceptance

- `npm test`: 59 passed in 11 files.
- `npm run test:coverage`: passed; configured statistics/match-state scope has
  100% lines/functions, 91.35% branches, 99.28% statements.
- `npm run lint`, `npm run typecheck`: passed.
- `npm run build:local`: fresh optimized production build passed. This runs
  the ordinary Next build with loopback Supabase environment overrides; existing
  `.env.local` remains untouched.
- Served that exact fresh production bundle using Next `start`, bound to
  127.0.0.1:3000 with the same local API/anon/site variables and
  `RDD_LOCAL_PREVIEW=1`; GitHub integration credentials blanked in process only.
  Do not reuse an arbitrary old production bundle for local QA: public URLs
  are embedded at build time.
- Standard Playwright 1.62.1 + installed Chrome: **2 scenarios passed in 9.6s**.
  The first exercises signup/session restoration/sign-out/sign-in, match create/
  edit persistence, denied noncreator/anonymous access, and 1440px/390px stats
  filtering and layout. The second covers protected profiles, authenticated
  auth-route redirect, home/logo rendering, WebP image-optimizer response,
  dynamic profile rendering, query-string/Suspense rendering, and unauthenticated
  `/api/change-log` returning 401. No uncaught page errors or external browser
  request attempts in the passing run.

Screenshots are ignored artifacts under `test-results/`. These tests retain
synthetic local records, never production league data. Dynamic profile metadata
still logs the pre-existing anonymous RLS read failure and uses its fallback
title; client profile content loads after auth. That behavior was not silently
changed in a framework upgrade.

Independent review compared the full package/lockfile/native-install policy,
framework boundaries, browser assertions and documentation against prerequisite
877264a. No actionable findings remained. `git diff --check` passed.

## Boundaries and rollback

The app/SQL implementation from the prerequisite is unchanged; only package
selection, its required installation contract, browser coverage and delivery
documentation change here. Hosted database migrations, backup/recovery, real
email confirmation/password recovery, hosted auth and external observability
remain outside this local acceptance. Package 3C and later are not started.

Revert the isolated 3B commit as a unit, keeping the prerequisite commit. This
restores the framework/React pairs, lockfile and matching native-install policy;
then rerun the trusted install and verification. Do not deploy the reverted
vulnerable baseline as a long-term solution. Remote CI and Vercel must still be
verified after a separately authorized push/deployment.
