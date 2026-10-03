# Invite-only league registration

Status: implemented and locally verified; hosted rollout remains deferred.
See [implementation handoff](invite-only-registration-handoff.md) for actual behavior,
verification, implementation choices, and production configuration. The design below
records the original proposal; the handoff owns current implementation status.
Prepared: 2026-09-27.
Branch: `invite-only-registration`.
Worktree: `F:\RDD\Rochester-Darting-Degens-invite-only`.
Original proposal base: local `main` at `690a01b`. The implementation was
subsequently rebased onto refreshed `origin/league-night-mode` at `0d40f83`
on 2026-09-28; see the handoff and rebase verification for the combined scope.

## Goal and difficulty

Replace public account registration with invitations sent by existing users.
A member enters an email address, the recipient receives a personalized join
link, and the app records who invited them and whether they completed joining.

This is a moderate feature on the existing Next.js/Supabase stack. The form
and tracking page are straightforward. The substantial work is preventing
direct signup bypasses, proving access to the invited inbox, and recovering
cleanly when email delivery or account creation only partly succeeds.
Planning estimate: roughly 3–5 focused engineering days for implementation,
local verification, and review; sender-domain setup and hosted acceptance can
add elapsed time. This is an estimate, not a delivery commitment.

## Observed baseline

- `app/auth/page.tsx` exposes public signup and calls `supabase.auth.signUp`.
  It also owns password sign-in and recovery initiation.
- `app/auth/verify-email/page.tsx` is an informational screen, not an invite
  acceptance handler.
- `lib/supabaseClient.ts` is a browser client using the public key. Privileged
  invitation operations need a separate server-only client.
- `app/components/Navbar.tsx` can upsert a profile from editable Auth metadata.
  A profile or metadata field must never establish admission or organizer role.
- Local `supabase/config.toml` enables signup and disables email confirmations.
  Those are local settings; hosted Auth, SMTP, and policies were not inspected.
- The checked-in schema fixture permits authenticated users to read league
  tables and write their own profiles/matches. It has no league admission gate.
- The separate message-board worktree contains `board_members` with organizer
  approval in `supabase/tests/fixtures/league_board.sql`. That work is absent
  from this branch's base and must be reconciled before eventual integration.

Existing instructions in `AGENTS.md`, the advanced-statistics roadmap,
`docs/info-registry.md` (RDD-INFO-003), and the
[Supabase release gate](supabase-github-integration-release-gate.md) apply.

## Proposed first-version behavior

1. Existing admitted users see an **Invites** navigation item. The page has
   one email field and **Send invitation**.
2. The email says who invited the recipient to Rochester Darting Degens and
   includes a unique, expiring **Join the league** link.
3. The join page identifies the league and inviter, masks the target email,
   and offers **Send verification code**. This sends a fresh code only to the
   stored invited address; the visitor cannot change that address.
4. The recipient enters that code, chooses a password, and supplies the same
   required first name, last name, and display name as today's signup.
5. Successful onboarding activates league access and marks the invite accepted.
   Existing sign-in and password recovery continue to work.
6. A visitor without an invitation sees: **Joining is by invitation. Ask a
   league member to invite you.** Remove the public signup form.

The fresh code matters: a unique link is still a transferable secret. Locking
an email field does not stop a person holding a forwarded link from registering
as that address. A fresh inbox challenge prevents the forwarded link alone
from being enough. It cannot prevent someone deliberately sharing both the
link and the later code, or someone with access to the recipient's mailbox.

Suggested defaults, adjustable before implementation:

- Every active admitted user may invite, including newly joined users.
- Existing legitimate accounts are grandfathered at a reviewed rollout cutoff;
  nobody needs to invite existing members again.
- Invitations expire after 7 days. Verification codes expire after 10 minutes,
  with at most 5 guesses and a 60-second resend cooldown.
- Start with 5 new invitations per inviter per day plus recipient/IP/global
  abuse limits enforced by shared server-side storage.
- Members see only their own outgoing invitations. An organizer-wide view is
  optional follow-up scope, not needed for the first version.
- Admission does not automatically approve League Board membership or grant
  organizer permissions. Preserve that separate policy when branches integrate.
- One league only; no bulk invitations, contact import, or multi-league roles.

## Invites page

