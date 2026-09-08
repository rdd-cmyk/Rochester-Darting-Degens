# Website telemetry contract

Reviewed 2026-09-07 for Package 3D. These are website usage/performance tools,
not the darts statistics engine and not a new league-data export.

## Packages and integration

`@vercel/analytics@2.0.1` and `@vercel/speed-insights@2.0.0` are pinned together
in the npm lockfile. Their existing `/next` adapters remain compatible with
Next 16.3.4 / React 19.2.8. One `Observability` client component in the root
layout mounts both SDKs and supplies the shared `beforeSend` filter.

The v2 releases support dynamic script/intake configuration. Next adapters read
`NEXT_PUBLIC_VERCEL_OBSERVABILITY_CLIENT_CONFIG` and
`NEXT_PUBLIC_VERCEL_OBSERVABILITY_BASEPATH`; these are public build-time
configuration, never secret storage. No override is added here. Refresh browser
network evidence if the provider changes these values or enables Resilient
Intake; do not hard-code the default paths as universal hosted destinations.

Sources: [Analytics release](https://github.com/vercel/analytics/releases/tag/v2.0.1),
[Analytics v2 changes](https://github.com/vercel/analytics/releases/tag/v2.0.0),
[Speed Insights release](https://github.com/vercel/speed-insights/releases/tag/v2.0.0),
[Analytics configuration](https://vercel.com/docs/analytics/package),
[Speed Insights configuration](https://vercel.com/docs/speed-insights/package).

Licensing evidence differs between release notes and one artifact: Analytics
2.0.1 ships MIT metadata; Speed Insights 2.0.0 still ships Apache-2.0 in both
`package.json` and `LICENSE`, despite upstream announcing MIT. Preserve the
distributed notices and recheck before making a licensing claim. Do not edit
the lockfile's Apache-2.0 metadata to match the announcement.

## Environment and collection

| Environment | Behavior |
| --- | --- |
| Guarded `dev:local` / `build:local` (`RDD_LOCAL_PREVIEW=1`) | Neither SDK mounts; no telemetry scripts or collection. |
| Ordinary Next development, without the local flag | SDK development/debug mode; may fetch public debug scripts. Use `dev:local` for isolated QA. |
| Production build, including Vercel Preview | SDK production mode; the word Preview does not make a production build a development build. Actual collection depends on provider enablement/configuration. |
| Intercepted local production QA | Both SDKs mount, but Playwright replaces the two collection scripts with inert stubs and blocks nonlocal requests. This tests wiring, not intake or metrics. |

Default production script paths are `/_vercel/insights/script.js` and
`/_vercel/speed-insights/script.js`; the provider serves the collection scripts.
Vercel must have the respective product enabled. Installing an SDK is not proof
of dashboard access, product enablement, event receipt or subscription status.
No paid plan, budget, dashboard setting or sampling change is made by 3D.

No `sampleRate` override is supplied. Vercel documents the Speed Insights default
as sending all eligible events; application filtering may drop events before
delivery. Changing the rate trades measurement precision for lower volume and
requires a separately reviewed change. Analytics keeps automatic page views;
there are no custom `track()` calls or application identity properties.

## Privacy boundary

`lib/telemetry.ts` permits only the current reviewed page categories: home,
matches, stats, profiles, own profile and change log. Profile-detail paths become
`/profiles/[id]`. Query strings and fragments are discarded; auth, verify-email,
password recovery, test and unknown routes return `null`. Malformed URLs fail
closed. New pages require an explicit allowlist review. Speed Insights' event
route, when present, is replaced with the same reviewed category.

The filtering hook narrows the event URL/route, not all browser or provider
data. It is not a consent system, network-level anonymity guarantee, or a
guarantee that request referrers/headers, provider-managed fields or future
custom payloads contain no identifying information. SDK scripts may still load
on excluded pages, and internal queues can contain raw routes before the hosted
collector invokes the hook. Do not put credentials into custom events or debug
logs; do not publish browser traces, reset links or account-bearing screenshots.

Vercel documents aggregate usage information and performance data including URL,
route, browser/device, country and Web Vitals. Review its
[Analytics privacy details](https://vercel.com/docs/analytics/privacy-policy) and
[Speed Insights privacy details](https://vercel.com/docs/speed-insights/privacy-policy)
alongside actual payloads and the league's privacy expectations before release.
The supported filtering mechanism is documented in
[redacting sensitive data](https://vercel.com/docs/analytics/redacting-sensitive-data).

## Local and hosted verification

Unit tests exercise the actual SDKs with mocked Next navigation, covering script
deduplication, route updates, dynamic endpoints, development mode and installed
privacy callbacks. Both SDKs are transformed in Vitest so the router mock applies
consistently to their published module formats; no test dependency is upgraded.

The separate `scripts/qa/observability.config.mjs` suite requires a fresh
production build with telemetry mounted and loopback Supabase variables. Build
and serve with process-only `RDD_LOCAL_PREVIEW=0`, blank GitHub integration
variables, and blank public observability configuration overrides, then run:

```powershell
$env:RDD_PLAYWRIGHT_ROOT='<absolute path to the installed playwright package>'
node "$env:RDD_PLAYWRIGHT_ROOT\cli.js" test --config scripts/qa/observability.config.mjs
```

Use `localStatus()` from `scripts/local-environment.mjs` to validate the backend
and obtain its URL/anon key without printing credentials. Never reuse a bundle
built with hosted public variables. Do not manually browse this telemetry-enabled
QA server outside the intercepting test. Stop it afterward, rebuild using
`npm run build:local`, and serve only that telemetry-disabled build for ordinary
synthetic acceptance. Existing environment files remain unchanged.

After a separately authorized push/deployment, an owner or member with access
must complete the hosted gate:

1. Verify CI and the exact preview commit. Check both products' enablement,
   existing plan limits and preview-environment settings; do not enable a paid
   product merely to turn a check green.
2. Inspect one script per SDK and actual configured destinations, including any
   dynamic Resilient Intake routes. Check hydration and navigation console errors.
3. Use a small authorized synthetic session. Inspect redacted page-view/vital
   payloads without recording credentials; exercise auth/recovery exclusions and
   player URL redaction. Trigger navigation/interaction and page hide as needed
   for Web Vitals; a script GET alone is not an event-delivery test.
4. Confirm both accepted requests and corresponding preview-filtered dashboard
   data. Record commit, environment and evidence without private identifiers.
   If either product is unavailable or dashboard access is missing, leave that
   gate pending rather than treating local SDK tests as hosted receipt.
