# RDD website design standards

Version: 2.0 draft • Updated: 2026-09-30 • Source baseline: `release/next` at `5061360221bf9d80c90aa7b1315ce029cde807e0`

Repository location: `docs/design-standards.md`.

This is the design contract for website interface work. The owner has selected Advanced Statistics as the quality and style reference. The companion [site-wide upgrade plan](sitewide-design-upgrade-plan.md) tracks its active application to the remaining routes.

This revision develops that reference into a concrete style guide for the combined release. The user requested documentation and pointers only on 2026-09-30. No application styling or behavior is changed by this revision. Existing owner decisions remain in force. The owner subsequently selected **D — Plain heading, with an orange terminal period**, on 2026-09-30; section 14 records that approved appearance. New token values, button specifications and header dimensions remain proposals for review, not claims of owner approval or site compliance.

Start with [the release source audit](style-guide-release-next-audit.md) and [the interactive comparison](mockups/style-guide-preview.html). Sections 12–15 give the proposed enforceable contracts; when a proposal is adopted, those contracts take precedence over an observed historical value above. The previous visual review remains dated evidence, not a review of this release.

## 1. Authority, evidence, and adoption

Apply these standards to new pages, changed components, navigation, forms, tables, charts, and all their visible states. Preserve existing product behavior and access rules unless the user requests a functional change. Existing pages become compliant through the migration plan; their current differences are not approved design exceptions.

Reference source: `rdd-cmyk/Rochester-Darting-Degens`, main revision `690a01b84d96c55b8ec455a6e298c17ec6093b50`, inspected 2026-09-26. After the owner signed in, the live `/stats` page was visually reviewed in dark appearance at the available desktop viewport, 1440px desktop width, and 390px mobile width. Reviewed states include the populated All/All/3+ dashboard, 501/All/3+ with no eligible players, and populated 501/All/1+ with consistency cards. The exact-history disclosure was opened with the keyboard. The earlier authentication-error state and the signed-in Matches page were also observed. Light colors and unexercised states remain source-reviewed only. The deployed commit was not independently established. This targeted visual review is not full accessibility, authentication, or production-data validation.

Authoritative implementation references at the reviewed revision:

