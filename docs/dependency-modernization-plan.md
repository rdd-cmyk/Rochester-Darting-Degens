# Dependency Modernization Delivery Plan

Status: planned next; implementation requires an explicit go-ahead

Branch: `advanced-statistics`

Last reviewed: 2026-08-30

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
4. Run `npm ci` from the lockfile, then tests, coverage, lint, type-check, build,
   and the package-specific checks below.
5. Review the complete diff and generated lockfile before committing.
6. Commit the package separately so it can be reverted independently.

Do not use `npm audit fix --force`, broad `latest` ranges, or an unrelated
framework migration to make an audit report disappear. A package may be split
again if its actual migration surface is larger than expected.

## Current baseline

The baseline must be refreshed before Package 3A begins. As observed on
2026-08-30:

- The repository uses npm and checks in `package-lock.json`.
- Next.js `16.0.7` is the source of the remaining production audit chain; the
  audit reports three high-severity findings through Next.js, its internal
  PostCSS version, and Sharp.
- Supabase JS is `2.86.2`; current releases require a newer Node runtime than
  the repository presently declares.
- React and React DOM are paired at `19.2.0`.
- Vitest and V8 coverage are paired at `4.1.10`.
- `es-abstract` has no direct source import and should be validated for removal
  instead of automatically upgraded.

The dated facts above are recorded in the information registry with explicit
refresh triggers. They are not permanent truths.

Primary references reviewed for this plan:

- [Next.js August 2026 security release](https://nextjs.org/blog/august-2026-security-release)
- [Supabase JS runtime support policy](https://github.com/supabase/supabase-js/blob/master/packages/core/supabase-js/README.md#support-policy)
- [Vercel supported Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

## Package 3A — Runtime and delivery contract

### Scope

- Declare the supported Node.js runtime after confirming local, CI, and Vercel
  compatibility; Node.js 24 is the planned target.
- Pin the npm package-manager family used to produce the lockfile.
- Document npm as the canonical package manager for this repository.
- Confirm that clean installs and deployment builds use the same runtime
  contract.

### Acceptance

- A fresh `npm ci` succeeds under the declared runtime.
- Tests, coverage, lint, type-check, and production build pass.
- Hosting configuration and observed deployment runtime agree with the
  repository contract.
- No application dependency is upgraded incidentally.

### Rollback

Revert the package's isolated commit and restore the prior runtime declaration.

## Package 3B — Next.js security baseline

### Planned versions

- Next.js and `eslint-config-next`: `16.3.3`
- React and React DOM: `19.2.8`
- Matching React type-definition patch releases

Refresh these targets before implementation; use the newest compatible secure
patch only after reading its official migration and security notes.

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

### Planned version

- `@supabase/supabase-js`: `2.112.4`

This package begins only after Package 3A has established the supported Node
runtime and the target version has been refreshed.

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

### Planned versions

- `@vercel/analytics`: `2.0.1`
- `@vercel/speed-insights`: `2.0.0`

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

### Planned changes

- Patch Vitest and V8 coverage together from `4.1.10` to `4.1.11` or the
  refreshed compatible patch.
- Take the latest compatible ESLint 9 patch, not ESLint 10.
- Patch React and DOM type definitions as required by Package 3B.
- Align Node type definitions with the runtime chosen in Package 3A.
- Remove `es-abstract` if a clean install, source search, and build confirm that
  no direct dependency is required.

### Acceptance

- Test behavior and coverage thresholds remain unchanged.
- The lockfile contains no unexpected framework or transitive major upgrade.
- Removing `es-abstract` does not change runtime or build output.
- The standard verification suite passes.

### Rollback

Revert the maintenance commit. If removal and patching prove meaningfully
different, split them into separate commits before merge.

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

- ESLint 10, because it is a breaking major upgrade with no current feature or
  security requirement.
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
