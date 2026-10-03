# Release/next style guide source audit

Inspected: 2026-09-30. Remote `release/next` fetched successfully; the documentation checkout starts at `5061360221bf9d80c90aa7b1315ce029cde807e0` (Record W6 preview acceptance and amended rollback gate). The source review began at `cc52f6a` and was refreshed against the intervening `b24cba1` and `5061360` changes before handoff. Header geometry and palette remain as inventoried; newer changes include transparent Board/Statistics background layers and Rivalry dialog/incoming-request styling. This review uses the committed baseline, excluding concurrent uncommitted work in the release checkout. It is not a live-site or whole-site accessibility audit.

Authority: [design standards](design-standards.md). Review artifact: [interactive header and button comparison](mockups/style-guide-preview.html). No site changes are part of this work.

## What already exists

The release has a shared `--rdd-*` navy/orange/cream palette, compatible `--stats-*` roles, system light/dark handling, `.page-shell`, `.rdd-page-header`, `.rdd-panel`, `.rdd-action` and state/field patterns. The original guide already specifies text contrast and shared components. The gap is adoption and precision: integrated features still define independent action/header families, and several dimensions/states are left to each page.

## Header inventory

| Family | Representative source | Current differences |
| --- | --- | --- |
| Compact shared gradient | [global CSS](../app/globals.css), [Home](../app/page.tsx), [Matches](../app/matches/page.tsx), [Profiles](../app/profiles/page.tsx) | `#08264d → #164b80`, radius 1rem, title `clamp(1.65rem,3vw,2.5rem)`, compact padding `clamp(1rem,2.5vw,1.5rem)`. Home also has logo and eyebrow override. |
| Statistics feature hero | [Statistics](../app/stats/page.tsx), global CSS `.stats-hero` | Solid theme-aware navy, cropped decorative ring, radius 1.25rem, desktop minimum height 260px, uppercase title `clamp(2.4rem,7vw,5.5rem)`, line-height .92, own action family. |
| Solo feature hero | [Solo CSS](../app/solo/solo.css), [Solo page component](../components/solo/SoloPage.tsx) | Radius 18px, padding 36px, uppercase title `clamp(44px,7vw,76px)`, line-height 1.05, own ring/tags. Mobile override uses 48px title and 26px/20px padding. |
| League Night hero | [Night CSS](../app/league-night/night.css), [Night page](../app/league-night/page.tsx) | Independent shell/hero (20px radius, 30px/32px padding, concentric rings), title `clamp(2rem,4vw,3.2rem)` and line-height 1.08. Signed-out and active-night structures also vary. |
| Planning heading | [Planning](../components/planning/PlanningPage.tsx), [planning CSS](../app/league-night/plan/planning.css) | Uses Night shell/type, a separate back link, eyebrow, title and organizer actions; title area is not the Night hero. |
| Board heading | [Board](../components/board/LeagueBoard.tsx), global CSS `.board-heading` | Plain header, title `clamp(2rem,5vw,2.7rem)`, weight 750, access label; narrower 820px shell. |
| Rivalry heading | [Rivalry Room](../components/rivalries/RivalryRoom.tsx), [rivalry CSS](../components/rivalries/rivalries.css) | Plain title `clamp(32px,4vw,52px)`, line-height 1.1, fixed orange eyebrow/period; different welcome/loading headings. The fight poster is separate domain content. |
| Invite/account/state headings | [Invites](../app/invites/page.tsx), [Join](../app/join/page.tsx), [My Profile](../app/profile/page.tsx) | Mix of shared headers and invite-specific type/layout; compare state branches during later adoption. |

## Action inventory

| Family | Fill/text | Geometry |
| --- | --- | --- |
| Shared `.rdd-action--primary` | Theme orange / `#08264d`; hover `#ffc28f` | 44px minimum height, radius .55rem, padding .62rem/.95rem, weight 700 |
| Statistics primary | Theme orange / `#1d1a16` | Radius .65rem, padding .75rem/1rem, weight 800; hover translates vertically |
| Board primary | Theme navy / `#fff3dc`; hover fixed `#123d73` | 44px minimum height, radius 8px, padding .55rem/.85rem, type .85rem |
| Invite primary | Fixed `#08264d` / white | 44px minimum height, radius .55rem, padding .65rem/1rem, weight 600 |
| Night primary | Theme orange / `#101827`; hover brightness filter | 44px minimum height, radius 10px, padding 9px/14px, type .875rem, weight 750 |
| Solo controls/save | Neutral panel/text, orange save; independent tabs | 44px minimum height, radius 9px, padding 10px/14px, weight 600; selected border/shadow and disabled opacity differ |
| Rivalry primary | Fixed `#ed692f` / `#111a29` | Radius 7px, padding 13px/20px, type 14px, weight 900; own focus and disabled rules |