Show counts for **Pending** and **Accepted**, filters, and a paginated list:

| Recipient | Sent | Status | Joined | Actions |
| --- | --- | --- | --- | --- |
| Synthetic invited address | Date | Pending / Accepted / Expired / Revoked | Date or dash | Resend / Revoke where allowed |

Keep delivery information separate: **Sending**, **Sent**, **Send failed**, or
**Delivery unconfirmed**. A mail provider accepting a request does not prove
delivery or acceptance. Only show delivered/bounced when supported by a verified
provider event. Empty state: **Invite someone to join your next league night.**

Resend rotates the link and invalidates outstanding codes. Revoke invalidates
both immediately. Neither action removes an already accepted member. For an
already-active recipient, return a neutral message without sending another join
email or exposing account details. Duplicate invitations must not disclose a
different inviter's identity or history.

## Proposed architecture

Use application-owned invitations and inbox verification, with Supabase Auth
continuing to own credentials and sessions. Keep public Auth signup disabled;
after verification, a server-only administrative operation provisions the user.
Do not expose a built-in Auth invite link as the final join credential: its
bearer-link behavior alone does not satisfy the forwarded-link requirement.

The administrative `createUser` API supports server-side provisioning, but does
not send confirmation mail. Our invitation and code emails therefore need a
transactional email sender. Select a provider based on existing authorized
infrastructure; verify sender domain, production credentials, quotas, and failure
reporting before release. Supabase's default email service is not a production
delivery solution. Its custom SMTP configuration serves Supabase Auth mail;
application-owned mail also needs a server integration with the chosen sender.

Suggested routes and modules:

- `/invites`: authenticated send form and outgoing history.
- `/join`: invitation landing, inbox challenge, and onboarding.
- Server endpoints for create/list/resend/revoke invitations, request/verify
  code, and finish onboarding. GET requests never accept an invite or send mail.
- Server-only Auth admin client, invitation service, and email adapter.
- A transaction/RPC for acceptance, profile creation, and league admission.

Suggested data model (names provisional):

| Record | Essential fields and responsibilities |
| --- | --- |
| `league_invites` | ID, inviter user ID, normalized target email, token digest/version, lifecycle state, created/sent/expiry/accepted/revoked timestamps, accepted user ID, stable request ID |
| Private verification challenges | Invite/version, keyed code digest, expiry, attempts, consumed timestamp, browser-bound verification grant; never readable by clients |
| Private delivery attempts | Invite/version, request/provider ID, attempt time, delivery state, safe error category; support retry reconciliation |
| `league_members` | User ID, active/revoked admission status, source invite or grandfathered origin, admission timestamp; server-controlled |

Use a partial unique constraint for one open invite per normalized email,
closing expired records transactionally before replacement. Normalize whitespace
and email casing consistently with Auth; do not strip plus tags or dots.
Retain earlier expired/revoked invitations as history. Keep invite emails out of
public profile data. Define retention for old recipient addresses and delivery
records before production; clear consumed/expired verification material promptly.

## Security and consistency requirements

- Disable open signup in Auth itself, not just the page; test direct requests
  using the public key and audit all enabled account-creation providers.
- Verify the sender's live Auth identity and active league admission on every
  mutation. Never trust submitted inviter IDs, roles, or user metadata.
- Use at least 32 cryptographically random bytes for invitation secrets and
  store only their digest. Keep short verification codes protected with a keyed
  digest, bounded attempts, expiry, and constant-time comparisons.
- Bind verification and final onboarding to the invite, its version, its stored
  email, and the initiating browser challenge. Recheck expiry/revocation at
  completion. The server chooses the account email, never the request body.
- Use HTTPS, fixed trusted application origins, restrictive referrer policy,
  no-store responses, and no token/email logging or third-party analytics on
  join/auth screens. Prefer fragment-to-POST token handoff and clear the fragment
  immediately. Never include invite secrets in outbound links or error reports.
- Existing accounts must sign in as the matching user; never overwrite their
  password or attach another account just because a link/code was presented.
- RLS exposes only safe invitation fields to their inviter; token digests and
  challenge data remain private. Clients cannot change lifecycle/admission state.
- Require active league admission in existing protected data policies, retaining
  current ownership restrictions. Update policies rather than adding permissive
  alternatives that accidentally leave the old access path open. Review views,
  RPCs, storage, and future Board integration too.
