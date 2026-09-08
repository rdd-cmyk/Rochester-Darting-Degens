# Dependency Modernization Delivery Plan

Status: 3A complete; 3B–3E and approved ESLint 10 exception locally verified; 3F requires approval

Branch: `advanced-statistics`

Last reviewed: 2026-09-08

## Objective

Modernize the application's runtime and dependency baseline without combining
unrelated risk. The work is split into independently reviewable delivery
packages between Phase 3 and Phase 4 of the advanced-statistics roadmap.

This document is a plan only. Preparing it does not authorize package updates,
hosted Supabase changes, or production deployment.

## Delivery rules

Every package follows the same sequence:

1. Refresh the registry and vulnerability evidence immediately before work.
2. Record the exact versions and migration notes being proposed.
3. Change only the package's declared scope.
4. Run `npm run ci:install` from the lockfile, then tests, coverage, lint,
   type-check, build, and the package-specific checks below.
5. Review the complete diff and generated lockfile before committing.
6. Commit the package separately so it can be reverted independently.

Do not use `npm audit fix --force`, broad `latest` ranges, or an unrelated
framework migration to make an audit report disappear. A package may be split
again if its actual migration surface is larger than expected.

## Current baseline

The baseline was refreshed before Package 3A began. As observed on 2026-08-30:

- The repository uses npm and checks in `package-lock.json`.
- Next.js `16.0.7` is the source of the remaining production audit chain; the
  audit reports three high-severity findings through Next.js, its internal
  PostCSS version, and Sharp.
- Supabase JS is `2.86.2`; the Node.js 24 contract now satisfies the runtime
  floor for its planned Package 3C upgrade.
- React and React DOM are paired at `19.2.0`.
- Vitest and V8 coverage are paired at `4.1.10`.
- jsdom `30.0.1` requires Node.js `22.22.2+`, `24.15.0+`, or `26+`; the
  repository's Node.js `24.x` contract satisfies that requirement.
- `es-abstract` has no direct source import and should be validated for removal
  instead of automatically upgraded.

The dated facts above are recorded in the information registry with explicit
refresh triggers. They are not permanent truths.

Primary references reviewed for this plan:

