# Organizer access tools: upcoming release

Prepared on `feat/rivalry-power-rating`, 2026-10-04.

Follow-on invitation search is documented in the
[convenience features plan and verification](league-convenience-features-plan-2026-10-04.md).
Its additive `invitation_search.sql` fixture follows this document's organizer
fixture and remains subject to the same hosted release gate.

## Behavior

League Board → Organizer tools now offers a league-member chooser and Grant
access. Eligible active members include people who have never requested Board
access, pending requests, and people whose Board access was paused. Already
approved members, organizers, banned accounts, and revoked league members are
excluded. A grant creates or restores approved **member** access; it cannot
assign organizer authority. The candidate list refreshes after a confirmed grant.

The Invitations page shows organizers **All league invitations**, with sender
names, status filters, counts, and pagination. Ordinary members still see their
own invitations. Organizers can inspect invitations from other senders; only
the original sender can resend or revoke one. Name disclosure preferences are
respected. Admission tokens and delivery request identifiers are never returned.

Organizer authority uses approved `board_members` with `role='organizer'`,
together with active league membership and an account that is not banned.
Editable profile or Auth metadata cannot supply this authority. Invitation
listing uses only the actor verified by server-side `Auth.getUser`.

## Database rollout

The additive update is
[`organizer_access_tools.sql`](../supabase/tests/fixtures/organizer_access_tools.sql).
It adds `board_access_candidates`, `board_grant_access`, and the service-only
`invite_list`. It replaces no existing invitation mutations or admission/RLS
policies and is safe to reapply. It belongs after the existing Board,
invitation, and parent-admission fixtures. No SQL is placed under
`supabase/migrations/`.

**Hosted SQL was not applied or verified for this update.** Follow the
[hosted release gate](supabase-github-integration-release-gate.md): refresh the
intended target's schema, policies, and migration history; prove a recoverable
backup; rehearse this additive fixture against that baseline; review rollback;
and obtain separate approval for the hosted change. Do not replay historical
baseline fixtures into an existing hosted project.

Apply the reviewed additive SQL before accepting these features on Preview or
production. Until then, the app retains sender-only invitation history if the
new RPC is absent and keeps the existing Board moderation tools available.
Grant access reports that it is not available yet. Authorization and network
errors never trigger an invitation fallback that widens scope.

Application rollback can use the previous branch revision while retaining the
new functions: original workflows remain compatible. If function removal is
needed, roll back the app first, then remove only these three new signatures
through the reviewed database procedure. Confirmed membership grants are
retained; undoing an individual grant is an organizer decision through existing
pause-access controls.

## Local verification

- Locked dependency installation, all 633 application tests, coverage, lint,
  typecheck, and production build passed. The install reports the existing five
  high-severity dependency findings; this change does not modify dependencies.
- All 44 pgTAP permission checks passed in a newly created temporary database.
  The fixture was applied twice successfully. Checks cover ordinary and
  anonymous denial, forged metadata, active/banned/revoked membership, grants
  without requests, retries, role preservation, organizer invitation scope,
  sender ownership, pagination, and credential exclusion.
- Production-build browser checks used synthetic requests and accounts in both
  themes at 1440, 390, and 320 pixels. Organizer grants, sender disclosure,
  sender-only actions, and ordinary-member scope passed with no page errors
  or horizontal overflow. These checks do not establish hosted API acceptance
  or real email delivery.

Run the database rehearsal with `node scripts/rehearse-organizer-tools.mjs`.
It requires the inspected, loopback-only local `rdd-release-w3` database
container and creates its own temporary database. It reads only Auth schema
DDL from the existing database and does not change its users or league data.
The temporary database is retained for inspection. Local invitation setup now
also installs this additive fixture.
