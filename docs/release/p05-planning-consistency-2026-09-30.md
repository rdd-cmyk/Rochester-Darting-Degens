# P05 Night Planning consistency and copy

Status: owner-accepted on 2026-10-01 at 8a73094. CI 36803569793 and Vercel passed.
Baseline release/next at acc01a0. P04 was accepted and P05 authorized on 2026-09-30.
The owner authorized P06 in the acceptance message.

## Presentation and copy

Planning uses the standard shared PageHeader, including loading and signed-out
states, with the approved orange terminal period. The heading stays “Make the
next night happen”; its introduction is “Pick a night. Find a spot. Get the lineup
ready.” Poll instructions say “Each person” rather than “Each profile”; totals use
“1 vote” and “1 person” where appropriate. An initial
read failure now says “Couldn’t load planning. Refresh to try again.”; uncertain
write recovery retains the existing saved-request instructions.

Actions, form controls and panels adopt the accepted shared primitives. Native
submit type/value, disabled flags, pressed states, labels, and handlers are retained.
Poll/editor/RSVP layout spacing uses central tokens. The page opts out of legacy
night.css, preventing its old button/header rules from leaking into accepted pages.
New --rdd-shell-padding uses the established fluid shell expression; it is opt-in
and changes no other page. Domain option rows and responsive night-card columns
remain page-scoped. No scheduling, polling, suggestion-cap, permission, server
privacy, RSVP, recovery, or SQL implementation changes are included.

## Verification and limits

Trusted install passed. It still reports the separately tracked one high and one
critical dependency finding; no dependency changes are part of P05. Required
application tests: 578 passing in 73 files. Coverage: 96.53% statements, 90.90%
branches, 97.76% functions, 97.59% lines. Lint, TypeScript and production build passed. The build uses local defaults
when hosted environment variables are absent; it is not a hosted connectivity test.
Exact source/CI/Vercel identity is recorded in the ignored QA packet.

Existing regression tests exercise open-poll author/tally privacy, own withdrawal,
binary RSVPs, stale ballots/editors, cross-tab recovery and exact retry IDs. Native
submit behavior and organizer editor controls retain their existing tests. Source
review confirms no effects, RPC payloads, timing, permissions or handlers changed.

Loopback synthetic browser evidence: organizer poll and schedule editors opened;
Going saved, showed a pressed state, and refreshed its response/totals; a member
ballot saved and displayed its saved state; suggestion editor opened. Member
open-poll tallies/authors stayed hidden even with a synthetic payload containing
them. Own withdrawal stayed available. Empty and initial read-error states rendered.
Keyboard Tab from Going focused Not going with a visible themed focus outline.
Standalone visible actions meet 44px height. No horizontal document overflow at
320, 390, 768 or 1440px in light and controlled dark-token rendering. Long venue
copy wraps. Shared header/actions/form rules are reused without modifying them;
legacy League Night CSS and P04 scoped CSS are unchanged.

Dark tokens were rendered by temporarily activating the local dark CSS media
blocks, then restoring the exact normal stylesheet before final checks. This is
controlled theme rendering, not evidence of changing the browser/OS preference.
Screenshots and synthetic details remain ignored under .local/page-consistency.
The fixture is in-memory UI evidence; it does not prove hosted RLS, scheduling,
receipt persistence or SQL behavior. Full phone walkthrough, OS dark preference,
200% browser zoom and assistive-technology review remain owner/final-sweep checks.

The initial hosted read-only smoke loaded the existing W6 synthetic night/poll
and the new heading/actions. Exact final CI/Vercel identity and smoke evidence
are recorded in the ignored QA packet. The old W1 /release-readiness diagnostic
requires RDD_INVITES_ENABLED=0, so it reports configuration not ready after W6
enabled invitations; it is not used as fresh server-credential evidence here.
No environment settings were changed. No production deployment, hosted SQL,
credentials, environment configuration, or live-data writes are included. W6/W7
resume gates remain as documented in the pre-consistency checkpoint.
