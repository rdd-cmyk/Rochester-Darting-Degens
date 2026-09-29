# RDD website design standards

Version: 1.5 • Reference visually reviewed: 2026-09-26 • Updated: 2026-09-28 • Reference: Advanced Statistics (`/stats`)

Repository location: `docs/design-standards.md`.

This is the design contract for website interface work. The owner has selected Advanced Statistics as the quality and style reference. The companion [site-wide upgrade plan](sitewide-design-upgrade-plan.md) tracks its active application to the remaining routes.

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
3. On Advanced Statistics, lead with useful summaries, then provide exact lookup and explanations. Home remains leaderboard-first: its overall leaderboard is the first substantive content after a compact page header, followed by the other existing leaderboard sections. Keep links to match recording and Advanced Stats easy to find without placing a league-overview dashboard or story-card grid ahead of the rankings. Do not invent summary metrics merely to fill cards.
4. Keep task pages efficient. A sign-in form or match editor should inherit the visual language without requiring a dashboard-sized hero.
5. Make trust visible: metric labels, sample sizes, missing-data treatment, pending states, and recovery paths are part of the design.
6. Let orange identify a primary action or a restrained highlight. It must not compete with every heading, border, and button.

Owner-confirmed preferences (2026-09-26): Home remains leaderboard-first; Summer decorations remain optional and restrained. These decisions govern the migration and future design work.

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

- Outer shell: width 100%, maximum 1240px, centered, padding `clamp(1rem, 3vw, 2.5rem)`.
- Main section gap: 2rem; 1.35rem at widths up to 640px.
- Hero: padding `clamp(1.5rem, 4vw, 3.5rem)`, radius 1.25rem, desktop minimum height 260px; no minimum height on mobile.
- Panels: 1px themed border, radius 1rem, restrained `0 12px 32px rgba(8,38,77,.07)` shadow.
- Story cards: radius .85rem, padding 1.15rem, 5px accent top edge, .85rem grid gap.
- Filter bar: padding 1rem, radius .9rem, .75rem gap; desktop sticky offset .75rem.
- Actions: padding .75rem 1rem, radius .65rem, strong label weight.
- Table cells: padding .85rem 1rem, themed row separators.

Use those values as the base family. Prefer a small shared spacing scale (0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3rem) plus the reference's fluid expressions and documented component-specific values. Do not mechanically replace the reference's distinct values merely to enforce a scale.

The site-wide shell supports a wide data layout up to 1240px, a readable form layout around 760–900px, and compact account content around 740px or narrower when the task calls for it, each capped at 100% available width. Use the implemented `.page-shell`, `.rdd-page-header`, `.rdd-panel`, `.rdd-action`, `.rdd-field`, `.rdd-state`, and scroll-region patterns before introducing another one-off surface. Keep form content aligned and avoid stretching short inputs across a full dashboard.

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