- [Global CSS and design tokens](https://github.com/rdd-cmyk/Rochester-Darting-Degens/blob/690a01b84d96c55b8ec455a6e298c17ec6093b50/app/globals.css)
- [Advanced Statistics page and state handling](https://github.com/rdd-cmyk/Rochester-Darting-Degens/blob/690a01b84d96c55b8ec455a6e298c17ec6093b50/app/stats/page.tsx)
- [Rating chart and exact-value alternative](https://github.com/rdd-cmyk/Rochester-Darting-Degens/blob/690a01b84d96c55b8ec455a6e298c17ec6093b50/components/stats/RatingTrendChart.tsx)
- [Story card](https://github.com/rdd-cmyk/Rochester-Darting-Degens/blob/690a01b84d96c55b8ec455a6e298c17ec6093b50/components/stats/StatsStoryCard.tsx)
- [Statistics roadmap](https://github.com/rdd-cmyk/Rochester-Darting-Degens/blob/690a01b84d96c55b8ec455a6e298c17ec6093b50/docs/advanced-statistics-roadmap.md) for measurement rules; `AGENTS.md` and `docs/info-registry.md` for repository constraints.

**Observed baseline** below means an existing `/stats` source value or behavior. **Site-wide requirement** means a rule established by this document, including improvements needed beyond the reference page. Copy the reference's strengths without treating every existing implementation detail as ideal.

Use Markdown rather than a project skill: these are durable design decisions and review criteria, not an executable workflow. This matches `docs/skill-governance.md`. Revisit a skill only after a repeated design workflow warrants one.

The root `AGENTS.md` points to this document. Keep that pointer when revising repository guidance. Its required substance is:

```markdown
## Website design

Before planning or changing any website interface, read
[the design standards](docs/design-standards.md). Use Advanced Statistics
(`/stats`) as the visual reference and satisfy the standards' acceptance
checklist. For the site-wide migration, follow
[the upgrade plan](docs/sitewide-design-upgrade-plan.md).
```

The README also points to the two documents. Keep detailed rules here rather than duplicating them.

## 2. Design intent

The site should feel like an approachable league dashboard: bold Rochester navy and dartboard orange, orderly surfaces, clear numbers, and language a casual player can understand. A visitor should quickly understand the page, find the next useful action, and inspect the detail behind a result.

1. Establish context before detail: title, brief explanation, primary action, relevant controls, then results.
2. Give each section one clear purpose. Use headings and spacing to separate tasks; avoid a continuous wall of unrelated tables or form fields.
3. Stats leads with Power & Performance summaries, with Records and Head to Head as linked views. Preserve all existing analyses and former Home leaderboards. League Night is the root and logo destination, organized around the next night, recording, recent recap, power and Board activity. Matches is archive-first; standalone recording requires an explicit choice. Do not invent summary metrics merely to fill cards.
4. Keep task pages efficient. A sign-in form or match editor should inherit the visual language without requiring a dashboard-sized hero.
5. Make trust visible: metric labels, sample sizes, missing-data treatment, pending states, and recovery paths are part of the design.
6. Let orange identify a primary action or a restrained highlight. It must not compete with every heading, border, and button.

Owner-confirmed preferences (2026-10-01): the accepted League front door replaces leaderboard-first Home and the separate Home navigation item. Summer decorations remain optional and restrained. Shared tokens and consistent page-header geometry continue to govern all views.

## 3. Color system

The following are observed values in `app/globals.css`. They are the initial site-wide palette. Reuse theme-aware roles; do not scatter new hex values through pages.

| Role / existing token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--stats-page` | `#f4f1eb` | `#080f1a` | Page canvas |
| `--stats-panel` | `#ffffff` | `#111b2b` | Cards, forms, tables, filters |
| `--stats-ink` | `#101827` | `#f4f6f8` | Primary surface text |
| `--stats-muted` | `#5b6472` | `#b9c2ce` | Supporting text and labels |
| `--stats-border` | `#d8dce3` | `#2b3b52` | Surface boundaries |
| `--stats-navy` | `#08264d` | `#0b2342` | Hero and explanatory feature panels |
| `--stats-navy-soft` | `#123d73` | `#8dbcf1` | Eyebrows and emphasis on ordinary surfaces |
| `--stats-orange` | `#f47c20` | `#ff9344` | Primary action and brand accent |
| `--stats-cream` | `#fff3dc` | `#f7e3be` | Supporting brand accent |
| `--stats-silver` | `#d7dde8` | `#b8c2d2` | Range tracks and restrained accents |
| `--stats-positive` | `#1b5f94` | `#73baff` | Positive statistical change |
| `--stats-negative` | `#9c4300` | `#ff9f5a` | Negative statistical change |
| `--link-color` | `#0366d6` | `#93c5fd` | Links on ordinary panels |
| `--focus-ring` | `#0366d6` | `#60a5fa` | Existing input focus role |
| `--input-border` | `#858c98` | `#76869b` | Visible boundaries for interactive fields and outlined controls |

Chart series 1–5 are `#9a3e00`, `#155b9b`, `#715500`, `#00665c`, `#67428f` in light mode and `#ff9f5a`, `#73baff`, `#f3cf72`, `#61d6c7`, `#c9a7ff` in dark mode. Keep numbered markers, names, and exact values alongside color.

On navy, use the reference's light text roles: hero heading `#fffaf0`, hero body `#dbe7f4`, white secondary-action text, and methodology body `#cbd9e8`. On orange actions use dark `#1d1a16` text. Do not use the ordinary link token blindly on navy.

Site-wide requirements:

- Use the implemented `--rdd-*` semantic roles for new shared chrome and page components. Existing `--stats-*` variables remain compatible with the statistics reference. The contrast-tested text tokens retain explicit hex values in both themes while matching their `--rdd-*` counterparts; do not replace those literals without updating the contrast check to resolve aliases.
- Preserve system light/dark behavior. A new theme switch is not required.
- Define separate tested success, warning, and destructive-action roles when needed. A negative rating is not an application error; do not conflate them.
- Check actual foreground/background pairs, including hover, focus, disabled, placeholders, chart axes, and text on translucent panels. Brand colors do not automatically make every pairing readable.
- Keep meaningful form and outlined-control boundaries at 3:1 or higher against their adjacent solid surface in both themes. The shared `--input-border` role is stronger than the subtle panel divider role for this purpose.
- Put the site canvas on an explicit shared layout surface when migrating. The reference's fixed, negative-z-index background pseudo-element is an implementation detail, not a pattern to replicate per page.

## 4. Typography and number formatting

Observed baseline: despite their names, `--font-geist-sans` resolves to `Arial, Helvetica, sans-serif` and `--font-geist-mono` resolves to `"Courier New", monospace`. The reviewed root layout does not load Geist. Preserve the actual typography initially; introducing a font is a separate documented design decision with visual review.

| Role | Reference value | Application |
| --- | --- | --- |
| Hero title | `clamp(2.4rem, 7vw, 5.5rem)`, line-height `.92`, tracking `-.055em`, uppercase | Major landing and analytical pages; ensure wrapping never clips |
| Section title | `clamp(1.55rem, 3vw, 2.4rem)`, tracking `-.035em` | Clear section hierarchy |
| Kicker / eyebrow | `.76rem`, weight `850`, tracking `.16em`, uppercase | Short context labels only |
| Hero explanation | `clamp(1rem, 2vw, 1.15rem)`, line-height `1.6` | Plain-language purpose |
| Featured metric | `clamp(2rem, 4vw, 3.4rem)`, weight `900`, line-height `1` | One prominent value per summary card |
| Table content | `.9rem`; header `.72rem`, uppercase | Exact lookup; increase density only while preserving legibility |
| Supporting card copy | `.86rem`, line-height `1.45` | Short explanation adjacent to the value |

Use one `h1` per page, then meaningful `h2`/`h3` levels. Do not apply tiny uppercase labels to long instructions or errors. For compact task-page titles, use a responsive 1.8–3rem scale with comfortable line-height; this is a site-wide extension, not the current hero value.

Use tabular numerals for comparable values. Use the mono role for numeric tables and detailed statistics; retain readable sans-serif for names and prose. Keep consistent precision, explicit units, signed changes, and visible denominators. Use an em dash or a short explanation for unavailable values rather than fabricated zeroes. Preserve the existing meaning and precision of each metric unless a separately reviewed change warrants otherwise.

## 5. Layout, spacing, and surfaces

Observed `/stats` baseline:

- Outer shell: every page uses `.rdd-page-shell`, width 100%, maximum 1240px, centered, padding `clamp(1rem, 3vw, 2.5rem)`. Outer width, padding, centering and section gap belong to the shared rule; domain stylesheets must not redefine them.
- Main section gap: 2rem; 1.35rem at widths up to 640px.
- Hero: padding `clamp(1.5rem, 4vw, 3.5rem)`, radius 1.25rem, desktop minimum height 260px; no minimum height on mobile.
- Panels: 1px themed border, radius 1rem, restrained `0 12px 32px rgba(8,38,77,.07)` shadow.
- Story cards: radius .85rem, padding 1.15rem, 5px accent top edge, .85rem grid gap.
- Filter bar: padding 1rem, radius .9rem, .75rem gap; desktop sticky offset .75rem.
- Actions: padding .75rem 1rem, radius .65rem, strong label weight.
- Table cells: padding .85rem 1rem, themed row separators.

Use those values as the base family. Prefer a small shared spacing scale (0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3rem) plus the reference's fluid expressions and documented component-specific values. Do not mechanically replace the reference's distinct values merely to enforce a scale.

All routes share the same outer 1240px frame. Readable account forms can use the
740px account role **inside** that frame, aligned to its content edge; they must
not narrow or recenter the page heading. Domain grids/cards retain their useful
layouts. Use `PageHeader`, `ActionButton`/`ActionLink`, shared panel/form/filter
roles and scroll regions before introducing another surface. Reserve scrollbar
space globally so short/long pages do not shift sideways.

Use solid panels as the default. Reserve navy blocks and subtle dartboard-ring decoration for identity or explanation. Decorative elements must not obscure content, intercept interaction, or convey necessary information. Keep the existing RDD logo and recognizable identity.

## 6. Responsive behavior

| Width | Reference behavior to carry forward |
| --- | --- |
| Above 900px | Four story columns, filter controls in a wide row, three methodology columns |
| 641–900px | Two story columns, two filter columns, one methodology column, and compact navigation menu |
| 640px and below | One story/consistency/filter column; static filter panel; stacked hero and section headings; mobile navigation |

The Statistics content changes at 640px and 900px. The shared navigation keeps its compact menu through 1024px so the full link set and account controls fit on one header row when expanded above that width.

Two hero actions may remain side by side on mobile when labels fit; allow stacking for long text and narrow widths. Do not shrink action text to force a row.

At 320px, 390px, tablet width, and desktop width, the document must not scroll horizontally. Wide tables and charts may scroll inside clearly bounded regions, with keyboard access and discoverable overflow. Preserve the reference chart's readable minimum width (680px) or supply an equally readable responsive alternative; never shrink its labels into illegibility.

When content extends beyond a mobile panel, include a visible cue such as “Scroll horizontally to see all columns” or an equivalent accessible affordance. The live 390px view initially shows only part of the chart and the leaderboard's rank/player columns, so clipped edges alone are not a sufficient cue. Keep player identity available while comparing offscreen values where practical, and keep the wrapping chart legend and exact-data disclosure outside the chart's horizontal scrolling area.

Long player names, error messages, and Markdown content must wrap. Controls must stay inside their panels. Sticky controls must not cover headings or focused elements, including at browser zoom. Test 200% zoom as well as a narrow viewport. Do not hide essential columns or actions merely to pass a screenshot check.

## 7. Shared component and interaction contract

Implement the smallest reusable primitives needed for real repeated use. Suggested responsibilities follow; names and file layout are implementation choices, not existing components.

| Primitive | Required behavior |
| --- | --- |
| Page shell / page header | Width variants, title, description, optional kicker, primary/secondary actions; compact and hero variants |
| Section heading | Heading plus concise contextual help; wraps cleanly on mobile |
| Panel / summary card | Consistent surface, padding, border, radius; meaningful label/value/detail hierarchy |
| Button / link action | Primary, secondary, quiet, destructive variants; hover, focus, active, disabled, pending; correct native element |
| Form field / field group | Associated visible label, help, validation, required/optional indication; fieldset/legend for related controls |
| Filter group | Controls adjacent to affected content; visible selected values; result count; no surprise page navigation |
| Data table | Semantic headers; numeric formatting; bounded overflow; preserved sorting and pagination |
| State panel / status message | Loading, signed-out, empty, no-results, error, success; a useful next action where appropriate |
| Badge | Short textual meaning, including provisional status; color supplements text |
| Pagination | Current page/context and clearly unavailable previous/next actions |

Use links for navigation and buttons for actions. Give each task group one visually dominant action. Link labels should state the destination or task (“Record a match,” “View player profile”), not “Click here.” Text links must remain recognizable without hovering.

Keep field labels visible; placeholders are examples, not labels. Show errors near the field and provide a summary for multi-field failures. Preserve entered data on validation or save failure. Pending writes must be visibly pending and prevent accidental repeat submission. Show success only after the operation succeeds. Use explicit cancel behavior for edits, preserving existing save/reset semantics.

Preserve native controls unless a custom control materially improves usability and receives keyboard and assistive-technology testing. Every repeated player input needs a distinct accessible name. Group participant identity and score together; explain 3DA/PPD/MPR beside the relevant field.

Navigation must carry the same palette and typography as the page: visible current location, accessible mobile menu, obvious account actions, and consistent focus styles. Keep current routes and signed-in/signed-out destinations. Retain the optional Summer toggle and persist the user's choice. Keep decorations sparse and visually secondary, outside reading and input surfaces; they must not obscure data, intercept input, shift layout, or compete with primary actions. Respect reduced motion by suppressing nonessential animation. This preference does not request a change to the first-visit default. Check the known Summer-Off reload hydration issue during shared-shell work.

## 8. Data presentation and content

Carry the reference's progression—summary, trend, exact lookup, explanation—to pages where it helps. Other pages need an equivalent hierarchy appropriate to their task, not copies of the entire `/stats` layout.

- Preserve all existing leaderboards, sorting, profile links, match history, and pagination. Overview cards may complement exact tables but do not replace them.
- Label 501, 301, Cricket, board types, sample sizes, and score units consistently. Keep compatibility rules for comparisons and the explicit opt-in for Other scores.
- Keep provisional ratings visible before ten matches and preserve minimum-games filtering. Retain definitions and sample caveats near the relevant results or in a clearly linked explanation.
- Do not relabel legacy match-average statistics as exact weighted aggregates. Do not change rating calculations or chronology as part of styling.
- Charts require a clear title, axes/units, named or numbered series, and a text/table alternative with exact data. Retain `RatingTrendChart`'s exact-history disclosure. Signed values, markers, or labels must carry meaning without color.
- Handle equal or near-equal chart endpoints without overlapping labels. The live 501 view contains coincident series and endpoint labels; use offset labels with connectors, a combined label, or another clear treatment while preserving true plotted values and every player's legend/table entry.
- Label prominent consistency values explicitly, for example “Median 3DA.” The source confirms the current large number is a median, but the live card does not name it. Explain the range and preserve scored-game counts, especially with only one or two samples; do not imply a reliable consistency ranking from a tiny sample.
- Keep filtered match count distinct from eligible-player count. A positive match count with no eligible players is valid when nobody meets the minimum-games threshold. Preserve the selected filters and explain how to broaden them without suggesting that the recorded matches disappeared.
- Keep useful prose brief and specific. Replace stale placeholders or event announcements only with verified information; never invent a new league date, result, or venue.
- Preserve player-name formatting and disclosure preferences through the existing helpers. Do not expose account details on public-facing summaries for decorative completeness.

## 9. State and accessibility requirements

These are site-wide acceptance targets, not a claim that the current reference already satisfies every one.

| State | Required presentation |
| --- | --- |
| Checking identity / loading data | Stable page heading and layout, specific status text, appropriate polite announcement |
| Signed out / access restricted | Explain the prerequisite and provide the existing sign-in path; never imply the data is empty |
| No data yet | Explain what is missing and how to create or obtain it |
| No filter/search results | Retain controls and values; explain how to broaden the selection |
| Request or authentication failure | Honest error message and supported recovery action; no fake zero-results success |
| Saving / saved / save failure | Pending action label, confirmed result, or actionable error with input preserved |
| Invalid or expired recovery link | Clear recovery instructions, consistent account shell, no misleading success |
| Missing profile / unknown route | Context and a useful safe destination; distinguish from a temporary request failure |

All controls must be reachable and operable with a keyboard, show a visible focus indicator, and have accessible names. Use a skip-to-content link and a clear main landmark. Mobile menus must communicate expanded state, close predictably, and return focus appropriately. Sorting controls must expose current sort direction. Announce asynchronous results without excessive interruptions.

Project contrast targets: at least 4.5:1 for ordinary text, 3:1 for large text, and 3:1 for meaningful control boundaries and graphical information. Check rendered combinations in both themes. Aim for at least 44×44 CSS-pixel primary touch controls, including practical hit areas for compact icon controls. These are acceptance targets; the original 2.6rem Statistics filter height did not satisfy the 44px target at a 16px root size, so the migrated selects use a 44px minimum height.

Respect reduced motion. Avoid layout shifts on loading and session resolution. Decorative imagery is hidden from assistive technology; meaningful images have useful alternative text. Test zoom, long content, focus, and error states manually in addition to automated checks.

## 10. Engineering and review rules

1. Read this document and inspect the current reference before interface work. Check the latest revision; do not assume the snapshot above is still current.
2. Centralize recurring visual decisions in tokens and shared components. Use inline styles only for truly dynamic values, such as chart geometry, not repeated page color/padding definitions.
3. Keep domain logic, queries, calculations, authorization, and telemetry behavior separate from presentational refactoring. Preserve existing tests and meaningful comments.
4. Avoid adding a UI framework, chart library, font service, or animation dependency merely to reproduce the existing design. Record a concrete need before expanding dependencies, and honor repository approval requirements.
5. When shared CSS changes, inspect `/stats` and at least one other affected page in both themes and at desktop/mobile sizes. Review intentional visual changes before updating screenshot baselines.
6. Do not use this reference page to justify inaccessible focus, theme contrast, hydration issues, or confusing state handling. Correct those within the approved interface scope and record the difference.
7. Keep product expansion from the statistics roadmap separate: League Night Mode, imports, enhanced metrics, and hosted database work are not implicit parts of a visual migration.

## 11. Acceptance checklist

A changed page or shared component is complete only when the applicable checks pass and evidence is recorded:

- [ ] Matches the approved palette, type hierarchy, spacing, surfaces, and action hierarchy.
- [ ] Uses shared roles/primitives or explains a necessary exception.
- [ ] Preserves all existing tasks, URLs, data meanings, filters, sorts, and permissions.
- [ ] Handles applicable loading, empty, signed-out, error, and success states.
- [ ] Works in both themes at narrow/mobile, tablet, and desktop widths; only deliberate inner regions scroll sideways.
- [ ] Keyboard order, visible focus, accessible labels, contrast, touch use, zoom, and reduced motion were checked.
- [ ] Long names/content and realistic populated datasets remain readable.
- [ ] Automated checks relevant to changed behavior pass; visual changes were reviewed against stable fixtures.
- [ ] No unrelated schema, dependency, auth-policy, or telemetry change was introduced.
- [ ] Remaining defects and unverified conditions are explicit; none are silently counted as passes.

Maintain this document in the same change as an intentional system-wide design decision. An exception must identify the affected route/component, reason, evidence, and review condition. Avoid turning temporary migration debt into permanent design policy.

## 12. Accessibility standard and semantic tokens

Target **WCAG 2.2 Level AA** for future interface work. The requirements below cover common design decisions; they do not replace the full standard or establish conformance. Primary sources checked 2026-09-30:

| Requirement | Acceptance rule | Source |
| --- | --- | --- |
| Text contrast | Ordinary text, labels, placeholders, links and button labels: at least 4.5:1. Large text: at least 3:1; large means at least 24 CSS px regular or 18.67 CSS px bold. Compare unrounded ratios. Prefer 4.5:1 even for headings. | [1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) |
| Non-text contrast | Information needed to identify controls/states and meaningful graphics: at least 3:1 against adjacent colors. Decorative card separators are distinct from essential field/control boundaries. | [1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) |
| Keyboard focus | Visible focus with sufficient adjacent contrast; focused controls must not be entirely obscured. Project preference: fully visible focus, including below sticky navigation. | [2.4.7](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html), [2.4.11](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) |
| Touch targets | AA minimum is 24×24 CSS px or a permitted exception, including adequate spacing. Project standard: at least 44×44 CSS px for standalone controls, even compact/icon controls. Inline prose links can use the applicable exception. | [2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) |
| Zoom and reflow | Text works at 200% resize; ordinary content reflows at 320 CSS px, including the equivalent 400% zoom at a 1280px viewport. Wide data tables may use a bounded, discoverable scroll region. | [1.4.4](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html), [1.4.10](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) |
| Meaning beyond color | Selected, error, winning and provisional states use text, icons, borders or markers as well as color. | [1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) |

The project proposes a 3px solid focus outline with 3px offset. This is a local design rule; the area/change-of-contrast specification in [2.4.13 Focus Appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html) is AAA, not AA. Inactive controls have WCAG contrast exceptions, but readable disabled labels remain a project preference. Pending explanations and validation text are active content and must meet text contrast.

### Token ownership

Use three layers: **palette → semantic role → component variant**. A palette color says what it is; a semantic role says where it is safe; a variant combines roles with geometry and interaction. Pages choose a variant, never a new shade or local button radius. Variables alone cannot stop drift if each route assembles its own button.

- Keep the existing `--rdd-*` palette and `--stats-*` compatibility aliases during a later migration. Do not rename every token at once. Existing contrast tests parse some explicit `--stats-*` literals; alias changes need corresponding test updates.
- The following table began as a role proposal. Adopted roles now live in
  `app/globals.css`; the current contracts and adoption records below identify
  their consumers. Remaining proposals still need scoped implementation. Shared
  action/header components own markup and skins; route CSS owns domain layout,
  not page-frame or title geometry. CSS definitions are the executable authority.
- Put literals in token definitions, not TSX, Tailwind arbitrary colors, route styles, or inline presentation styles. Dynamic chart coordinates and per-player avatar geometry remain legitimate dynamic values.
- A token change is a system change: review every consuming variant in both themes and on both panel and hero surfaces. Hover, active, selected and focus combinations need their own checks. Composite alpha layers over their actual background; never test only the uncomposited hex.

Proposed semantic color roles (reuse the established palette):

| Proposed role | Light | Dark | Intended use |
| --- | --- | --- | --- |
| `--rdd-surface-page` / `--rdd-surface-panel` | Existing `--rdd-page` / `--rdd-panel` | Same aliases | Canvas / cards |
| `--rdd-text` / `--rdd-text-muted` | Existing `--rdd-ink` / `--rdd-muted` | Same aliases | Ordinary surface text |
| `--rdd-border-subtle` | Existing `--rdd-border` | Same alias | Decorative dividers only |
| `--rdd-border-control` | Existing `--input-border` | Same alias | Essential control boundaries |
| `--rdd-action-primary-bg` | `#f47c20` | `#ff9344` | Main action |
| `--rdd-action-primary-text` | `#08264d` | `#08264d` | Dark text on orange in both themes |
| `--rdd-action-primary-hover-bg` | `#ffc28f` | `#ffc28f` | Shared hover, replacing route-specific mixes/filters |
| `--rdd-action-primary-active-bg` | `#ffac6d` | `#ffac6d` | Shared pressed background |
| `--rdd-action-secondary-bg` / `-text` | `--rdd-panel` / `--rdd-ink` | Same aliases | Neutral secondary action |
| `--rdd-action-secondary-hover-bg` | `--rdd-page` | Same alias | Secondary hover |
| `--rdd-action-secondary-active-bg` | `#e6e9ee` | `#24364e` | Secondary pressed background |
| `--rdd-on-hero-text` / `-muted` | `#fffaf0` / `#dbe7f4` | Same values | Heading / copy on navy |
| `--rdd-on-hero-link` / `-border` | `#fffaf0` / `#b8c2d2` | Same values | Inverse link / outlined action |
| `--rdd-on-hero-hover-bg` / `-active-bg` | `#123d73` / `#164b80` | Same values | Inverse secondary hover / active |
| `--rdd-focus-on-panel` | `#0366d6` | `#60a5fa` | Focus on ordinary surfaces |
| `--rdd-focus-on-hero` | `#fffaf0` | `#fffaf0` | Focus on navy surfaces |
| `--rdd-danger` | `#b42318` | `#ffb4ab` | Destructive text/border on ordinary surfaces |
| `--rdd-danger-hover-bg` / `-active-bg` | `#fff0ee` / `#ffe0dc` | `#352125` / `#45292d` | Destructive interaction on ordinary surfaces |

Primary orange against a white panel is only 2.71:1. Its dark label passes text contrast, but use `--rdd-border-control` on light surfaces when the silhouette is needed to identify the control. Orange is an accent, not a body-text/link role on white. White text on this orange is also 2.71:1 and fails ordinary text contrast. A focus role safe on white may fail on navy: use the surface-specific role.

Proposed geometry tokens:

| Token | Value | Rule |
| --- | --- | --- |
| `--rdd-space-1` through `--rdd-space-8` | `.25, .5, .75, 1, 1.25, 1.5, 2, 3rem` | Shared spacing steps; retain intentional fluid shell/header padding |
| `--rdd-radius-control` / `-panel` / `-header` | `.55rem` / `1rem` / `1rem` | Controls / ordinary panels / default page headers |
| `--rdd-control-min-height` / `-min-width` | `2.75rem` / `2.75rem` | 44px at the default 16px root; also enforce a 44px floor |
| `--rdd-action-font-size` / `-weight` / `-line-height` | `1rem` / `700` / `1.25` | Default action labels |
| `--rdd-action-pad-y` / `-pad-x` / `-gap` | `.625rem` / `1rem` / `.5rem` | Shared geometry; height grows when labels wrap |
| `--rdd-action-compact-pad-y` / `-pad-x` / `-font-size` | `.5rem` / `.75rem` / `.875rem` | Dense rows; retain 44px target |
| `--rdd-content-wide` / `-form` / `-account` | `1240px` / `880px` / `740px` | Shell width variants, always capped at available width |
| `--rdd-panel-padding` / `--rdd-panel-shadow` | `clamp(1rem, 2vw, 1.5rem)` / `0 10px 26px rgba(8,38,77,.05)` | Shared panel treatment |

For example, a future button consumes `background: var(--rdd-action-primary-bg)` and `border-radius: var(--rdd-radius-control)` in one shared variant. Changing that role updates all consumers. This example is documentation, not a CSS addition.

## 13. Button and control contract

**Proposed default:** orange primary with dark navy text; neutral outlined secondary; underlined quiet action; clearly labeled destructive action. The current `.rdd-action--secondary` is navy and `.rdd-action--outline` is inverse white; migrate their callers deliberately rather than silently changing meanings. There is no generic blue primary variant.

| Variant | When to use | Appearance and states |
| --- | --- | --- |
| Primary | Main next action in a task group: Save result, Start a night, Send invitation, Create challenge | Primary tokens; same radius, label weight and padding everywhere. Hover/active use their central roles; focus uses the containing surface's role. |
| Secondary | Related action: Cancel, Refresh, View history | Panel/text roles and control border on ordinary surfaces; inverse text/border and hero hover/active roles on navy. Equal geometry to primary. |
| Quiet | Lower-priority navigation or optional detail | Underlined text with ordinary link role or inverse role; no filled box. Standalone actions retain 44px hit area. Hover/active strengthen underline without changing label meaning. |
| Destructive | Delete, revoke, remove or another destructive task | Danger text and border on panel; shared hover/active roles. Explicit label and existing confirmation/recovery behavior. On hero, place the action on a normal panel rather than inventing a red-on-navy combination. |
| Selected toggle/tab | Existing choice, filter or mode | Separate selection primitive, not another primary CTA. Expose `aria-pressed` or the appropriate native/tab state and a non-color marker. |

Default and compact are the only proposed action sizes. Compact changes padding/type, not the minimum hit area. Icon-only actions get an accessible name and a 44px square target. Buttons grow to fit translated/long labels; do not use route-specific fixed widths. Full width is a layout option, not a different skin. Preserve natural width unless the task/mobile layout calls for full width.

Shared states:

- **Hover:** only on enabled controls; use the defined hover role, no per-page brightness filter or arbitrary blue.
- **Active:** use the defined pressed role while activated. Avoid motion that shifts surrounding layout.
- **Focus:** visible solid outline; do not suppress native focus without an equally visible replacement. Check on canvas, panel and navy.
- **Disabled:** native `disabled` for unavailable buttons; proposed muted label and subtle background with control border, no blanket opacity that makes unrelated pending copy unreadable. Disabled links need intentional semantics and navigation prevention rather than a button-only attribute.
- **Pending:** keep geometry stable, prevent duplicate activation, mark the relevant region/action busy, and use a task-specific label such as “Saving result…”. Announce completion/failure. Pending is separate from selected.

Use `<a>`/Next Link for navigation and `<button>` for actions; use `type="button"` except intentional form submission. Different behavior does not justify different padding. Do not alter admission, privacy, save-recovery, game rules, poll limits or binary RSVP states during adoption.

Forms use the same control radius and 44px floor, 1rem input text, visible labels, help/error spacing and strong control borders. Chips, badges, tabs and chart markers have their own role; do not use button variants to imply they can be clicked. Keep success, warning and validation roles separate from positive/negative statistics; define and contrast-check those role pairs before introducing new notification skins.

## 14. Page-title header contract — Plain heading with orange period

This is the title area immediately below the site navigation. The global navbar is a different component.

**Current implementation contract, 2026-10-01:** the owner requested one
consistent frame and title rhythm across pages after P01-P24. `PageHeader` now
has one size family; compact/standard/feature route variants are removed. All
titles use `--rdd-page-title-size` (`clamp(1.75rem, 3vw, 2.5rem)`), line-height
`--rdd-page-title-line-height` (`1.14`), weight 800 and the orange period. Its
eyebrow/title/description slots have shared minimum dimensions, including when
copy is absent in loading/access states. Description text uses 1rem/1.6 and a
68ch reading measure. At 640px and below, reserve two title lines, two eyebrow
lines and four description lines. Long names/copy grow without clipping.

Actions occupy a separate shared toolbar below the title area; wrapping controls
must not change the heading's geometry. Every route uses the same shell padding
and section gap. Back actions belong in that toolbar, not above the heading.
Identity artwork may use the named slot: Home's original logo uses a 52px
mobile eyebrow slot (`--rdd-home-logo-mobile-size`) without increasing the
shared heading height; player identity remains visible and long names can wrap
beside it. Avatar callsigns use `PlayerAvatarName` and the shared
`--rdd-avatar-name-size` role on profiles and rivalry faceoffs. Faceoff portraits
align at the top, with identity labels below; names grow downward independently.
Posters/showcase artwork and dense sidebar labels remain domain treatments;
ordinary section headings consume the shared section-title role. The candidate
is locally verified and published to Preview; the owner accepted that combined
appearance on October 1. The subsequent
[final visual polish](release/final-visual-polish-2026-10-01.md) has its own
appearance acceptance. See
[shared-frame evidence](release/shared-page-frame-2026-10-01.md) and the
[publication record](release/shared-page-frame-preview-2026-10-01.md).

The opt-in `.rdd-filter-group--compact` variant uses two columns, shared
8px gaps and 12px padding at 640px and below. Both Stats filter panels consume
it. Controls retain the shared 44px minimum height, native select behavior and
visible labels; panel heights follow their content rather than a fixed value.

**Structure to standardize:** optional back link/breadcrumb above the header; optional short eyebrow; one `h1`; brief description; optional context/status; optional primary and secondary actions. Context is not another hero or an arbitrary metric grid. Use the same component in populated, loading, empty, signed-out and error states so identity and spacing do not jump.

**Owner-selected appearance (2026-09-30): D — Plain heading**, based on The Rivalry Room. Include its contrasting **orange period at the end of the page title**, coordinated with the orange eyebrow above it. This is the default family for page-title areas below the navbar, including future compact, standard and feature sizes. Selecting this appearance does not authorize implementation or approve the other proposed dimensions.

The selected treatment has an unboxed heading on the ordinary page canvas, a prominent title in the theme's primary text color, an orange eyebrow when present, and the orange terminal period. Use natural title/name casing. The default title area has no navy/gradient hero background, surrounding card border/shadow, or decorative ring. Feature-specific posters, illustrations and showcase panels can remain separate content below the header.

**Period and accent contract:** append one decorative orange period directly after the display title, with no preceding space. For example, `The Rivalry Room` followed by an orange `.`. Keep the period attached to the final word when wrapping; do not leave it stranded on its own line or create a duplicate period. Do not alter stored names or route labels to add punctuation. Hide the decorative period from assistive technology when it adds no meaning; the title text remains the accessible heading.

Centralize the eyebrow/period accent in a shared semantic role, such as proposed `--rdd-page-heading-accent`, rather than copying `.rr-period` or a hex into every page. Orange is the approved appearance, not an instruction to copy an inaccessible existing shade: the small eyebrow needs 4.5:1 contrast against its actual canvas in each theme. Use a contrast-tested orange text role; its exact light/dark values remain part of the token proposal. The title itself retains its normal text role.

The [comparison preview](mockups/style-guide-preview.html) remains the original exploratory artifact: it compares source-based reconstructions, not screenshots or exact production rendering. Its open-choice labels predate this owner decision; section 14 is the authoritative selection record. The separate proposed controls below it illustrate a consistent button family.

| Reviewed option | Current example | Tradeoff |
| --- | --- | --- |
| A — Compact gradient | Home, Matches, Profiles, account pages | Strong identity with restrained height; practical default for repeat tasks |
| B — Statistics hero | Advanced Statistics | Bold uppercase title and cropped ring; strong introduction, consumes more vertical space |
| C — Solo hero | Solo Play | Large title, ring and contextual tags; expressive but its own spacing/type system |
| **D — Plain heading (selected)** | Rivalry Room / League Board; related approach in Planning | Content arrives sooner. Include Rivalry Room's orange terminal period; its showcase remains a separate domain panel below it. |

Historical proposal: one header component with compact, standard and feature
sizes. The October 1 current contract above supersedes those route variants.

Historical size proposal after selection (superseded; do not use for new pages):

| Size | Title / line-height / tracking | Padding | Intended use |
| --- | --- | --- | --- |
| Compact | `clamp(1.75rem, 3vw, 2.5rem)` / `1.14` / `-.025em` | `clamp(1rem, 2.5vw, 1.5rem)` | Home, Matches, account tasks; no minimum height |
| Standard | Same title scale | `clamp(1.25rem, 3vw, 2rem)` | Directories, Planning and Board; no minimum height |
| Feature | `clamp(2.4rem, 6vw, 4rem)` / `1.05` / `-.045em` | `clamp(1.5rem, 4vw, 3rem)` | Statistics, Solo or League Night landing when a feature introduction helps |

These normalize current geometry; they are not today's CSS and remain proposed. The padding above describes header spacing, not a filled container. Proposed header title weight is 800. Eyebrow: `.75rem`, weight 800, tracking `.15em`; normal description: 1rem, line-height 1.6, max 68ch. Use the selected plain canvas, natural title casing and orange terminal period. Keep long names in their original case.

Proposed shared spacing: `.5rem` text-stack gap, 1rem action-area gap and 1.5rem space before the next content section. Plain headings have no enclosing rounded panel; the panel-radius token remains for actual content panels. At 640px and below, actions move below copy and wrap/stack; titles and the terminal period never clip. Feature headers have no mobile minimum height. Use wrapping/min-width rules instead of truncating names. Preserve back destinations and signed-out access explanations.

Historical proposed route mapping (superseded by the common frame/title family):

| Route group | Proposed size | Domain content to retain |
| --- | --- | --- |
| `/` | Compact | Leaderboards remain first substantive content |
| `/matches`, `/auth`, `/auth/verify-email`, `/reset-password`, `/join`, `/invites`, `/profile` | Compact | Account/task state and supported actions |
| `/profiles`, `/profiles/[id]`, `/change-log` | Standard, compact for narrow account-like detail | Avatar may occupy a named identity slot; preserve long names |
| `/board`, `/board/[id]`, `/league-night/plan` | Standard | Access label/back link/status; retain binary RSVPs and suggestion cap |
| `/stats`, `/solo`, `/league-night` landing | Feature | Their own explanatory/context content; active night can use compact |
| `/rivalries`, pair/challenge pages | Standard | Fight/series showcase remains domain content below the page header |
| Diagnostics and error routes | Compact where a page header is appropriate | Clear status and safe recovery |

**Decision record — 2026-09-30:** the owner selected D, Plain heading, and requested the orange period used by The Rivalry Room, visually coordinated with its orange eyebrow. This supersedes the earlier open appearance decision. Remaining proposals include final size/spacing values, route size assignments and exact semantic accent values. This decision changes the guide only; site adoption remains separately authorized work.

## 15. Keeping the guide in use

October 1 shared-frame correction: every PageHeader consumer, including loading,
access, utility and fallback render states, now adopts `.rdd-page-shell`. Five
active stylesheets no longer own outer shell geometry. Shared typography and
spacing rules protect the header from broad route paragraph selectors; Planning,
League Night, Stats and player sections also use common section-heading roles.
`components/ui/page-frame.test.ts` guards cross-consumer adoption, the absence
of title-size variants and central ownership of outer geometry. This supersedes
the earlier page-specific width/size decisions below; those remain history.

P01 accepted, 2026-09-30: Home uses the opt-in `PageHeader` and `ActionLink` family and central geometry/action roles. The owner accepted the appearance and requested a shorter introduction, now applied.

P02 accepted, 2026-09-30: Stats reuses those components and adopts the shared `.rdd-filter-group` surface/control roles. Home and Stats are the header/action consumers; Stats alone adopts the filter surface. The selected feature size, existing 2rem section-gap role and matching filter panels were accepted with P02. Other pages retain their existing variants. See the [P01 record](release/p01-home-consistency-2026-09-30.md), [P02 record](release/p02-stats-consistency-2026-09-30.md) and [page ledger](page-consistency-and-copy-plan.md). This is no blanket approval of every draft token.

`AGENTS.md` is the automatic project entry point; `README.md` is the human entry point. Both route interface work here. Keep this as the single source of design decisions. A separate skill would currently duplicate a document-reading rule; reconsider one if a repeated audit/migration procedure develops under [skill governance](skill-governance.md).

For later approved UI work: identify the relevant contract, reuse a shared variant, and list any deliberate exception with its component/route, reason, contrast evidence and review condition. Implement the shared primitives first, then migrate a representative data page, a task page and a feature page before expanding. This is a future adoption approach, not authorization to start the migration.

Review against a component gallery containing every variant, size and state on panel and hero backgrounds in both themes. Include 320/390px, tablet and desktop, long labels/names, keyboard use, 200% text zoom and 400% reflow. Use actual rendered foreground/background colors for alpha/gradient states. Existing `lib/stats/contrast.test.ts` covers a subset of palette text pairs; `scripts/qa/review-contrast.spec.mjs` covers Statistics axis/story labels. Neither covers all release controls or establishes WCAG conformance. Expand meaningful coverage only as implementation is authorized.

Documentation-only revisions need local-link checks, consistency review, source/provenance checks and `git diff --check`. Application install/test/build, hosted access and database rehearsal are not required for this documentation change. Changes to application CSS/components later follow the repository's applicable implementation checks and visual acceptance requirements.

P03 accepted, 2026-09-30: Matches adopts `PageHeader`, `ActionLink` and native `ActionButton` plus shared opt-in form and panel roles. Header/action consumers are Home, Stats and Matches; form/panel/button consumers are currently Matches. Stats and Home appearance is retained. See the [P03 record](release/p03-matches-consistency-2026-09-30.md) for token adoption, checks and owner-review limits.

P04 accepted, 2026-09-30: League Night uses the same `PageHeader`, `ActionLink` and `ActionButton` family. Its opt-in `.rdd-form-controls` adopts existing controls without imposing fieldset layout. Wide/form width and pill-radius roles are central; night panels use existing padding/radius roles. The old `night.css` is retained for Planning, and `night-consistency.css` scopes every rule to `.night-shell--consistent` until P05 adopts its own presentation. This temporary layout duplication preserves unreviewed Planning; central action/form skins are not duplicated. See [P04 evidence](release/p04-league-night-consistency-2026-09-30.md).

P05 accepted, 2026-10-01: Planning adopts PageHeader (standard), ActionButton, ActionLink,
.rdd-form-controls and .rdd-content-panel. It no longer imports legacy night.css.
Planning layout rules are scoped to .planning-page; League Night retains its
accepted isolated rules. --rdd-shell-padding centralizes the existing fluid shell
padding without changing other consumers. Selected RSVP choices use shared
primary background/text roles; native pressed/checkbox semantics remain intact.
No new theme/action variant or access behavior is introduced. See the
[P05 review record](release/p05-planning-consistency-2026-09-30.md).

P06 accepted, 2026-10-01: Players adopts standard PageHeader, ActionButton/ActionLink for
retry/sign-in, and shared form/panel roles for search and linked roster rows.
Directory geometry uses the existing --rdd-content-form and --rdd-shell-padding;
row spacing, radius, borders and focus use central roles. All .directory-* rules
are consumed only by /profiles; no central role value or shared avatar component
changes. Adjacent avatar initials are decorative for the link's accessible name.
Existing alphabetical sorting, real-name search and name disclosure are retained.
See the [P06 review record](release/p06-players-consistency-2026-10-01.md).

P07 accepted, 2026-10-01: Player Profile adopts standard PageHeader with its named identity
slot, ActionButton/ActionLink and shared filter/form/panel roles. Its layout is
scoped to .player-page and uses the existing wide content, shell/panel padding,
spacing and inset-surface roles. The three league-summary cards occupy their own
responsive grid beneath the scope selector. Profile identity stays visible above
the mobile heading; its existing 80px avatar geometry is retained. Selected scope
and history choices use the primary color roles plus an underline and native
aria-pressed state, following Planning's token-based selection treatment.
ProfileSoloStats is only used here and now consumes these opt-in primitives
instead of importing Solo's page stylesheet. Solo itself is unchanged; no shared
primitive/token value, query or privacy behavior changes. See the
[P07 review record](release/p07-player-profile-consistency-2026-10-01.md).

P08 accepted: My Profile adopts compact PageHeader, shared ActionButton/ActionLink,
.rdd-content-panel and .rdd-form-controls. The existing 740px account width is
centralized as --rdd-content-account and consumed only by this page; its former
760px cap is brought into that existing account-width proposal. AvatarPicker has
no other page consumer and adopts these shared skins with account-specific layout
classes. Its image/initials geometry and stable avatar IDs remain unchanged.
Choice labels carry an underline as well as aria-pressed when selected, using the
established primary color roles. Repeated avatar initials are decorative beside
the named choice. Profile/checkbox/preview spacing consumes central roles; no
existing shared token value or other route style changes. Avatar and profile saves
remain separate. See the [P08 record](release/p08-my-profile-consistency-2026-10-01.md).


P09 candidate: Solo Play adopts feature PageHeader, shared ActionButton/ActionLink,
.rdd-content-panel and .rdd-form-controls in entry, history and progress. Shell,
spacing, panel inset, selection and metric sizes consume the existing central
roles; no shared token value changes. Selected tabs/format/scope choices retain
aria-pressed and add an underline. Intentional submit buttons retain type=submit;
all other actions use native button semantics. The benchmark uses themed inset
and text roles in both themes. PracticePerformance is a Solo-only consumer and
adopts the same panel, section heading, eyebrow and quiet action. Statistical
series colors, SVG mark/axis geometry and bounded horizontal table scrolling
remain domain-specific. Separate League Night activity styles are unchanged.
Solo reserves the root scrollbar gutter while its shell exists, preventing short
History content from shifting the centered layout. Phone navigation uses two
equal columns; Refresh keeps the shared outlined skin. Heading context chips
were removed following owner review.
See the [P09 record](release/p09-solo-consistency-2026-10-01.md).


P09 accepted 2026-10-01 at `6e4683b`.

P10-P15 accepted at `f4613de` on 2026-10-01: Rivalry Room, pair and challenge detail adopt PageHeader,
ActionButton/ActionLink and shared fields, ordinary panel geometry and spacing.
The fight artwork, canvas poster palette/export geometry, avatar geometry and TV
layout remain intentional domain exceptions. Inverse secondary actions use
central showcase roles; ordinary controls do not borrow poster colors.
The section-title size/tracking roles centralize the existing values unchanged.
ActionButton adds an opt-in danger variant for existing delete/revoke actions;
it changes appearance only and retains existing confirmations/handlers.
Board feed/thread/composer adopt shared actions, panels and form controls. The
poster's Board composer is an affected consumer and retains its 180px minimum
text area. Home's Board preview and League Night's challenge banner keep their
existing styles. Invites opts into shared headers/actions/fields/panels and
responsive form layout; Join stays on its legacy selectors until P17.
No query, permission, retention, retry identifier, statistics or SQL change.
See the [batch review record](release/p10-p15-consistency-2026-10-01.md).

P16-P20 accepted 2026-10-01 at `f238849`: account tasks adopt compact PageHeader, shared actions/panels/fields and the existing account-width role. Change Log adopts the standard heading, wide shell, panel and section-title roles. Layout rules are scoped to opting-in consumers; no token values, API or recovery/admission handlers change. Verify Email copy distinguishes confirmation links from invitation codes. See the [batch record](release/p16-p20-consistency-2026-10-01.md).

P21-P24 accepted 2026-10-01 at `8b1ed75`: the two diagnostic pages and both fallbacks adopt compact PageHeader, shared actions and a scoped `.utility-consistent` shell using the existing account width, shell padding, spacing and panel roles. Sanitized diagnostic output wraps within the panel. No token value or shared component changes. Utility language remains factual; only the missing-page title keeps a light league metaphor. Existing preview restrictions, session-only check, local-only error trigger and framework reset are preserved. See [batch record](release/p21-p24-consistency-2026-10-01.md).
