# Invitation registration rebase verification — 2026-09-28

The user authorized local commits, publication of `invite-only-registration`,
and a PR into `origin/league-night-mode`, with rebase and conflict repair first.
The original local commit `a0d7183` is retained on
`backup/invite-only-pre-league-night-rebase-20260928`. The rebased base is
`0d40f83ad68eef9ecda6638d1b84d95cb90c0429`, including League Night, planning,
Board and Board read-recovery fixes. The rebased invitation commit is `adc7fa9`.

## Integration fixes

The two Git conflicts were in `app/auth/page.tsx` and `app/globals.css`.
The invitation-only auth page retains the parent's validated Board return
destinations, both after sign-in and when already signed in. Both scoped CSS
blocks remain. Navbar links, homepage planning/Board previews and all local
package scripts from the parent are preserved.

The parent's elevated League Night/planning RPCs bypass table RLS. Therefore
the invitation table policies alone could not prevent an unfinished or revoked
account from calling them. `invite_parent_admission.sql` moves seven parent
implementations into the inaccessible private schema, revokes client execution
there, and preserves their public named arguments/defaults in admission-checked
wrappers. Direct night/attendance reads require admission. Board membership and
organizer helpers also require admission, while keeping separate Board approval
and planning organizer grants. The Board access-request write is gated too.
Existing ownership, revisions, payload-aware retries and organizer checks remain
in the parent implementations. All SQL stays deferred outside migrations.

The isolated invitation setup can add missing parent fixtures to its older
local stack without replaying existing tables or invitation records. It then
installs the compatibility fixture once. The invitation integration runner now
saves matches through the parent's atomic RPC, respecting direct-write enforcement.

## Verification

| Check | Result |
| --- | --- |
| Trusted locked install | Passed; zero reported vulnerabilities |
| Application tests | 344 tests across 42 files passed |
| Coverage | Passed inherited coverage thresholds |
| Lint / TypeScript / production build | Passed |
| Invitation integration | 15 groups passed on the combined local schema |
| Independent-review database regressions | Two groups passed |
| Combined parent admission | Four groups passed: saving/attendance/replay/ownership, planning organizer isolation, separate Board approval, and provisional/revoked denial |
| Browser acceptance | Three invitation/join/revoke/password-recovery scenarios passed |
| Auth conflict regression | Board return paths tested for fresh sign-in and already signed-in accounts |

The combined admission suite deliberately supplies historical profiles and
organizer grants to an unadmitted account and verifies that every affected
RPC and direct table read denies it. It repeats those checks after revoking an
admitted organizer, and checks that private implementations cannot be executed
by clients. Positive checks use actual Auth sessions and the public API.

All database, Auth, email and browser evidence is local. Hosted schema/Auth
changes, grandfathering, provider configuration and production acceptance remain
separate release work. This PR is not authorization to merge or deploy those
database changes; the existing release gate still applies.
