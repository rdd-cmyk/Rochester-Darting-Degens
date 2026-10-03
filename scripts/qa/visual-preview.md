# Synthetic visual preview

This fixture is for interface review when local Supabase is unavailable. By default it supplies three invented profiles and twelve invented matches, including a long nickname, and is read-only. The opt-in `--mutable` mode adds seven unmatched profiles so a ten-player form can be tested, allows in-memory create/edit/profile-save UI checks, and resets on server restart. It is **not** a database, an RLS test, or a real authentication/recovery test. Never point this preview at the hosted league.

Use two terminals from the repository root. Keep Docker/Supabase stopped so port 54321 is free.

```powershell
node scripts/qa/visual-fixture-server.mjs
```

For synthetic write-flow checks, run `node scripts/qa/visual-fixture-server.mjs --mutable` instead. The server binds only to `127.0.0.1`. To make the next write fail once for retry testing, send a local `POST` to `http://127.0.0.1:54321/__qa__/fail-next-write`. To inspect a pending form, send a local `POST` to `http://127.0.0.1:54321/__qa__/delay-next-write?ms=3000` immediately before saving; only the next write is delayed, by at most five seconds. To exercise the My Profile load-error and Retry view, send a local `POST` to `http://127.0.0.1:54321/__qa__/profile-read-failure?enabled=1` before visiting `/profile`; turn it off with `enabled=0` before clicking Retry. For the analogous Advanced Statistics error and Retry view, use `http://127.0.0.1:54321/__qa__/stats-read-failure?enabled=1` before visiting `/stats`, then `enabled=0` before Retry. These persistent switches survive repeated development loads and automatic GET retries. Restart the server to restore the original fixture rows.

To inspect missing-score display without changing the default parity dataset, start the read-only server with `--missing-scores`. Only the oldest 501 match differs: its two participant scores are `null` and `0`, respectively. Review page 2 of Matches and those players' profile histories; missing must render as an em dash while the recorded zero remains `0`. This mode is synthetic display evidence and should not be used for numerical baseline comparison.

```powershell
$env:RDD_VISUAL_FIXTURE='1'
$env:RDD_LOCAL_PREVIEW='1'
$env:NEXT_PUBLIC_RDD_VISUAL_FIXTURE='1'
$env:NEXT_PUBLIC_SUPABASE_URL='http://localhost:3210/visual-api'
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY='development-anon-key'
node node_modules/next/dist/bin/next dev -p 3210
```

The optional rewrite in `next.config.ts` forwards `/visual-api` to the loopback fixture only when `RDD_VISUAL_FIXTURE=1`. With that flag unset, the rewrite does not exist. `RDD_LOCAL_PREVIEW=1` disables telemetry scripts during the preview. When both flags are set and the request and Supabase URL are loopback addresses, the authenticated `/api/change-log` route returns fixed invented Markdown records on pages 1–2 and an empty page 3, without calling GitHub. This supports populated/paginated visual review; it does not verify the real GitHub API, production credentials, or hosted auth. Sign in with `demo-captain@example.test` and any dummy password; no real credentials are accepted or needed. In-memory saves can establish that the interface submits, reloads, and edits its synthetic records, but cannot establish durable persistence or authorization behavior.

On a dark-system host, append `?qaTheme=light` to a local page URL to review the light token set. This query is recognized only in a build started with `NEXT_PUBLIC_RDD_VISUAL_FIXTURE=1`; it is not a website theme switch. The override follows the current URL and clears when client navigation drops the query. Open each route directly with the query when comparing themes.

The `/test-supabase` diagnostic page exposes a **Preview error fallback** button only with `NEXT_PUBLIC_RDD_VISUAL_FIXTURE=1`. It throws a synthetic render error so the framework's error boundary and its Try again action can be inspected. It does not test Supabase connectivity.

Use the existing local Supabase workflow and `scripts/qa/local-acceptance.spec.mjs` for database-backed acceptance. The fixture remains useful for light/dark, viewport, keyboard, empty/error, long-name, and local UI-flow inspection, but those observations must be labeled as synthetic in evidence.
