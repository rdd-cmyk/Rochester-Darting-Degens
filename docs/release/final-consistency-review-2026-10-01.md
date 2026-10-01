# Final combined consistency walkthrough and evidence review

Reviewed: 2026-10-01. Branch: `release/next`. Application candidate:
`8b1ed75ec33bbebc2b015894a39b7d3b0ce44a8a`.

All P01-P24 page packages are owner-accepted. The combined walkthrough and
evidence reconciliation have been performed. Final sweep acceptance remains
open for any outstanding human acceptance. The keyboard-focus finding below
has been corrected and verified locally after owner authorization. The published
candidate above predates that correction. This record does not close W6/W7 or
authorize W8.

Subsequent owner request: [shared-frame audit/correction](shared-page-frame-2026-10-01.md)
records the current working-tree follow-up for one consistent cross-page layout.
The exact-candidate evidence below remains a historical baseline; publication
and owner appearance review of that follow-up remain separate.

## Candidate and technical evidence

The candidate's required install, 578 tests across 73 files, coverage, lint,
typecheck and production build passed as recorded in the
[P21-P24 record](p21-p24-consistency-2026-10-01.md). Coverage was 96.53% statements,
90.90% branches, 97.76% functions and 97.59% lines.
[CI 36875808556](https://github.com/rdd-cmyk/Rochester-Darting-Degens/actions/runs/36875808556)
was rechecked and succeeded for this exact SHA. Vercel Preview
`6LmqWgafZuvYk97jLbRMAfBnGfhj` was Ready for the same SHA in the batch's
publication evidence; no new hosted browser pass was completed during this sweep.

No application code changed during this review. The normal stylesheet was
restored after controlled dark-token checks and verified unchanged after the
crash. The broad suite was therefore retained for the exact candidate rather
than unnecessarily repeated. Focused recovery, planning, Board and game
regression/correction checks passed: 19 tests in six files.

The [post-consistency candidate addendum](post-consistency-candidate-2026-10-01.json)
compares this app with checkpoint `351a4b0253f2c7f05d7a70708597d1c847977c65`:
64 changed paths; no changes under `supabase/`, `lib/`, `app/api/`, or either
package manifest. All 11 W5 canonical-LF SQL hashes and all four W6 supplement
SQL/test hashes match their recorded manifests. This preserves the earlier
evidence's source identity; it is not a new database rehearsal.

## Combined local walkthrough

All writes below used an isolated, synthetic, in-memory loopback fixture. They
do not establish hosted Auth/RLS, durable writes, ratings, mail delivery or
exactly-once SQL behavior.

- Navigation: expected eight-page order, mobile menu dismissal/focus return,
  Summer preference surviving refresh, sign-out prerequisite states and a new
  synthetic sign-in passed.
- Planning: organizer RSVP and date votes saved. Member presentation hid
  organizer controls, open-poll counts and suggestion authors. Server privacy
  enforcement remains covered by the separate SQL evidence.
- Matches/night: a four-player 2v2 entry preserved explicit sides and team
  winner without personal team scores. An individual night result and Save &
  Rematch retained the lineup and cleared the winner. Recap rendered, but its
  practice RPC is unsupported by this fixture; practice and team recap were
  not accepted from this check.
- Solo: 701 entry, history edit, explicit privacy opt-out across refresh and
  failed-save reconciliation passed. The retry retained the submitted score
  and cleared its pending state after success. Browser control stalled on a
  native delete confirmation; fixture state showed a soft deletion, but the
  complete browser delete/undo journey was not counted as a new pass. Earlier
  owner delete/undo acceptance and unchanged recovery code remain evidence.
- Board/rivalry: a saved draft resumed after navigation; it was cleared after
  testing. Incoming challenge presentation, poster preview and draft text
  transfer were checked. The copy correctly explains that the image is not
  attached. No real post, reply, challenge acceptance or repair was submitted.
- Invitations: synthetic invitation creation, token removal from the URL and
  verification-code form/cooldown passed. No email or account was created.
  Existing real invitation/signup/login and corrected password-reset owner
  acceptance remain in W6; they were not repeated by the fixture.
- Fallbacks: local diagnostic error and Try again recovery passed. Missing
  invitation/reset prerequisites and unknown-route states were reviewed.

The layout record contains 92 samples: 23 routes at 320 and 1280 pixels, in
light and controlled dark-token styling. Each had one main landmark, one main
heading and no document-width overflow. Mobile navigation and the poster were
also checked at 390 pixels. Signed-in Auth redirects, the local-only blocked
release-readiness page, and missing-token/session states limit what individual
matrix rows prove; the allowed hosted readiness page has earlier P21 evidence.
This matrix is not physical-device, OS-theme, browser-zoom, screen-reader or
full accessibility certification.

Ignored supporting evidence lives in `.local/page-consistency/final-sweep-*`;
it includes the layout matrix, sanitized hash comparison and screenshots.
No credentials or production records were added to tracked review files.

## Corrected finding and outstanding acceptance

**Poster dialog focus return:** reproduced twice in
`components/rivalries/RivalryRoom.tsx`. Opening Make a fight poster moves focus
into the dialog. Escape unmounts it and leaves focus on `BODY`, instead of the
opening control. Restore opener focus on dismissal, then verify Escape and the
Close button for both poster and challenge uses of the shared dialog. Do not
infer a focus-trap failure from this finding.

The owner subsequently authorized this correction on 2026-10-01. Dialog effect
cleanup now closes the native dialog and restores focus to its original,
still-connected opener. Native-browser verification passed all four cases:
poster Escape, poster Close, challenge Escape and challenge Close. Four
regression tests cover the two dialog variants and their close/cancel handlers.
The new working-tree implementation passed trusted install, all 582 tests in
73 files, coverage, lint, typecheck and production build. Coverage percentages
remain unchanged. The build used local Supabase defaults, so it does not verify
hosted services. The two existing dependency findings remain in their separate
release gate. No new CI/deployment result or published SHA is claimed for this
local correction; the recorded `8b1ed75` candidate remains the prior preview.

Owner confirmation is also pending for preview testing of 2v2/3v3, two-account
challenge acceptance/repair and Board member/organizer actions. Prior page
appearance acceptance does not by itself prove those journeys. Retain any
unconfirmed cases as focused W6 checks, alongside affected phone/theme/keyboard
acceptance. No new 200% text zoom, 400% browser zoom or assistive-technology pass
is claimed.

## Return to release work

Use the [pre-consistency checkpoint](pre-consistency-checkpoint-2026-09-30.md)
with the new candidate addendum. Publish/freeze the verified focus correction
when updating the application candidate, and finish affected W6
acceptance; resolve the separately scoped dependency gate (existing one high
and one critical audit finding) and credential controls. Earlier W0-W5 evidence
remains recorded, with its original boundaries.

Before W7 go/no-go, rehearse the original 11-step SQL chain **plus both W6
supplements**, and rebuild/retest the compatible rollback app against that
final schema. Include 701, masked open polls and Solo summary default-on,
explicit-off and read-failure cases. The original W5 rollback predates those
supplements and does not replace this final rehearsal.

W7 then freezes the exact application/SQL/rollback packet and obtains the owner
decision. W8 still requires explicit production-cutover approval, fresh protected
backups, drained writes, no-record-loss verification and monitoring. No main
merge, production deployment, hosted SQL/configuration change or new backup was
performed in this sweep.
