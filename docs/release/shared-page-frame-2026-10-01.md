# Shared page-frame audit and correction

Status: implemented, locally verified and published to Preview at application
`020136e`; combined owner appearance acceptance pending. See the
[publication record](shared-page-frame-preview-2026-10-01.md).
W6/W7/W8 remain at their existing return point.

The owner requested a cross-page consistency audit after P01-P24 acceptance.
Those packages adopted shared headers/actions/fields, but kept separate outer
widths, padding and title-size variants. Reusing tokens alone did not establish
one navigation rhythm. Desktop source/browser samples showed 40px versus 64px
titles, 740/880/900/1240px shells and different top offsets. Board/Invites broad
paragraph rules also altered the header's internal spacing. Solo alone reserved
scrollbar space, so other short/long routes could move horizontally.

The correction adopts `.rdd-page-shell` in every PageHeader consumer and removes
outer geometry from the five active route/global stylesheets. The shared rule
owns width, centering, padding and section gap. Every page now uses the same
responsive title scale; PageHeader no longer accepts a route-size variant.
Shared eyebrow, title and description slots reserve a common rhythm
through loading and access states. Header paragraph rules protect their margin,
font and line height from domain selectors. Actions occupy a separate toolbar,
so wrapped buttons do not change title-area height. Planning's back link now
occupies that toolbar, and Board's header sits outside its feed wrapper.
Scrollbar space is reserved globally. Readable account forms are bounded inside
the common frame; domain cards, charts and rivalry artwork retain their layouts.

Long text and wrapped actions can grow vertically instead of clipping. Home's
redundant logo stays hidden on phones; the player identity slot remains visible.
These are content/accessibility exceptions, not different title sizes or page
widths. The existing dialog focus correction is preserved.

Ordinary section-heading scales/tracking are also shared by Stats, Planning,
League Night, Matches, profile and Solo sections. Dense Night sidebar labels
retain the central 1rem role; large recap/poster/showcase art remains deliberate
domain content. Existing stats palette aliases already point to shared page,
panel, ink and border roles. Panels/fields/actions continue to use shared skins;
this correction changes no theme palette, access rules or save handlers.

Source guards cover all consumer render states, removal of size variants and
central ownership of shell geometry. Browser review produced 88 light samples
(22 routes at actual 320/390/768/1440px) and 44 controlled-dark samples (22 routes
at 320/1440px), plus active-night and Board-thread samples at 320/390/1440px and
signed-out Auth at 320px: 139 measurements, none with document-width overflow.
Every sample had one main landmark and one main heading. Normal desktop title
areas match at approximately 163px high, 1160px wide, with 40px titles and the
same start coordinates. Normal phone title areas match at approximately 250px
high, with 28px titles and the same start coordinates. The intentionally long
profile name wraps taller beside its avatar. Other toolbars/content can grow
according to their controls; this is not a fixed-height clipping scheme.

Dark checks used a loopback proxy that applied existing dark media rules to
served CSS, without modifying application files. This is controlled-token
evidence, not an OS-theme/physical-device pass. The local restricted readiness
route still renders its expected fallback; no new hosted diagnostic acceptance
is claimed. The error boundary shares the guarded source; its real thrown-error
browser journey was recorded in the prior combined sweep, not repeated here.
Poster Escape focus return passed again after header adoption. Existing email,
password-reset and durable write evidence remains in W6; no real accounts,
mail or SQL were changed.

Ignored evidence: `.local/page-consistency/shared-frame-layout.json`,
`shared-frame-desktop.png`, `shared-frame-mobile-light.png` and
`shared-frame-mobile-dark.png`.

Final working-tree checks passed: trusted install; 585 tests across 74 files;
coverage (96.53% statements, 90.90% branches, 97.76% functions, 97.59% lines);
lint; typecheck; production build; and diff whitespace checks. The build used
local Supabase defaults, not a hosted deployment. Existing dependency findings
(one high, one critical) remain in their separately scoped release gate. There
are no changed SQL, library save/calculation logic, API or package-manifest paths.
The local review above preceded publication. The subsequent publication record
supersedes that status and identifies the new CI/Preview candidate; `8b1ed75`
remains the previous accepted-page baseline. Review the combined geometry on
Preview before continuing to release packages.
