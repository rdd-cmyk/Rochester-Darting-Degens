# Rivalry Room independent review and verified repairs

Reviewed the implementation in `c4f8d0a` against its base `16e58f9` on
`rivalry-room`, in `F:\RDD\Rochester-Darting-Degens-rivalry-room`.
An independent agent performed a read-only review, reported six actionable
P2 findings, and reviewed the scoped repairs. The primary agent separately
reproduced each finding before accepting it. No hosted service was used.

## Findings and verification

| Finding | Independently verified before repair | Final behavior |
| --- | --- | --- |
| Correction leaves wrong next scorecard | Real browser edited an ordinary Cricket Ben/Sam game inside a 501 Ben/Mike challenge. The next Game remained Cricket and was locked. | Seed every next challenge entry from its accepted game, rules, board and players. Normal creator corrections remain available. |
| Superseded avatar receipt | Local API committed fox, then owl, and replayed the original operation. Its receipt still returned fox and the old revision. | Replay reconciles the current owner avatar/revision, marks a superseded save, and the picker explains the confirmed earlier save while showing the latest avatar. |
| Filters remove other disciplines | A regression test with 501/Cricket history selected 501 and failed because Cricket disappeared from the menu. | Choices come from the unfiltered pair history. Game/board changes scope results without erasing other game options. |
| Admission/endpoint rejection erases recovery | Tests first simulated a lost response, then retried with `42501` or `PGRST202`; both deleted the pending operation. Local API also showed admission is checked before a committed receipt can be read. | A durable dispatch marker preserves previously dispatched operations when admission or endpoint availability prevents reconciliation. Exact ID/payload replay remains available after access returns. Fresh, acknowledged no-write rejections can still release. The League Night integration uses the same distinction. |
| Loser/spectator is congratulated | A losing viewer's completed page displayed `THE CHAPTER IS YOURS.` in the browser. | Completed page and poster use neutral `THE CHAPTER IS WON.`; the series detail names the actual winner. UI tests cover winner, loser and spectator. |
| Delegated results cannot be linked/corrected | Local API denied a participant linking another member's eligible ordinary result. With a local fixture link, it also denied the original creator's correction. Both returned `42501`. | Participants own explicit series link/unlink actions with expected revisions and audit. The base recorder retains sole creator authority over canonical edits. Nonparticipants cannot accept, alter series links or submit new challenge games. |

The scoped independent re-review also caught a repair-induced reset of PPD
to 3DA. The final reset preserves the current input unit while restoring the
accepted terms and players. A real browser selected PPD, saved the deciding
game, waited for series completion, then verified PPD remained selected.

Explicit link/unlink changes series membership only. They do not change the
canonical game, personal scores or rating calculation. Ordinary games entered
by another admitted member can now be linked by a participant as specified
in the plan, and their creator can still correct them. All existing admission,
version, eligibility, one-series membership and atomic-save checks remain.

## Final verification

Completed on 2026-09-29 against the isolated loopback project
`rdd-rivalry-room` (API `56621`, production app `3040`).

- Trusted locked install passed; dependencies and lockfile are unchanged.
- Full application suite: **59 files, 473 tests passed**.
- Coverage: **96.53% statements, 90.90% branches, 97.76% functions,
  97.59% lines**; every required threshold passed. The final full coverage
  run passed with no other heavy checks running after a timing-sensitive
  existing discard test failed during concurrent verification.
- ESLint, TypeScript, production build and Git whitespace checks passed.
- **65 local API/database checks passed**, including superseded avatar replay,
  revoked/restored admission, delegated participant linking, original creator
  correction, noncreator edit rejection and nonparticipant new-game rejection.
- **23 production Edge checks passed**, including the prior responsive,
  fullscreen, dialog, avatar/lost-response and poster checks, plus ordinary
  correction inside a challenge, restoration of accepted terms/participants,
  PPD preservation and accurate completion copy for the loser. No page exceptions.

Regression coverage lives in `RivalryRoom.test.tsx`, `AvatarPicker.test.tsx`,
`lib/rivalries/use-operation.test.tsx`, and the existing match-write tests.
The expanded local API and browser scripts retain the integration checks.
Browser evidence for this review is in the ignored
`.local/rivalry-room/browser-review/`; the original design/implementation
screenshots are preserved. The browser script supports `RDD_REVIEW_ARTIFACTS=1`
to use that location. Local credentials and API/browser evidence summaries
remain under ignored `.local/rivalry-room/` and are not committed.

## Publication boundary

SQL remains a local fixture under `supabase/tests/fixtures/`; there is no
deployable migration. No hosted data, users, organizer roles, messages,
deployment or remote branch was changed. Hosted release gates and owner
visual/device acceptance remain pending as described in the
[implementation handoff](rivalry-room-handoff-2026-09-28.md).
