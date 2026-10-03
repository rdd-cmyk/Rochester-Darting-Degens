# Final visual polish before the release checkpoint

Baseline: `release/next` at `247e4f5`. Owner accepted the combined shared-frame
update and requested this final pass. Status: implementation complete; all local
gates passed; exact-commit CI and Preview verified; owner appearance accepted
on 2026-10-01. Follow-up Alien/Red Panda edge cleanup is recorded in
[art provenance](../art/rivalry-avatars/edge-cleanup-2026-10-01.md).

1. Rename the lion's display label Crown to King; preserve stable avatar IDs.
2. Give Machine a focused competitive expression, preserving the roster style
   and original master. Record the built-in image edit and export all sizes.
3. Keep the original Home logo visible in the mobile eyebrow area without
   increasing the shared header height.
4. Replace the Stats methodology slogan with straightforward league language.
5. Compact both mobile filter panels consistently; preserve 44px controls,
   labels, native selects and filter behavior.
6. Include the league-night title and optional venue in image/text recaps.
   Use date-aware wording in Rochester time; there is no separate end-night
   state. Do not label a past night finalized or alter its records/awards.
7. Mirror the right avatar in generated fight posters to face its opponent.
8. Show avatar callsigns in rivalry faceoffs and player profiles; retain the
   already named avatar picker, and avoid cluttering tables/navigation.
9. Remove portrait/label overlap and keep portrait alignment independent of
   wrapped player names on mobile, desktop and TV view.

Verify focused date/export/orientation behavior, mobile and desktop geometry,
long names, both themes and generated-image readability. Run the required
application gate once the combined candidate is ready, then publish to Preview
and verify exact-commit CI/Vercel. Combined owner appearance acceptance remains
separate. No W-package execution, hosted SQL, production deployment, game-rule
or statistics-calculation change is included.

## Local evidence

- Focused regressions: 21 tests passed across six files, including date wording
  at Rochester midnight in summer/winter, recap title/venue changes, privacy of
  match notes, long export text and poster canvas mirroring with restored
  caption coordinates. An older avatar mock was updated to retain the new
  callsign export; no runtime workaround was needed.
- Browser review: 320px and 390px phones, 768px tablet and 1440px desktop;
  long-name faceoff portrait tops remain equal. TV view retains that alignment.
  Callsigns are visible on faceoffs and profile identity; missing avatars do not
  receive invented names. The fight-poster preview visibly faces inward.
- Mobile Home logo measures 52px square and ends at the title boundary without
  overlapping it. Existing desktop placement and shared heading slots remain.
- Both mobile Stats panels use matching two-column rules. At 390px, their
  content-driven heights are 164px and 108px, with all five selects at 44px;
  no document overflow at either phone width. Light and controlled dark-theme
  reviews retain labels and contrast. Existing mobile static/desktop sticky
  behavior is preserved.
- Past-night image preview visibly includes Demo League Night, Synthetic Darts
  Hall, its date and Night recap. The same canvas supplies the PNG download and
  accessible text; optional venue omission is covered by regression tests.
- Machine's edited master and transparent 512/256/96px exports are recorded in
  [art provenance](../art/rivalry-avatars/README.md). King preserves the lion ID.
  Other avatar files are unchanged. Local screenshots remain under ignored
  `.local/page-consistency/final-polish-*`; no hosted data was changed.

React checklist review: callsigns reuse the existing avatar context without new
fetches; effects depend on primitive night identity/date fields; canvas state is
restored before captions; meaningful image labels and native controls remain.
No access, invitation, calculation or dependency behavior changes were made by
the visual pass. The CI-discovered local recovery correction below is additional.

Required gate: trusted install, 592 tests across 76 files, coverage (96.58%
statements / 90.77% branches / 97.78% functions / 97.62% lines), lint,
typecheck and production build all passed. Install and Vitest required permitted
network/subprocess access after sandbox-only cache/worker startup restrictions.
The two existing dependency audit findings remain in the separate release gate;
package and lockfile contents are unchanged. No SQL or hosted setup was applied.

The exact published commit, CI run and Vercel deployment will be retained in
the ignored `final-polish-publication.json` packet and reported at handoff.
W6/W7/W8 remain at the saved checkpoint until this appearance review and the
remaining human journey gates are handled.

## CI-discovered recovery correction

The first published visual candidate was `4aa4a1a`; its Vercel Preview was Ready
and hosted Home/Stats/avatar/recap smoke checks passed. CI run `36903162603`
passed ordinary tests but failed an existing unsent-entry discard test during
coverage. Source review and two deterministically failing local tests confirmed
a stale common draft copy between definite save rejection and React's storage
effect. A fast confirmed discard could leave that copy recoverable on refresh.

`retainNightEntry` now replaces its own common pending copy synchronously after
writing the retained entry and before removing its operation record. It preserves
a different pending operation's common copy. If storage fails, the pending
operation remains retryable. Three focused regressions cover those conditions;
the original UI discard/refresh regression remains unchanged. No server save,
record, SQL, or hosted-data mutation is included. This is a narrow browser
recovery change, not purely visual; W6's affected recovery acceptance must include
it. Historical W0-W5 SQL/backup/rehearsal evidence remains unchanged.

The additional profile smoke check uses the two-line Triple Threat callsign.
A 64px header portrait keeps its identity block above the description at both
320px and 390px; desktop retains ample horizontal separation. Machine and King
were then inspected together in the read-only synthetic faceoff. The final
profile size adjustment was checked visually and with lint/typecheck/build;
the complete tests and coverage passed after the recovery correction.
