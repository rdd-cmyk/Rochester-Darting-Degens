# Independent review of the five league convenience features

Review baseline: `79a5df0` on `feat/rivalry-power-rating`, covering the changes
since `1950d47`. The owner requested independent agents, primary verification
of their findings, and fixes only for verified issues.

Three separate read-only reviewers covered invitation search; Run it back and
opponent sorting; and calendar controls plus Challenges waiting. No reviewer
edited source or changed hosted data. The primary inspected the related source,
reproduced the reported failure, implemented the fix, and reran checks. The
reporting reviewer then independently checked the fix and regression tests.

## Verified and fixed finding

**P2: slow reads could prevent Challenges waiting from ever updating.**
In the original `components/rivalries/ChallengesWaiting.tsx`, the visible-page
timer started a new read every 20 seconds. Each read invalidated all previous
read generations. A successful response taking longer than that interval was
discarded. Repeated slow reads left the panel checking indefinitely, or showing
an old count/error.

The primary reproduced this with the actual rendered component: start a
deferred read, advance 25 seconds, then resolve the original read with one
incoming challenge. Before the fix, the panel still displayed Checking your
challenges and had no Review challenge link. The regression assertion failed.

The fix allows one in-flight read per mounted user's panel. Poll and focus
events do not invalidate it. Cleanup still invalidates abandoned results and
releases the request slot; request-specific completion cannot release a newer
read's slot. Account-change protection is retained. Slow-read/poll-resumption
and Strict Mode cleanup tests pass after the fix, alongside the existing
account-switch, empty, error/retry and incoming-count tests.

## Other review outcomes

- Invitation search: no actionable findings. Reviewed verified actor selection,
  authorized history scope, literal matching, disclosed sender names, paging,
  stale requests, account changes and compatible missing-function fallbacks.
- Run it back: no actionable findings. Reviewed both participants, copied terms,
  fresh challenge identity, exclusion of the original night, upcoming-night
  selection and existing durable operation recovery.
- Rivalry sorting: no actionable findings. Reviewed eligible competitive singles,
  full-history ratings, provisional context, preserved selection and empty states.
- Add to calendar: no actionable findings. Reviewed the owner-accepted Google
  link, two-hour default, UTC/DST handling, ICS escaping/folding and revisions,
  clipboard/download recovery, RSVP placement and stable Home action positions.

The independent focused suites passed 36 invitation tests, 50 rivalry tests and
15 existing calendar/waiting tests. The primary's waiting regression suite then
passed all 7 tests. The fix re-review reported no additional findings.

## Final verification and boundaries

The primary reran the locked install, all **663 tests in 85 files**, coverage,
lint, TypeScript checks, production build and diff checks successfully. Coverage
remains 96.36% statements, 90.05% branches, 97.83% functions and 97.55% lines.

Production-build browser checks with synthetic accounts/responses passed for
all five features in both themes at widths 1440/390/320. The calendar follow-up
checks also covered Home trigger-position stability at width 448, RSVP,
two-hour Google dates and downloaded end time, and copy/download recovery.
No page errors or horizontal overflow were observed.

SQL authorization and search behavior were reviewed from source; pgTAP and
hosted database flows were not rerun in this review. The invitation-search
fixture still requires separately approved hosted activation. No database,
schema, invitation/email delivery or calendar-account changes were made.
Synthetic browser checks do not verify external provider saves or live email.
