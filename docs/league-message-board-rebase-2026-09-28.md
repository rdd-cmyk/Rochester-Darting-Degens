# League Board rebase verification — 2026-09-28

The Board branch was rebased onto `origin/league-night-mode` at
`6b11f7d77ae719b792cf89caffdc8dcb9bcea712`, including the merged Plan & RSVP work.
The original Board commit is preserved on the local branch
`backup/league-message-board-pre-rebase-20260928`.

## Integration changes

The single Git conflict was in `Navbar.tsx`. Both League Night and League Board
links remain available, with the existing desktop wrapping and mobile menu.
The combined package scripts retain `night:local`, `plan:local`, and Board tools.

The parent added stack selection through `RDD_LOCAL_STACK`. Board setup, preview
and browser tests now clear that setting inside their own processes before
loading the shared environment module. They stay on loopback API 54321 even
when launched from a shell selecting planning. Other processes and stacks keep
their own settings. Auth still defaults to `/matches`; validated Board links
return to their conversation after sign-in. Organizer privileges remain separate
for Board and planning, and no SQL was placed under `supabase/migrations/`.

## Verification

| Check | Result |
| --- | --- |
| Trusted lockfile install | Passed; zero reported vulnerabilities, dependency versions unchanged |
| Application tests and coverage | 281 tests passed in each run; existing coverage gate passed |
| Lint and TypeScript | Passed |
| Production builds | Standard `npm run build` and guarded Board preview build passed |
| Fresh combined SQL rehearsal | 60 Board, 36 League Night and 85 planning checks passed in one new legacy-baseline database |
| Existing Board stack | 60 checks passed with inherited `RDD_LOCAL_STACK=league-planning`; original Board target retained |
| Browser checks | Four scenarios passed: lost-response retry draft preservation, loaded reply retention, organizer hiding, and desktop/mobile navigation among Board, League Night and Plan & RSVP |
| Independent integration review | No actionable findings; read-only source review |

Fresh rehearsal database retained: `rdd_board_rehearsal_1790609155977`. Its tests
roll back synthetic rows. Browser checks create temporary identities and remove
only their own content, preserving interactive demo accounts. Navigation smoke
checks exercise route rendering on the Board stack; parent SQL compatibility is
proved separately by the combined rehearsal, rather than by parent writes in
that browser stack.

All database/browser evidence is local. Hosted schema, backup/restore, migration
history, Auth/RLS acceptance and release gates remain separate from this rebase
and application PR.
