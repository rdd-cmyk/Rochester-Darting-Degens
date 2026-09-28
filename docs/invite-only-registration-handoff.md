# Invite-only registration handoff

Implemented and locally verified: 2026-09-27.
Branch: `invite-only-registration`.
Worktree: `F:\RDD\Rochester-Darting-Degens-invite-only`.
Base: `690a01b`. Work remains local and uncommitted; nothing pushed or deployed.

## Delivered behavior

- `/auth` offers sign-in and recovery, with an invitation-only explanation.
  Existing sign-up links now say sign in.
- Active league users see **Invites** in navigation. `/invites` sends email,
  shows pending/accepted counts and paginated/filterable history, and supports
  deliberate resend and revoke. Sending and acceptance are separate states.
- `/join` consumes a secret from the URL fragment, immediately clears it from
  the URL, and requires an explicit request for a fresh 8-digit inbox code.
  The recipient address is server-selected and cannot be edited. Link possession
  alone is insufficient. Codes expire after 10 minutes and allow five guesses.
- Invitations last seven days. Resend replaces the link and outstanding code;
  revoke prevents acceptance. Sender, recipient, IP and shared limits use the DB,
  including five new invitations per sender per day.
- Account provisioning is server-only. A separate `league_members` admission
  gate prevents provisional/revoked accounts from accessing league tables or
  statistics, including through password recovery or editable Auth metadata.
- Acceptance atomically creates admission/profile and marks the invite accepted.
  Stable operations reconcile an account already created by an interrupted attempt.
  Existing accounts require matching sign-in and keep their password/profile.
- Unknown send results are shown honestly. An uncertain mutation retry preserves
  the original request/payload and does not silently send another email.
- New auth/invitation pages do not mount telemetry SDKs on direct entry; existing
  telemetry filters also discard their events. Join links use fragments,
  restrictive referrer headers, and explicit POSTs, so scanners cannot accept them.

League admission does not imply organizer status or Board approval. The separate
Board branch has not been merged here; its policy must be preserved when integrating.

## Files and boundaries

| Area | Source |
| --- | --- |
| Sender/recipient UI | `app/invites/`, `app/join/`, `app/auth/page.tsx` |
| Server API and mail adapter | `app/api/invites/route.ts`, `lib/invites/server.ts` |
| Validation and browser requests | `lib/invites/shared.ts`, `lib/invites/client.ts` |
| Deferred database changes | `supabase/tests/fixtures/invite_only_registration.sql` |
| Isolated local stack/preview | `scripts/invites-local.mjs` |
| Full Auth/RLS/failure verification | `scripts/qa/invites-integration.mjs` |
| Review regressions | `scripts/qa/invites-review.mjs`, `app/invites/page.test.tsx`, `app/join/page.test.tsx` |
| Browser acceptance | `scripts/qa/invites.spec.mjs`, `scripts/qa/invites.config.mjs` |

The only added runtime package is `server-only@0.0.1`, which guards privileged
imports. No dependency modernization was bundled. `agentRules: false` stops
Next's development server from rewriting the maintained root `AGENTS.md`.

## Local preview and repeatable verification

Use this feature's commands; the historical general-purpose local wrappers point
at another worktree's Supabase stack. Do not replay these stricter policies there.

```powershell
npm run ci:install
npm run invites:start:local
npm run invites:setup:local
npm run invites:preview:local
```

The preview is `http://127.0.0.1:3102`. Supabase uses `127.0.0.1:56521` and its
own `rdd-invites-loopback` Docker network. The synthetic application email sink
is `http://127.0.0.1:56530/messages`; Auth recovery mail is captured by the local
Supabase inbox at `http://127.0.0.1:56524`. Only `@example.test` recipients can
receive application mail locally. No external mail provider is contacted.

The integration/browser runners create synthetic accounts and admissions in this
isolated stack. Their known synthetic passwords are in the runner source. They
retain their synthetic data for investigation; they never export real accounts.
The preview creates an ephemeral HMAC secret, so restarting it invalidates older
local links/codes. Resend creates a working replacement. Stop with
`node scripts/invites-local.mjs stop` when finished (volumes are retained).

With the preview running, run `npm run test:invites:local`. For browser checks,
set `RDD_PLAYWRIGHT_ROOT` to an installed Playwright directory and run that
package's `cli.js test -c scripts/qa/invites.config.mjs`. This reuses the existing
QA runtime rather than changing the application lockfile for browser tooling.

For local function development only, `node scripts/invites-local.mjs refresh-functions`
refreshes the known service/cleanup function definitions without replaying tables.
It is not a general database migration mechanism. `setup` refuses a partial schema.

Stop this worktree's preview before another clean install on Windows: running
Next/PostCSS processes hold native dependency files open.

## Verification results

All evidence below is local to this worktree; hosted behavior is not verified.

| Check | Result |
| --- | --- |
| Locked trusted install | Passed; audit reported zero vulnerabilities at this run |
| Application tests | 210 passed across 25 files after clean install and review fixes |
| Coverage gate | Passed: 99.28% statements, 93.25% branches, 100% functions/lines for the repository's existing stats/match-state coverage scope |
| Lint / TypeScript | Passed |
| Production build | Passed, including `/api/invites`, `/invites`, `/join`; build used unset-hosted-env local defaults, not hosted credentials |
| Local integration | 15 groups passed against isolated Supabase |
| Review regressions | Two fault/race cases passed against isolated Supabase; focused client tests passed |
| Browser acceptance | Three scenarios passed, including a 390px dark-mode recipient screen |
| Visual review | Desktop sender/history and mobile join screenshots inspected; no horizontal overflow |

