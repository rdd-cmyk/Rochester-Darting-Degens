# Rivalry challenges during League Night

2026-10-17: Current and upcoming scheduled nights can receive challenges until
12 hours after their scheduled start, matching the League Night feed window.
New pending invitations expire at the earlier of seven days after creation or
the end of that window. Existing stored expiry times are preserved. Cancelled
nights stay unavailable; RSVP, attendance, ratings and accepted-series rules
are unchanged.

The selector uses server time and the same strict cutoff as the RPCs. The
function-only upgrade and rollback are in `supabase/tests/fixtures/`; neither
is in automatic migrations. Production activation is not included.

Verification: locked trusted install; 697 tests in 87 files; coverage (95.43%
statements, 88.78% branches); lint; typecheck; production build. The install
reported eight existing high-severity dependency audit findings; dependency
changes were outside this fix. Full local Docker integration was unavailable
because Docker Desktop was stopped. The focused transactional synthetic SQL
regression passed on RDD Release Testing (`uepayhdrgzrxhkqbwebo`), first with
the replacement functions rolled back, then after the authorized Preview-only
function upgrade. Synthetic users, nights and challenges were rolled back.
Checks cover current-night listing, creation and recipient acceptance, exact
12-hour exclusion/expiry, upcoming nights and cancellation. The UI regression
checks current/future options, stale options at/beyond cutoff and submission.

Release Testing received `rivalry_current_night_window`; production was untouched.
The rollback fixture restores the three prior function definitions without
changing stored data. Browser/player acceptance remains a separate check.
