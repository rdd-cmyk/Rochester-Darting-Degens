# P01 Home consistency and copy

Status: owner accepted on 2026-09-30, with the shorter introduction requested below. Baseline `351a4b0`; original app `2d81b61`, evidence `f757ed0`.
The owner authorized P02 after this acceptance; shared consumers now include Stats.

Accepted copy: “Check the standings, follow the rivalries, and see who holds the bragging rights.” This removes the implication of newly announced results. P01 CI run `36783024402` completed successfully; P02 rechecked Home at 390/1440px in both themes after applying the requested line. Earlier pending-acceptance wording below is dated implementation evidence, superseded by this decision.

## Visual and source scope

Home uses `PageHeader` with the selected plain title/orange terminal period,
the existing logo, and shared `ActionLink` navigation actions. Signed-out Home
has one primary sign-in action; View matches and Advanced Stats are secondary.
Signed-in Home retains Record a match as its primary action.

The additive central roles cover spacing, control/panel radius, target height,
text/accent/focus colors, primary/secondary action states and heading size.
Home's table wrappers, cell spacing, sort focus and select geometry consume
those roles. Existing headers/actions remain unchanged on other pages. The
small-surface orange text uses the theme-aware accent role with the existing
contrast-safe muted orange rather than the brighter decorative orange.

Consumer list: Home → `PageHeader`, `ActionLink`, `.home-table-scroll`,
`.home-sort-button`, `.home-filter-control`. Existing `--stats-*` literals are
untouched. Values/appearance remain a P01 review candidate, not approval of
all style-guide proposals.

## Copy review

| Copy | Decision | Reason |
| --- | --- | --- |
| Darts Night Leaderboards / Rochester Darting Degens | Keep; add decorative terminal period. | Familiar page identity. |
| Intro | The standings are in. Check the records, follow the rivalries, and see who has the bragging rights. | Friendly broadcast voice without claiming a particular winner or inventing results. |
| Record a match / View matches / Advanced Stats / Sign in | Keep. | Concrete destinations and existing session meaning. |
| Five leaderboard titles and legacy-average disclosure | Keep. | Preserve game/sample meanings and distinguish legacy individual averages from specific presets/team formats. |
| Scroll hints, filters, empty/error messages | Keep. | Task and failure instructions stay factual. |

No query, calculation, authorization, sorting/filtering handler, SQL, environment,
dependency, saved avatar identifier or recovery behavior is changed. The existing
Board preview stays in its current location. A local unavailable-data run exposes
the existing behavior where overall shows a read error while secondary sections
show empty messages; this pass does not change that data-state logic.

## Verification and review boundary

Trusted install, 578 tests, full coverage, lint, type-check, production build and
whitespace checks passed. Coverage remains 96.53% statements / 90.90% branches /
97.76% functions / 97.59% lines. Existing dependency audit findings stay in the
separate release gate; no new dependency change was made.

Browser artifacts and synthetic harness are ignored under
`.local/page-consistency/`. The harness is loopback-only, read-only, and has no
production/test-project mutation capability. Hosted preview and affected-state
evidence are recorded after publication. Human acceptance remains pending;
do not begin P02 before the owner accepts P01.

Local browser checks: populated Home at 320, 390, 768 and 1440 CSS pixels in both light and dark themes; no page-level horizontal overflow. Long names wrap and wide tables retain bounded horizontal scrolling. Player sorting, Cricket selection, keyboard action focus, signed-out actions and settled empty/read-error states passed. Stats and Matches retain their existing headers in adjacent-page smoke checks. Physical phone and browser zoom acceptance remain owner review items. Hosted signed-in confirmation follows publication to the stable preview. No hosted data writes were used.


Published app: 2d81b61915911865207afd011191b22500e12423. Vercel reported success for this commit; stable release/next preview shows the new header and signed-in Record a match action. Hosted test records loaded and selecting the available 701 filter changed its table as expected. Desktop and 390px phone captures are in the ignored QA directory. Rendered navigation action heights were 44px. Remote branch equality was verified. No production deployment, configuration, SQL or data changes occurred.