- [Node.js release status](https://nodejs.org/en/about/previous-releases)
- [npm package metadata](https://docs.npmjs.com/files/package.json)
- [GitHub Actions setup-node](https://github.com/actions/setup-node)
- [Next.js August 2026 security release](https://nextjs.org/blog/august-2026-security-release)
- [Supabase JS runtime support policy](https://github.com/supabase/supabase-js/blob/master/packages/core/supabase-js/README.md#support-policy)
- [Vercel supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

## Package 3A — Runtime and delivery contract

Status: complete; verified locally, in GitHub Actions, and in a Vercel preview

### Selected contract

- Node.js `>=24.15.0 <25` and npm 11 as the portable development and delivery
  contract; the Node floor matches the installed jsdom requirement.
- Node.js `24.20.0` pinned in `.nvmrc` for local and CI reproducibility.
- `npm run ci:install` bootstraps exact npm `11.19.0` with package scripts
  disabled before running the trusted install, regardless of the invoking npm 11
  patch.
- Root engine and development-engine checks fail npm commands on unsupported
  runtime or package-manager families.
- The trusted clean install suppresses all dependency scripts, checks the exact
  reviewed script approvals, and then rebuilds only Sharp and unrs-resolver.
- GitHub Actions runs the complete verification suite from that install; Vercel
  selects its latest supported compatible `24.x` patch and invokes the same
  trusted install command.

Node.js 24 remains LTS and Vercel lists `24.x` as its default supported runtime.
npm 12 is intentionally not introduced in this package because it is a separate
package-manager major and is not required by Node.js 24 or the current project.
These facts were refreshed from primary sources on 2026-08-30.

### Local acceptance evidence

Under Node.js `24.20.0` and bundled npm `11.19.0`:

- `npm run ci:install` completed from the checked-in lockfile after suppressing
  all dependency scripts; Sharp `0.34.5` and unrs-resolver `1.11.1` are approved
  by exact version and are the only explicitly rebuilt packages.
- 33 Vitest tests passed and the statistics coverage thresholds passed.
- ESLint, TypeScript, and the production Next.js build passed.
- The production audit remained at the pre-existing three-high Next.js chain;
  Package 3A did not change an application dependency.
- GitHub Actions run `33326355458` passed the full gate for commit `71dccac`.
- The first Vercel preview failed after patch-level Node/npm floors were added.
  Vercel does not guarantee those patches, and the exact `packageManager` value
  conflicted with the ranged `devEngines` declaration. A Node `24.19.0` and npm
  `11.12.1` simulation then reproduced the trusted-install failure because that
  npm patch lacks `npm install-scripts`. The contract now follows Vercel's
  documented major-line guarantee and bootstraps npm `11.19.0`.
- GitHub Actions run `33327531198` and Vercel deployment
  `7Q8bJBqSjuM3hhGKYkcPNomx7ADt` both passed for corrective commit `db5816d`.

### Scope

- Declare the supported Node.js runtime after confirming local, CI, and Vercel
  compatibility; Node.js 24 is the planned target.
- Pin the npm package-manager family used to produce the lockfile.
- Document npm as the canonical package manager for this repository.
- Confirm that clean installs and deployment builds use the same runtime
  contract.

### Acceptance

- A fresh `npm run ci:install` succeeds under the declared runtime.
- The declared runtime satisfies the checked-in jsdom engine requirement and
  runs the required Vitest gate.
- Tests, coverage, lint, type-check, and production build pass.
- Hosting configuration and observed deployment runtime agree with the
  repository contract.
- No application dependency is upgraded incidentally.

### Rollback

Revert the package's isolated commit and restore the prior runtime declaration.

## Package 3B — Next.js security baseline

Status: implemented and locally verified; user authorized 2026-09-07.
Independent review completed with no actionable findings; CI/Vercel verification
awaits push.

### Selected versions (refreshed 2026-09-07)

- Next.js and `eslint-config-next`: `16.3.4`
- React and React DOM: `19.2.8`
- React types: `19.2.18`; React DOM types: `19.2.7`

Published stable tags and exact peer/engine metadata were checked before
implementation. Next 16.3.4 follows the August security release and re-enables
AVIF optimization with the upstream correction; it also contains targeted
build/testmode fixes. React 19.2.8 improves Server Component decoding. No canary,
React 19.3, compiler migration, or opt-in caching model is introduced here.

References: [Next 16.3.4](https://github.com/vercel/next.js/releases/tag/v16.3.4),
[August security release](https://nextjs.org/blog/august-2026-security-release),
[React 19.2.8](https://github.com/react/react/releases/tag/v19.2.8),
[Next 16 migration guide](https://nextjs.org/docs/app/guides/upgrading/version-16).

Pre-upgrade production audit: 3 high findings (Next, nested PostCSS, Sharp).
Refresh the post-upgrade audit rather than assuming these versions alone close
the gate. Review native install scripts before changing exact approvals.

Refresh these targets before implementation; use the newest compatible secure
patch only after reading its official migration and security notes.

### Local verification (2026-09-07)

- Trusted clean install, all 59 Vitest tests, coverage thresholds, lint,
  type-check, and production build passed under Node 24.20.0/npm 11.19.0.
- Two Playwright scenarios passed against the locally configured **production**
  server: auth/session redirects, allowed/denied match writes, protected profile
  pages, dynamic profile rendering, query-string/Suspense rendering, desktop/
  mobile statistics, an unauthenticated server-route denial, and native image
  optimization. Browser requests stayed local; no hosted test records were used.
- Production npm audit is now **0 vulnerabilities** (previously 3 high).
  The full audit retains one moderate development-only `@humanfs/node@0.16.7`
  advisory through unchanged ESLint 9.39.1. Track its remediation in Package 3E;
  do not describe this as a clean full-tree audit.
- Next's required transitive updates include PostCSS 8.5.23 and Sharp 0.35.4.
  Sharp no longer has an install lifecycle hook, so its obsolete approval and
  rebuild step were removed. Only unchanged `unrs-resolver@1.11.1` is explicitly
  approved/rebuilt; dependency install scripts remain suppressed by default.
- Supabase JS/CLI, Vercel SDKs, Vitest/coverage, ESLint, Tailwind, and TypeScript
  direct versions were verified unchanged. There are no application feature,
  hosted configuration, or schema changes in this package.

See `docs/package-3b-verification-2026-09-07.md` for scope and remaining gates.

### Acceptance

- The production audit has no high-severity finding in the Next.js chain.
- Authentication redirects, protected pages, server/client boundaries, and
  production rendering behave as before.
- The complete standard verification suite and desktop/mobile browser smoke
  tests pass.

### Rollback

Revert Package 3B as one unit. Do not leave Next.js and its ESLint configuration
on different release lines.

## Package 3C — Supabase client and authentication reliability

Status: implemented and locally verified; user authorized 2026-09-07.
Independent review completed with no remaining actionable findings.
Hosted acceptance and CI/Vercel remain pending;
no hosted mutations authorized.

### Selected version (refreshed 2026-09-07)

- `@supabase/supabase-js`: exact `2.116.0` (stable, not canary or v3 preview).
- Published Node requirement `>=22.0.0` is satisfied by our Node 24 contract.
- CLI remains separately pinned at 2.116.0; its matching number is coincidental,
  not a requirement to update the CLI or database services alongside the SDK.
- Local production/browser auth and RLS checks use synthetic fixtures and the
  existing reviewed policy baseline. This is not hosted acceptance; no hosted
  records, migration history, or database schema will be changed by this package.

References: [2.116.0 release](https://github.com/supabase/supabase-js/releases/tag/v2.116.0),
[runtime support policy](https://github.com/supabase/supabase-js/blob/v2.116.0/packages/core/supabase-js/README.md#support-policy),
[password recovery API](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail).

This package begins only after Package 3A has established the supported Node
runtime and the target version has been refreshed.

### Local verification (2026-09-07)

- Supabase JS and its five client subpackages moved from 2.86.2 to 2.116.0.
  Only their dependency graph changed; CLI, framework, observability and
  maintenance packages remain unchanged. No application or SQL edits required.
- Trusted clean install, 59 Vitest tests, coverage thresholds, lint, type-check
  and a fresh local-configured production build passed.
- Three production-browser scenarios passed, now including email recovery
  through local Mailpit, password replacement, rejection of the old password,
  session reload, explicit refresh-token rotation and sign-out. Authenticated
  reads and allowed/denied match writes pass; signed-out profile, match and
  participant reads return no rows. The 25 local pgTAP assertions also pass.
- Production audit remains zero; full audit retains the same single moderate
  development-only humanfs advisory assigned to 3E.
- Local Auth has email confirmation disabled. Real email delivery, hosted
  confirmation/redirect settings, hosted RLS execution and CI/Vercel remain
  unverified. No schema migration was applied as part of this package.

See `docs/package-3c-verification-2026-09-07.md` for evidence and rollback.

### Acceptance

- Sign-up, sign-in, sign-out, password-reset, and session restoration are
  exercised against an authorized environment.
- Existing profile, match, participant, and statistics reads still obey the
  hosted Row Level Security policies.
- Match creation and editing are exercised with both allowed and denied users.
- No database migration is applied as part of the client upgrade.
- The standard verification suite passes.

### Rollback

Revert the client package and lockfile commit. Hosted data and schema must remain
untouched by this package.

## Package 3D — Vercel observability SDKs

Status: implemented and locally verified; user authorized 2026-09-07.
Independent review completed with no actionable findings. No push, hosted
collection or paid service changes included; hosted intake acceptance remains
pending, as do CI/Vercel deployment checks.

### Selected versions (refreshed 2026-09-07)

- `@vercel/analytics`: `2.0.1`
- `@vercel/speed-insights`: `2.0.0`

Both stable targets support the existing Next 16/React 19 runtime. Dynamic
provider configuration is supported without opting into a new endpoint or paid
feature. No new transitive packages or install approvals are required. Analytics
2.0.1 fixes optional Nuxt peer metadata; no Nuxt integration is used here.

The application now shares a client-side `beforeSend` URL filter: reviewed page
routes only, no query/fragment values, anonymized profile path IDs, and no events
for auth/recovery/unknown routes. The root's explicit local-mode exclusion is
unchanged. Sampling remains at the provider default; no custom events, identity
properties or performance subscription changes are introduced.

See `docs/observability.md` for behavior, privacy limits, sampling, provider
configuration, and the authorized hosted verification checklist. Local tests
must not be represented as proof that events reached Vercel.

### Local verification (2026-09-07)

- Trusted clean install, 81 Vitest tests, coverage, lint, type-check and fresh
  production builds with telemetry mounted and excluded passed.
- One intercepted production-browser telemetry scenario passed: single SDK
  scripts, client navigation, privacy callbacks, no hydration/console errors,
  and no collection requests. This does not execute the hosted collector.
- Restored telemetry-disabled local build and passed all three ordinary browser
  scenarios covering auth/recovery, match writes, profiles and statistics.
- Production audit remains zero; full audit retains the same moderate
  development-only humanfs advisory assigned to 3E.

See `docs/package-3d-verification-2026-09-07.md` for evidence and rollback.

### Acceptance

- Production and preview builds render without duplicate script injection or
  hydration warnings.
- Analytics and performance events reach their configured destinations in an
  authorized preview.
- Privacy expectations, sampling, and environment behavior are documented.
- The standard verification suite passes.

### Rollback

Revert both observability packages together; they are operationally related but
independent of application data.

## Package 3E — Low-risk maintenance and pruning

Status: implemented and locally verified; user authorized 2026-09-07.
Independent review completed with no actionable findings. No push/deployment
included; remote gates remain open.

### Selected maintenance targets (2026-09-07)

- Vitest / V8 coverage: exact `4.1.11`, from 4.1.10. Vitest 5 is now stable,
  but is a separately scoped major migration, not this package's patch update.
- ESLint: exact `9.39.5`, from 9.39.1. IMPORTANT: ESLint 9 reached upstream
  end of life on 2026-08-06. This closes the scoped maintenance work but is not
  a supported long-term lint baseline; prioritize a separate ESLint 10/plugin
  compatibility review before declaring tooling modernization finished.
- Node types: exact `24.13.3`, from 20.19.25, matching the Node 24 runtime line.
  Its type-only undici dependency moves to the required 7.18.x line.
- Transitive `@humanfs/node`: 0.16.8 within ESLint's declared compatible range;
  no forced audit fix, root dependency or override added.
- Removed the unused direct `es-abstract` declaration. It remains transitively
  required by ESLint plugins; this is manifest pruning, not bundle reduction.
- React/DOM types are already the current 19.2.18/19.2.7 from 3B and stay fixed.

Sources: [Vitest 4.1.11](https://github.com/vitest-dev/vitest/releases/tag/v4.1.11),
[ESLint 9.39.5](https://github.com/eslint/eslint/releases/tag/v9.39.5),
[ESLint support policy](https://eslint.org/version-support/),
[humanfs advisory](https://github.com/advisories/GHSA-p498-v437-472g),
[DefinitelyTyped versioning](https://github.com/DefinitelyTyped/DefinitelyTyped#version-selection).

### Approved scope

- Patch Vitest and V8 coverage together from `4.1.10` to `4.1.11` or the
  refreshed compatible patch.
- Take the latest compatible ESLint 9 patch, not ESLint 10.
- Patch React and DOM type definitions as required by Package 3B.
- Align Node type definitions with the runtime chosen in Package 3A.
- Resolve the development-only `@humanfs/node` symlink-copy advisory
  [GHSA-p498-v437-472g](https://github.com/advisories/GHSA-p498-v437-472g),
  refreshed during 3B; re-audit at package entry.
- Remove `es-abstract` if a clean install, source search, and build confirm that
  no direct dependency is required.

### Local verification (2026-09-07)

- Trusted clean install, all 81 Vitest tests, unchanged coverage thresholds,
  lint, type-check and local-configured production build passed.
- Both full and production npm audits now report zero vulnerabilities. The
  previously tracked humanfs finding is resolved without an override.
- The 26 files in the rebuilt local `.next/static` output have the same content
  hashes as the pre-3E local build. This is browser-asset evidence, not a claim
  that every generated server artifact is byte-identical.
- No app, SQL, CSS, runtime declaration, install policy or test source changes.
  Required transitive development updates are detailed in the verification record.

See `docs/package-3e-verification-2026-09-07.md` for final browser/review evidence,
the ESLint end-of-life caveat and rollback.

### Acceptance

- Test behavior and coverage thresholds remain unchanged.
- The lockfile contains no unexpected framework or transitive major upgrade.
- Removing `es-abstract` does not change runtime or build output.
- The standard verification suite passes.

### Rollback

Revert the maintenance commit. If removal and patching prove meaningfully
different, split them into separate commits before merge.

## ESLint follow-up — Compatible prerequisites and separate major migration

Current follow-up (2026-09-08): the user approved the narrowly scoped three-plugin
peer exception. ESLint 10.10.0 and official compat 2.1.1 are installed with strict
clean resolution, and the 64 bridge checks now run in the ordinary 150-test suite.
See `docs/eslint-10-adoption-2026-09-08.md` for final gates, ownership and removal
policy. The following paragraphs preserve the earlier decision sequence.

User approved the compatible update and lint-gap correction, followed by a
separate evaluation of the remaining plugins on 2026-09-07. TypeScript ESLint
8.70.0 and Hooks 7.1.1 are locked within Next's supported dependency ranges;
ESLint stays at 9.39.5. The dynamic profile page now has full lint coverage and
regression tests. See `docs/eslint-follow-up-2026-09-07.md` for verification,
dependency details and rollback.

The ESLint 10.10.0 evaluation confirms a remaining React-plugin API crash;
Import and JSX accessibility pass the current isolated corpus but their latest
published peers do not include 10. The separate migration proposal first checks
for compatible releases, then considers a bounded official-compatibility-layer
proof with preserved rule coverage and clean peer resolution. Replacements,
peer-policy exceptions and actual ESLint 10 adoption are not implicitly approved.
Reassess before Phase 4 or by 2026-09-14; no background monitor was created.

The subsequently approved bounded bridge trial is complete at the execution
level: 64 opt-in Vitest checks and the full lint corpus pass with ESLint 10.10.0
and @eslint/compat 2.1.1. Combined strict peer resolution still fails. No ESLint
10 adoption or peer-policy exception was made. See
`docs/eslint-bridge-trial-2026-09-07.md` for reproducible evidence and the narrow
override proposal requiring separate approval. This trial is not Phase 4 entry
clearance and does not convert the unsupported ESLint 9 baseline into support.

## Package 3F — Optional CSS/tooling evaluation

### Candidate change

- Evaluate Tailwind CSS and `@tailwindcss/postcss` `4.3.3` as a paired update.

This is optional because the current site relies heavily on custom CSS and the
upgrade offers less immediate value than the runtime, security, data-client,
and observability packages.

### Acceptance

- Generated styles, responsive layouts, focus states, and production CSS are
  compared on the main, match-entry, and statistics pages.
- Desktop and mobile visual smoke tests pass without unexplained CSS churn.
- The standard verification suite passes.

### Rollback

Revert the paired Tailwind/PostCSS tooling commit.

## Explicit deferrals

These upgrades are outside the current package set unless a concrete blocker
changes the decision:

- ESLint plugin replacements or broader peer exceptions remain outside scope.
  The separately approved ESLint 10 adoption above covers only three exact
  plugin-version overrides and the official bridge; upstream plugin support is
  still distinct from a successful install under those exceptions.
- Vitest 5, newly stable at the 3E refresh, requires a separate migration review.
- TypeScript 7, because it changes compiler implementation and compatibility
  surfaces beyond routine maintenance.
- Node type definitions 26, because types should represent the supported
  runtime rather than the newest unrelated release line.
- A package-manager migration, because npm already has a canonical lockfile and
  there is no demonstrated delivery problem to solve.

## Phase 4 entry gate

Phase 4 League Night Mode may begin when Packages 3A–3E are completed or each
remaining package has a documented deferral, the repository's required checks
pass, and the dependency audit and runtime contract have been refreshed.
Package 3F may remain deferred if its benefit does not justify its visual
regression surface.
