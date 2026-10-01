# Shared page-frame preview publication

The owner authorized preview publication on 2026-10-01. Application commit
`020136e5deec6af2475236d189917c9cc41f40d8` on `release/next` contains the
shared frame correction, Rivalry Room dialog focus return, regression guards,
and the preceding owner acceptance/review notes. No unrelated commits were
ahead of the remote baseline `8b1ed75`; the pushed tip matched local HEAD.

Local trusted install, 585 tests in 74 files, coverage, lint, typecheck and
production build passed again before committing. Coverage remained 96.53%
statements, 90.90% branches, 97.76% functions and 97.59% lines. The two existing
dependency findings remain in the separately scoped release gate.

[Application CI](https://github.com/rdd-cmyk/Rochester-Darting-Degens/actions/runs/36899886634)
passed on that exact application commit, including trusted install, tests,
coverage, lint, typecheck and build. The scheduled cleanup monitor is deliberately
skipped for this push; no new cleanup rehearsal is claimed.
[Vercel deployment](https://vercel.com/tims-projects-b7b7f743/rochester-darting-degens/j19GJBDPQmqDmnPaS7W7HsL7udoF)
is Ready, environment Preview, source `release/next` at `020136e`; its build
completed and outputs deployed. The stable
[preview](https://rochester-darting-degens-git-rele-684da0-tims-projects-b7b7f743.vercel.app/)
serves the new shared shell/header. Production still points to `main` at
`690a01b`; no production promotion or Supabase change was performed.

Read-only hosted geometry checks sampled Home, Matches, Stats, League Night,
Planning, Rivalry Room, Players, Board and Solo at 1280px and 390px. All nine
have matching header geometry within each viewport, the shared responsive
font size, and no document-width overflow. Samples include loading and
authenticated render states; they are not a new full functional walkthrough.
Both hosted Rivalry Room dialogs returned focus to their opener after native
Escape and Close (four checks). No challenge, invitation or game was submitted.
The initial `/league-board` probe was a missing-route check; the actual `/board`
route was then checked through navigation and used for the nine-page comparison.

Ignored evidence: `.local/page-consistency/shared-frame-hosted-checks.json`,
`shared-frame-hosted-desktop.jpg`, `shared-frame-hosted-mobile.jpg`, and
`shared-frame-publication.json`. The publication packet records the final
documentation tip and its own CI/Vercel identities after verification; those
identities are distinct from the application commit above.

Combined owner appearance/phone acceptance and the focused W6 journeys remain
open. W7/W8 have not resumed. The original SQL hashes, backup/rehearsal records,
dependency/credential controls and final rollback rehearsal requirements remain
as described in the [release plan](../release-next-readiness.md). The earlier
candidate JSON is a dated `8b1ed75` snapshot; use this publication record for
the current application revision.
