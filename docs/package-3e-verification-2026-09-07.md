# Package 3E — Maintenance and pruning verification

Date: 2026-09-07. Branch: `advanced-statistics`.
Prerequisite: `8fb2638` (Package 3D).
Status: local implementation, verification and independent code/documentation
review completed. No push or deployment included.

## Exact changes

| Dependency | Before | After |
| --- | --- | --- |
| Vitest / V8 coverage | 4.1.10 | 4.1.11 |
| ESLint | 9.39.1 | 9.39.5 |
| Node type definitions | 20.19.25 | 24.13.3 |
| Transitive humanfs/node | 0.16.7 | 0.16.8 |
| Direct es-abstract declaration | ^1.24.0 | Removed; 1.24.0 retained transitively |

Direct maintenance versions are exact. React/DOM types remain 19.2.18/19.2.7,
already current from 3B. Framework, React, Supabase client/CLI, Vercel SDKs,
Tailwind/PostCSS, TypeScript, jsdom and Testing Library versions are unchanged.

Vitest 4.1.11 includes lifecycle concurrency and mock filesystem-boundary fixes;
ESLint 9.39.5 includes a require-cache compatibility backport. Node types now
match the actual Node 24 major; their patch/minor number does not select or
upgrade the Node executable. The runtime contract stays unchanged.

Sources: [Vitest patch](https://github.com/vitest-dev/vitest/releases/tag/v4.1.11),
[ESLint patch](https://github.com/eslint/eslint/releases/tag/v9.39.5),
[humanfs advisory](https://github.com/advisories/GHSA-p498-v437-472g),
[type package versioning](https://github.com/DefinitelyTyped/DefinitelyTyped#version-selection).

Reviewed development transitive changes include the paired Vitest internals,
ESLint config helpers, Acorn 8.18.0, humanfs/core 0.19.2 and types 0.15.0,
Rolldown 1.2.7 and its native platform packages/OXC types 0.148.0. Vite remains
8.2.2. Node types require undici-types 7.18.2 instead of 6.21.0; this is type-only,
not a runtime HTTP-client replacement. Four existing Linux Lightning CSS records
gain platform metadata without changing their version/resolution. No unexpected
framework or runtime dependency major upgrade, overrides or new root dependency.

## Pruning and installation

A source search outside manifests/docs found no direct `es-abstract` import.
`npm explain es-abstract` confirms ESLint plugins still require it after removing
the root declaration. Its installed version is unchanged; do not claim smaller
bundles or that the transitive package was deleted. This manifest-only removal
does not warrant a separate rollback unit from the maintenance package.

Lockfile resolution used dependency scripts disabled, then a targeted compatible
`npm update @humanfs/node --package-lock-only --ignore-scripts --no-audit` resolved
the vulnerable leaf. No broad audit fix, force flag or override was used.
The initial resolution warned about the previously locked Vitest/coverage pair
while replacing both; final clean install and dependency-tree checks show one
aligned 4.1.11 pair with no invalid peers.

`npm run ci:install` passed, adding 474 installed packages. Only unchanged
`unrs-resolver@1.11.1` was approved/rebuilt. No install-script policy changed.

## Verification

Environment: Windows, Node 24.20.0, npm 11.19.0.

- `npm test`: **81 passed in 13 files** on Vitest 4.1.11, including real-SDK
  component and URL-privacy tests from 3D.
- `npm run test:coverage`: passed with unchanged scope/thresholds/results:
  statistics/match-state lines/functions 100%, branches 91.35%, statements
  99.28%. These are not whole-app coverage percentages.
- `npm run lint`, `npm run typecheck`: passed without rule/config/source changes.
- `npm run build:local`: fresh optimized production build passed against guarded
  loopback Supabase with process-only environment overrides; `.env.local` unchanged.
- The rebuilt `.next/static` has 26 files, all with content hashes matching the
  pre-3E local production build from 3D. This verifies unchanged browser asset
  contents, not byte-identical build IDs, server artifacts or hosted output.
- `npm audit --omit=dev` and full `npm audit`: **zero vulnerabilities**, both
  exit successfully. The one moderate humanfs finding from 3B–3D is resolved.
  This is dated registry evidence, not a guarantee of no security defects.
- Standard Playwright 1.62.1 / installed Chrome: **three scenarios passed in
  13.1s**, using the fresh local production bundle on 127.0.0.1:3000 with
  `RDD_LOCAL_PREVIEW=1`, local Supabase variables and blanked process-only GitHub
  integration variables. Signup/recovery/session refresh, allowed/denied match
  writes, profiles, desktop/mobile statistics and native image output pass.
  No uncaught page errors or external browser request attempts were recorded.
  Synthetic local fixtures are retained; hosting received no test writes.

Independent code/lockfile review found no actionable findings. It confirmed
required dependency and peer compatibility, scope and direct-dependency pruning;
the reviewer did not rerun tests. `git diff --check` passed. The preview remains
running with telemetry disabled. The existing anonymous profile-metadata RLS
fallback is unchanged; authenticated profile content passed browser acceptance.

## Remaining gates and rollback

[ESLint's support policy](https://eslint.org/version-support/) says v9 reached
end-of-life on 2026-08-06. The clean install warns accordingly. Keeping v9 here
honors the explicitly approved patch-only scope; it is not a durable supported
baseline. Prioritize a separately approved ESLint 10/plugin compatibility
migration. Vitest 5 is also now stable, but its breaking migration remains
outside this maintenance package. Package 3F has not started.

No app code, CSS, SQL, hosted data, migration history, credentials, telemetry
settings or subscriptions changed. CI/Vercel and the prior hosted auth/intake
acceptance gates remain pending; local success does not satisfy them.

Revert this isolated 3E commit as a unit, retaining 3D, then rerun trusted
installation and verification. Reversion restores the vulnerable humanfs leaf
and old development types/test/lint baseline; do not treat it as a long-term
security solution. No database rollback is required.