Integration groups cover disabled direct signup, caller authorization, direct RPC
denial, RLS/forged metadata, match ownership/statistics, private invite history,
payload-aware retries, forwarded-link and email-tampering resistance, acceptance,
revocation, replacement/expiry, recovery after Auth creation, existing-account
identity, guessing limits, expired codes, failed/uncertain mail, daily limits,
simultaneous acceptance and membership revocation. Browser checks cover wrong-code
correction and successful joining, sender tracking/revocation, and password recovery
plus session refresh with public signup disabled.

The local test exposed that the CLI's `[auth.email].enable_signup=false` disables
email login. The corrected configuration keeps the email provider enabled and
sets `[auth].enable_signup=false` globally. Both disabled registration and working
email sign-in/recovery were then exercised successfully.

An independent read-only review identified three defects, all reproduced or
confirmed in the local implementation and fixed: a fresh inbox challenge could
silently reuse an earlier password after interrupted account creation; an expired
invite could be resent to an already admitted member and falsely marked accepted;
and the sender history could remain visible after an account changed in another
tab. A separate local retry test exposed a form that remained locked after a
correctable code error; that was fixed as well. The two database cases are covered
by `node scripts/qa/invites-review.mjs` against the isolated stack; the two UI
cases have focused tests. These checks are local only.

Screenshots remain local under `.qa-artifacts/invites-*.png`; they contain only
synthetic data. No hosted test is claimed.

## Production configuration and release

Implementation uses Resend's HTTPS API for application invite/code emails. This
choice is isolated in `sendMail`; existing Supabase Auth recovery mail continues
through the Auth project's separately configured SMTP provider. Provider account,
verified sender domain, quotas, and delivery acceptance have not been configured
or tested here. Confirm provider suitability before enabling external sends.
See [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email)
and [idempotency behavior](https://resend.com/docs/dashboard/emails/idempotency-keys),
consulted 2026-09-27. The UI's **Sent** means provider submission was acknowledged,
not proof of inbox delivery; delivery webhooks are not part of this version.

Required server environment variables (store secrets in hosting configuration,
never in tracked files or `NEXT_PUBLIC_` variables):

| Variable | Purpose |
| --- | --- |
| `RDD_INVITES_ENABLED=1` | Explicitly enables API once schema/email configuration is ready; otherwise it fails closed |
| `RDD_INVITE_ORIGIN` | Exact HTTPS application origin, no path; origin checks and email links use this value |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged key matching the existing public Supabase project URL |
| `RDD_INVITE_SECRET` | Stable cryptographically random secret, at least 32 bytes recommended; shared by all app instances |
| `RESEND_API_KEY` | Server-only email API credential |
| `RDD_INVITE_FROM` | Verified sender identity such as `League <invites@your-domain>` |

Existing `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` remain required.
Do not set `RDD_LOCAL_PREVIEW` in production. Rotating `RDD_INVITE_SECRET` invalidates
outstanding invitations/codes; coordinate replacement messages if rotation is needed.
On Vercel the overwritten `x-vercel-forwarded-for` header supplies the hashed IP
bucket. Other hosting defaults to a conservative shared IP bucket until a trusted
proxy integration is explicitly implemented. Do not accept arbitrary forwarded IPs.

Follow [the existing release gate](supabase-github-integration-release-gate.md):

1. Refresh hosted schema, RLS, enabled Auth providers, migration history and backup.
   Rehearse the reviewed additive fixture against a representative database. The
   baseline fixture must never be deployed over existing hosted tables.
2. Establish the legitimate existing-account cutoff/list and backfill those IDs
   into `league_members` with `status='active'` and null `source_invite_id`. The
   fixture deliberately admits no existing users automatically. Rehearse this
   with protected-policy installation so existing members are not locked out.
3. Disable public signup globally while preserving the email login provider;
   audit alternate providers. Coordinate the cutoff and account reconciliation.
   Configure approved recovery URLs and working production Auth SMTP separately.
4. Configure the server variables, verified sender, and approved target origin.
   Integrate/review Board rules separately; do not infer Board approval from an invite.
5. After explicit hosted rollout authorization, apply only approved SQL, activate
   the application, and repeat acceptance with controlled hosted test accounts.
   There is deliberately no deployable SQL in `supabase/migrations/` in this work.
6. Arrange an approved daily server-only call to `public.invite_cleanup()` to
   discard expired challenge/profile/code material and stale rate buckets and mark
   expired invites. No scheduled job was created. Agree the retention period for
   recipient email/history and request records before go-live; these remain until
   an approved retention operation, so replay IDs are not silently forgotten.

If rollout fails, disable invitation issuance and preserve admission data and
existing login. Do not reopen public registration or remove restrictive policies
as an automatic rollback. Retained provisional accounts can finish through their
invitation/recovery flow; do not blindly delete accounts after an unknown result.

Current release boundary: local implementation is complete. Hosted database/Auth
changes, grandfathering, sender configuration, scheduled cleanup, production
acceptance, branch publication and deployment remain outstanding release work.