- Reserve acceptance with a stable operation ID before Auth provisioning.
  Auth API calls and application SQL are not one atomic transaction: persist
  provisioning progress and reconcile unknown outcomes before retrying. A newly
  created but unfinished account must have no league access, even if it recovers
  a password or obtains a session. Avoid creating duplicate users, overwriting
  unrelated accounts, or deleting accounts as blind compensation.
- Atomically finalize admission, profile, and accepted status under a locked
  invite row. Repeated completion returns the same success. Concurrent revoke
  must either win before finalization or see an already-accepted result.
- Reserve sends before contacting the mail provider. Recover timeouts using
  stable delivery IDs/provider reconciliation where available; distinguish
  uncertain delivery from definite failure. Resend invalidates older versions
  even if an old email arrives later. Durable queued raw mail/token material,
  if needed, must be encrypted and removed after delivery handling.

## Implementation sequence and acceptance

1. **Prove the critical flow locally.** With signup disabled, verify server
   provisioning, inbox-code verification, session creation, existing-account
   handling, and denied access for unfinished accounts. Use synthetic addresses
   and a local mail sink. Resolve the approach before building polished screens.
2. **Data and server operations.** Add local-only SQL fixtures, RLS/admission
   policy changes, invite/challenge lifecycle, email adapter, idempotency, and
   recovery. No deployable SQL under `supabase/migrations/` during development.
3. **User experience.** Add Invites and Join pages; remove public signup; preserve
   sign-in/recovery; gate Navbar profile initialization until admission is active.
4. **Focused verification and review.** Exercise the matrix below, then run the
   repository implementation checks: `npm run ci:install`, `npm test`,
   `npm run test:coverage`, `npm run lint`, `npm run typecheck`, `npm run build`.
5. **Separately authorized rollout.** Refresh hosted schema/policies/Auth settings,
   migration history and backup; rehearse backfill and rollback; reconcile the
   Board branch; verify mail configuration and approved redirect origins. Follow
   the existing release gate before publishing or applying hosted changes.

Required acceptance cases:

- Ordinary signup and alternate account-creation bypasses fail; existing login
  and recovery still succeed.
- Only admitted users can send; a revoked user cannot send or access league data.
- A forwarded link alone, changed email, wrong signed-in user, bad/expired code,
  revoked invite, expired invite, and superseded link cannot join.
- A valid recipient joins exactly once; repeat submits and concurrent accepts
  create one admission and one accepted record with correct inviter attribution.
- Timeout after Auth creation, after database commit, and after mail submission
  recovers without duplicate accounts, false success, or leaked access.
- Another user and an anonymous caller cannot read invitation addresses/history
  or write admission state; forged metadata cannot grant privileges.
- Provider rejection, duplicate target, rate limits, resend, revoke, and empty
  history have useful UI states. Email scanner GETs cannot consume invitations.
- Mobile/keyboard onboarding and history work; links can be opened on a different
  device from the one the sender used; verification remains browser-bound.
- Grandfathered users retain their profiles, matches, and access; provisional
  accounts do not gain access through recovery or legacy RLS paths.

Deploy the restrictive data foundation and backfill existing legitimate users
before enabling new provisioning. Close public signup at a coordinated cutoff
and reconcile accounts created during the transition. Verify using synthetic
accounts against an explicitly authorized hosted target. If rollout fails,
disable new invite issuance and keep existing login available; do not restore
public signup or drop restrictive policies as an automatic rollback.

## Sources and verification boundary

Primary Supabase documentation consulted on 2026-09-27:

- [General Auth configuration](https://supabase.com/docs/guides/auth/general-configuration)
  documents disabling public signup and email confirmation settings.
- [Administrative account creation](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
  documents server-only account creation and the absence of automatic email.
- [Auth users and invitations](https://supabase.com/docs/guides/auth/users)
  describes the built-in invitation behavior.
- [Email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
  discusses single-use links and email prefetching.
- [Production email/SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
  explains the default sender's restrictions and production email configuration.

The proposal was subsequently implemented under the user's "Build it" instruction.
The handoff records local application, Auth, database, synthetic email and browser
verification. It does not establish working hosted delivery or authorize rollout.
