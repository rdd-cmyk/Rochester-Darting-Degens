# P02 Advanced Stats consistency and copy

Status: awaiting owner review. Baseline `f757ed0` on `release/next`.
P01 was accepted with its shorter introduction; P03 is not started.

## Scope and token adoption

Stats adopts the existing `PageHeader` feature size and `ActionLink` primary/
secondary variants. The plain title replaces the old navy hero and ring; the
methodology's navy explanatory panel stays. The body keeps its analytical
layout, charts, tables, numbered series, legends and exact-history disclosures.

Both filter groups adopt the opt-in `.rdd-filter-group` surface and native
select styles: shared text, panel/border, spacing, radius, 44px target, action
padding/font and focus roles. Only column count and sticky/static layout stay
page-specific. The second group is now a matching panel. `--rdd-space-8` adds
the existing 2rem section gap to the central scale. Sign-in and retry actions
use the same action appearance with their existing native link/button semantics.
Unused Stats hero/action rules are removed at their original definitions.

Consumers: Home and Stats → `PageHeader`, `ActionLink`; Stats only →
`.rdd-filter-group`. Home's accepted geometry is unchanged. Existing statistics
palette literals, axis geometry, data normalization, filters, rating engine,
score cohorts, sample thresholds, auth and query/retry logic are untouched.
No dependencies, SQL, environment files, hosted data or access rules changed.

## Copy review

| Copy | Decision | Reason |
| --- | --- | --- |
| Advanced Statistics / RDD League Lab | Keep, with the shared decorative orange period. | Familiar title and analytical context. |
| Intro | Go beyond the win column. Compare power ratings, current form, strength of schedule and consistency—all built from recorded league matches. | Light broadcast energy; names the existing metrics and their source. |
| What is happening right now | The league picture | Fits filtered recorded history without implying live/new results. |
| On fire / Giant killer / Steadiest hand | Keep. | Existing sports voice already suits the league. |
| Controls, methodology, provisional/sample notices, Other warning, errors, loading and empty states | Keep. | Precise terms and recovery instructions preserve statistical meaning. |
| Home intro | Owner-requested shorter line applied. | P01 acceptance condition, with no other Home visual change. |

## Verification

Trusted install, 578 tests across 73 files, coverage, lint, type-check and normal
production build passed. Coverage: 96.53% statements, 90.90% branches, 97.76%
functions, 97.59% lines. The two existing dependency audit findings remain in
the separate release gate; this package makes no dependency change.

The ignored loopback fixture adapts the existing read-only synthetic history:
12 matches, three fictional players including a long name. No hosted keys or
data are used. Both themes at 320, 390, 768 and 1440px had populated results,
44px selects and no document horizontal overflow; chart/table overflow stays
bounded. Checks covered game/board/minimum/format/cohort filters, consistency
cards, filter-empty, empty history, loading, signed-out, read error and retry
with filter retention, plus keyboard exact-history disclosure and select focus.

Rendered sampled text contrast exceeded 4.5:1 for heading eyebrow, description,
actions and selects in both themes; select borders measured 3.39:1 light and
4.65:1 dark against their control fill. Existing stats palette contrast tests
also passed. No full accessibility-conformance claim is made.

Home and Matches header/navigation smoke checks passed at 390/1440px in both
themes. Home's requested copy and existing geometry were checked. No new motion
was added; the existing reduced-motion CSS remains intact. Physical phone,
browser zoom and assistive-technology review remain human acceptance items.
Auth-error states are retained and covered by the existing tests; they were not
induced in the browser this package. Write-success states are outside this
read-only page's scope.

Browser captures and exact publication identity belong in the ignored
`.local/page-consistency/` QA packet. The stable preview is the owner review
target; CI/Vercel publication and a signed-in read-only smoke are checked before
handoff. W6/W7 and production release remain governed by the saved checkpoint.