Source differences establish drift; they do not mean every variation is a defect. Selection controls, nav items and domain showcase controls need their own semantics. The proposal standardizes repeated action roles rather than turning every interactive element into an orange button.

## Measured solid-color pairs

Calculated from the committed CSS with the WCAG sRGB relative-luminance formula (0.04045 linearization threshold). Ratios displayed to two decimals; thresholds were compared without rounding. These are selected solid pairs, not computed browser styles. Gradients, alpha overlays, every state and every route remain unverified.

| Foreground / background | Ratio | Implication |
| --- | --- | --- |
| Light ink `#101827` / panel `#ffffff` | 17.77:1 | Ordinary text passes |
| Light muted `#5b6472` / panel `#ffffff` | 5.98:1 | Ordinary text passes |
| Light muted `#5b6472` / canvas `#f4f1eb` | 5.31:1 | Ordinary text passes |
| Dark ink `#f4f6f8` / panel `#111b2b` | 15.95:1 | Ordinary text passes |
| Dark muted `#b9c2ce` / panel `#111b2b` | 9.60:1 | Ordinary text passes |
| Primary navy label `#08264d` / light orange `#f47c20` | 5.56:1 | Ordinary action label passes |
| Primary navy label `#08264d` / dark orange `#ff9344` | 6.82:1 | Ordinary action label passes |
| White `#ffffff` / light orange `#f47c20` | 2.71:1 | Fails text contrast; avoid this label pairing |
| Light orange `#f47c20` / white panel | 2.71:1 | Fails text contrast and a required 3:1 control silhouette; use another role/strong border when needed |
| Light subtle border `#d8dce3` / white panel | 1.38:1 | Suitable as decorative divider, insufficient as an essential control boundary |
| Dark subtle border `#2b3b52` / dark panel | 1.52:1 | Same boundary limitation |
| Light input border `#858c98` / white panel | 3.39:1 | Stronger boundary meets 3:1 |
| Dark input border `#76869b` / dark panel | 4.65:1 | Stronger boundary meets 3:1 |
| Hero title `#fffaf0` / light navy `#08264d` | 14.47:1 | Text passes |
| Hero copy `#dbe7f4` / light navy | 12.01:1 | Text passes |
| White / gradient end `#164b80` | 8.93:1 | This endpoint passes; rendered decorated combinations still need checks |
| Hero copy `#e2eaf4` / gradient end | 7.36:1 | This endpoint passes |
| Rivalry eyebrow `#d55320` / shared light canvas `#f4f1eb` | 3.66:1 | Fails ordinary text threshold for its 11px eyebrow; rendered context needs confirmation |
| Light focus blue `#0366d6` / white panel | 5.42:1 | Passes 3:1 |
| Light focus blue `#0366d6` / light navy `#08264d` | 2.78:1 | Fails 3:1 if applied on this surface; inverse focus role needed |

See [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) for scope and exceptions. A passing subset is not WCAG conformance.

## Decisions and scope

- Existing owner choices remain: navy/orange/cream identity, Statistics as a quality reference, Home leaderboard-first and optional restrained Summer decoration.
- Proposed: semantic component tokens, one small action family, shared geometry/states, WCAG 2.2 AA target, one page-header structure with named sizes.
- Owner decision, 2026-09-30: D — Plain heading, including The Rivalry Room's orange terminal period coordinated with the eyebrow. See section 14 of the guide. The original preview's open-choice wording predates this decision; its controls remain temporary exploration. Exact dimensions and semantic accent values remain proposals.
- No CSS, TSX, package, database or deployment changes. Guide/pointers and a local documentation preview only. No application checks are claimed for this revision.

For later adoption, start with shared controls/header, then validate a representative task/data/feature page before migrating all routes. Keep a scoped exception record and preserve existing product rules. Do not use this guide as migration or publication authorization.

## Documentation verification

2026-09-30: 33 local Markdown links resolve (excluding fenced examples meant for the root AGENTS file); preview links resolve; `git diff --check` passes. Browser checks exercised all four header selectors at desktop width, light/dark themes with a long title at a 320px preview width, the full preview document at 320px, and the simulated pending action. Checked layouts had no horizontal document overflow. Header reconstructions intentionally preserve observed styling differences; they are not approved visual baselines. No application install, test suite, build, hosted verification or deployment was performed for this documentation revision.
