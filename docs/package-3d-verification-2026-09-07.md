# Package 3D — Vercel observability verification

Date: 2026-09-07. Branch: `advanced-statistics`.
Prerequisite: `e147d5d` (Package 3C).
Status: implementation, local verification and independent review completed.
Hosted intake, CI and Vercel acceptance remain pending. No push, deployment,
hosted Supabase mutation or paid service change is included.

## Changes

- Analytics 1.6.1 -> exact 2.0.1; Speed Insights 1.3.1 -> exact 2.0.0.
  Registry stable tags and peers support the current Next/React versions.
  No new transitive packages, unrelated upgrades or install lifecycle approvals.
- Both existing `/next` adapters now share one client wrapper, mounted once by
  the root outside explicit local preview mode. Supported `beforeSend` hooks
  remove query strings/fragments, replace profile IDs with a route category,
  and drop auth/recovery/unreviewed routes. App behavior and auth/SQL are unchanged.
- Real-SDK component tests plus pure filter tests add 22 Vitest cases. Vitest
  transforms these two packages so their module formats use the mocked Next
  router consistently; no test-tool versions or coverage thresholds change.
- Separate standard Playwright suite tests production integration with inert
  transport stubs. Normal local acceptance retains its complete telemetry ban.
- `docs/observability.md` records environment behavior, unchanged default
  sampling, dynamic configuration, privacy limitations and the hosted checklist.

Reviewed upstream sources are linked in that contract. Analytics 2.0.1 ships MIT;
Speed Insights 2.0.0 still carries Apache-2.0 in its published manifest/LICENSE,
despite upstream release notes announcing MIT. Distributed notices are preserved.

## Executable evidence

Environment: Windows, Node 24.20.0, npm 11.19.0, Next 16.3.4 / React 19.2.8.

- `npm run ci:install`: passed after lockfile generation with scripts disabled.
  Only unchanged `unrs-resolver@1.11.1` was approved/rebuilt.
- `npm test`: **81 passed in 13 files**.
- `npm run test:coverage`: passed. Existing statistics/match-state scope remains
  100% lines/functions, 91.35% branches and 99.28% statements. These percentages
  are not whole-app or telemetry coverage claims.
- `npm run lint`, `npm run typecheck`: passed, final lint has no warnings.
- Fresh optimized production builds passed in both local-only mode and
  telemetry-mounted mode. Both used process-only loopback Supabase URL/anon/site
  variables from guarded `localStatus()`, with GitHub integration variables
  blanked. Existing `.env.local` was untouched. Telemetry-mounted QA additionally
  blanked public observability config/basepath overrides to test default paths.
- Standard Playwright 1.62.1 / installed Chrome, telemetry-mounted production
  build: **one scenario passed in 3.8s**. Real SDKs injected one script each and
  retained them during client navigation. Both compiled privacy callbacks were
  inspected and exercised; no console/hydration/page errors or unexpected
  requests. The provider collection scripts were replaced with inert stubs;
  no page-view or performance collection was exercised or sent to hosting.
- Stopped that temporary server, rebuilt with `npm run build:local` and restored
  `RDD_LOCAL_PREVIEW=1`. Standard local production acceptance: **three scenarios
  passed in 13.3s**, covering signup/recovery/session refresh, allowed/denied match
  writes, profile rendering, desktop/mobile statistics and native image output.
- Production audit: **zero vulnerabilities**. Full audit: the unchanged one
  moderate development-only `@humanfs/node@0.16.7` finding assigned to 3E, no
  high/critical. The full audit exits nonzero for that known finding; it is not
  a clean full-tree audit.

Independent review examined dependency scope, SDK callback timing, filtering,
local-mode isolation, tests and the behavior/privacy contract against `e147d5d`.
No actionable findings remained. Browser verification was run by the implementing
agent; the reviewer independently inspected source and did not rerun those tests.

## Boundaries and rollback

The normal preview remains telemetry-disabled at 127.0.0.1:3000. Synthetic local
accounts/matches and ignored test artifacts are retained. No real league data,
hosted credentials or subscriptions changed. The pre-existing anonymous server
profile-metadata RLS fallback remains; authenticated content is verified locally.

Provider script loading, event intake and preview-filtered dashboard receipt must
be checked on the exact deployed commit with authorized access. Local callbacks
and transport stubs cannot establish hosted privacy, product enablement, actual
Web Vitals delivery or dashboard visibility. Follow `docs/observability.md` before
calling 3D fully accepted on hosting. Packages 3E–3F have not started.

Revert this isolated commit as a unit, retaining prerequisite 3C, and rerun the
trusted install and verification. Reversion also removes the new URL filtering;
review that privacy regression before deployment. No schema rollback is required.
