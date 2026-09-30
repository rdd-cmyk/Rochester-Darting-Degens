# Page consistency and league voice plan

Prepared: 2026-09-30. Status: **P01-P02 accepted; P03 awaiting owner review; P04-P24 unstarted**.
Baseline: `release/next` at `351a4b0253f2c7f05d7a70708597d1c847977c65`.

Before this plan was written, the release position was saved in the
[pre-consistency checkpoint](release/pre-consistency-checkpoint-2026-09-30.md).
W0-W5's dated evidence is retained; affected W6 closeout and W7/W8 wait until this
pass is accepted. This document plans future work only. It does not authorize
implementation, publication, hosted changes or production cutover by itself.

## Intent and boundaries

Make the existing pages feel like one site through small, reviewable consistency
adjustments. Keep the Rochester navy/orange/cream identity, current features,
information order and page-specific character. Follow the updated
[design standards](design-standards.md), including the selected plain heading
with orange terminal period. Keep Home leaderboard-first, optional restrained
Summer decoration, the new navbar/logo and curated avatars.

Each work package owns **one page**. A dynamic route means one reusable page
template, not a package for each player, thread or challenge. Error and not-found
fallbacks have their own single-page packages. Tabs, dialogs, loading and error
states belong to the page that opens them. API endpoints are not visual pages.
The inventory below covers all 22 current `page.tsx` routes and two fallback
pages; re-enumerate the tree before starting and add a row for a new page.

This is a consistency pass, not a new dashboard, new feature, wholesale layout
rewrite, font replacement or dependency upgrade. Preserve queries, handlers,
calculations, saved identifiers, data precision, routes, access/privacy rules and
recovery semantics. No SQL or Supabase configuration changes are planned.
If an existing defect needs a behavior change, record it separately and assess
its release impact before widening the page package.

The earlier [site-wide upgrade plan](sitewide-design-upgrade-plan.md) remains
historical implementation/evidence context. This plan controls the next pass's
page order and review stops; it does not restart its old M0-M8 migration.

## Shared foundations without a multi-page package

P01 introduces only the minimum central roles and reusable presentation needed
by Home. Subsequent pages extend those same primitives when a repeated need
appears. Shared work belongs to the current page package, not an extra foundation
package or a silent migration of other pages.

- Keep palette, semantic roles and component variants distinct. Define recurring
  color, spacing, radius, width, control-height and interaction decisions once.
  Route CSS owns domain layout; it does not invent another button or title skin.
- Reuse existing `--rdd-*`, shared classes and `--stats-*` compatibility roles.
  Introduce missing semantic aliases centrally. Do not rename every token or
  break contrast checks that parse existing explicit values.
- Use one shared page-header family: optional eyebrow/back link, one h1 with
  the orange period, concise description and optional context/actions. Compact,
  standard and feature sizes share that appearance. Preserve useful domain
  showcases below it, including the Rivalry poster.
- Use shared primary, secondary, quiet and destructive actions, with common
  geometry and explicit pending/disabled/focus states. Tabs and filters use
  selection variants, not primary-button styling. Preserve native semantics.
- Remaining guide values are proposals. For each package, document the concrete
  subset being adopted and show it in the page review; do not claim every draft
  token is already approved. Prefer current established values when equivalent.
  Update the guide's adoption record after the owner's page acceptance.
- Keep old consumers compatible until their page is converted. Use scoped or
  opt-in variants; do not change global `.rdd-action` or header meaning in a way
  that silently restyles all remaining pages. If a shared change affects accepted
  pages, retest them and reopen their acceptance if the visible result changes.
- Avoid broad final CSS overrides, copied variants or fixed widths to conceal
  inconsistencies. Preserve legitimate chart coordinates/avatar geometry.

The navbar/footer/shared canvas are regression surfaces in every package; they
are not additional redesign packages. Fix a verified shared inconsistency only
as narrowly as needed and record every affected page. No changes to the recently
accepted navigation layout are assumed.

## Wording: friends' league, broadcast energy

Use the existing friendly sports-announcer voice: confident, brief, competitive
and playful. Keep the sense of a bunch of friends chasing bragging rights.
Retain good existing lines rather than rewriting everything to sound identical.

Use energy in headings, introductions, recaps and rivalry context. Examples of
tone, not mandatory replacements: “The league standings,” “Tonight's lineup,”
“The tale of the tape,” and “Your next shot at bragging rights.” Pair that voice
with concrete task labels such as “Save result,” “Send invitation,” “Accept
challenge,” and “Resume draft.” A user should know what a button does.

Keep instructions, validation, privacy, permissions and recovery plain and
precise. “Your result wasn't saved. Retry with the same entry” is more useful
than a joke when connectivity fails. Do not invent standings, dates, live status,
records, probabilities or a winner for flavor. Never imply a draft was posted,
an unconfirmed save succeeded, or private data is public. Practice stays practice;
small samples and provisional ratings keep their caveats.

Each package includes a short **keep / revise / reason** copy review covering
title, eyebrow, description, help, labels, empty/loading/error/success states,
confirmation dialogs and relevant share/poster captions. Keep established terms
consistent across pages and preserve 3DA, PPD, MPR and team-result meanings.
The owner reviews wording together with the visual changes.

## One-page work packages, in order

All rows start **not started**. Finish and obtain owner acceptance for a row
before beginning the next row. Suggested order puts shared data/form patterns
early, then competition/community pages, then account and utility pages.

| Package | One page / primary source | Small consistency and wording focus | Behaviors and states to protect | Status |
| --- | --- | --- | --- | --- |
| P01 | Home `/` — `app/page.tsx` | Compact plain title, standings copy, shared table/section/control spacing; establish minimum reusable roles. | Overall leaderboard first; all other existing tables, sorting, selection, player links, sample/record meanings, loading/empty/access/failure states. | Accepted |
| P02 | Advanced Stats `/stats` — `app/stats/page.tsx` | Align title/actions/filters with P01 while retaining analytical content; review broadcast introductions and precise methodology. | Filters, eligibility versus match counts, chart geometry/series, exact history, provisional badges, scored-game counts, numerical outputs and bounded overflow. | Accepted |
| P03 | Matches `/matches` — `app/matches/page.tsx` | Common task header, participant fields, actions, validation and history cards; concise result-entry instructions. | Existing game/team modes, winner, units, date/board/venue/notes, create/edit/cancel, permissions, pending saves, exact retry and history pagination. | Awaiting owner review |
| P04 | League Night `/league-night` — `app/league-night/page.tsx` | Consistent night setup, attendance, score-entry sections, recap, TV/share controls and modal presentation; announcer-style recap copy. | Creation/resume, attendance, individual/team saves, rematch, recovery, practice classification, awards, refresh stability, poster preview and export. | Not started |
| P05 | Night Planning `/league-night/plan` — `app/league-night/plan/page.tsx` | Align poll/suggestion/RSVP controls and status wording; keep the next-night energy. | Organizer/member differences, hidden open-poll tallies/authors, own withdrawal, two-suggestion cap, poll close/schedule and binary RSVP states. | Not started |
| P06 | Players `/profiles` — `app/profiles/page.tsx` | Shared directory header/search/rows, avatar/name alignment and friendly league-roster introduction. | Search, order, disclosure/name formatting, links, no-results versus no-data, and access/failure states. | Not started |
| P07 | Player Profile `/profiles/[id]` — `app/profiles/[id]/page.tsx` | Consistent identity/header, record panels, history filters and Solo summary disclosure; competitive profile wording. | History/filter-before-pagination, stale-response handling, private versus missing summary, explicit Solo opt-out, units, profile-not-found versus request failure. | Not started |
| P08 | My Profile `/profile` — `app/profile/page.tsx` | Align avatar picker, identity preview, fields and save/cancel feedback; inviting personality copy. | Stable avatar IDs/selection/persistence, name-disclosure settings, disabled view mode, edit/reset/cancel and confirmed save/recovery. | Not started |
| P09 | Solo `/solo` — `app/solo/page.tsx`, `components/solo/SoloPage.tsx` | Unify entry/history/progress tabs, fields and states; training/broadcast tone that stays separate from league results. | 301/501/701/Cricket order, logging/edit/delete/undo/retry, privacy, summary default-on with stored opt-out, night-practice defaults/linking and no competitive effects. | Not started |
| P10 | Rivalry Room `/rivalries` — `app/rivalries/page.tsx` | Shared page heading/rows/actions around the existing distinctive showcase; preserve its strongest rivalry copy. | Prominent incoming challenges, avatar/name display, discovery/history, access/loading/empty/failure and challenge setup. | Not started |
| P11 | Rivalry Pair `/rivalries/pair/[left]/[right]` — matching `page.tsx` | Align record sections, chapter cards, challenge actions and poster dialog; keep tale-of-the-tape character. | Pair identity, statistics definitions, chapter data, challenge creation, poster export/preview and Board draft permission boundary. | Not started |
| P12 | Challenge Detail `/rivalries/challenges/[id]` — matching `page.tsx` | Common status badges, series/result controls, repair selector and confirmations; clear competitive stakes. | Participants/permissions, accept/decline lifecycle, eligibility/revision checks, match correction/repair, best-of progression and exactly-once result handling. | Not started |
| P13 | League Board `/board` — `app/board/page.tsx` | Align feed/composer/access panels, actions and retained-draft affordance; friends' clubhouse voice. | Access request/moderation/organizer rules, categories, drafts and their tab-local storage, Keep/Resume/discard, poster text/image limitations, save and read errors. | Not started |
| P14 | Board Thread `/board/[id]` — matching `page.tsx` | Consistent post/reply structure, author/metadata hierarchy, actions and moderation wording. | Markdown/links/long content, replies, editing/moderation rights, posting/retry, missing thread versus temporary failure. | Not started |
| P15 | Invites `/invites` — `app/invites/page.tsx` | Shared form/history/status treatment; welcoming league invitation wording with clear required fields. | Active-member gate, origin restriction, send/pending/failure/retry, existing revoke/expiry behavior and invitation history retention. | Not started |
| P16 | Sign In `/auth` — `app/auth/page.tsx` | Compact account title, fields and recovery action; warm league welcome with explicit sign-in instructions. | Invite-only admission, password visibility, session/redirect transitions, pending/errors and recovery request behavior. | Not started |
| P17 | Invitation Join `/join` — `app/join/page.tsx` | Align verification/registration fields and steps; friendly invitation introduction, factual security messages. | Token validity/expiry, verification code flow, admission and membership provisioning, field validation, pending/retry and successful next step. | Not started |
| P18 | Verify Email `/auth/verify-email` — matching `page.tsx` | Shared compact account header/message/actions; clear next-step copy. | Actual supported confirmation path, email-present/absent states, safe display of address and existing sign-in destination; do not imply this replaces invite verification. | Not started |
| P19 | Reset Password `/reset-password` — matching `page.tsx` | Consistent account fields/status/action layout; especially clear expired and success messages. | Recovery-session/hash handoff, pending/update failure, validation, no false no-active-reset flash, confirmed success and Continue to Matches. | Not started |
| P20 | Change Log `/change-log` — matching `page.tsx` | Shared title, update cards/date metadata, pagination and state wording; release-note voice. | Main-only merged PR feed, links, dates, paging, auth/member gate, loading/empty/upstream failure distinctions. | Not started |
| P21 | Release Readiness `/release-readiness` — matching `page.tsx` | Shared compact utility shell, readable wrapped diagnostic output and precise scope statement. | Preview/release-branch restriction, sanitized output, connection-isolation meaning; never call it full release/DB acceptance. | Not started |
| P22 | Client Diagnostics `/test-supabase` — matching `page.tsx` | Consistent utility title/status and restrained factual wording. | Session-check scope, no false database-connectivity claim, fixture-only error trigger stays disabled on hosted preview. | Not started |
| P23 | Not Found — `app/not-found.tsx` | Shared compact missing-page experience and friendly useful exit. | Genuine 404/missing context, safe destination, keyboard focus and no suggestion that a failed request means a missing record. | Not started |
| P24 | Error Fallback — `app/error.tsx` | Shared failure presentation, readable message and existing retry action; plain recovery copy. | Framework reset/retry, safe boundary rendering, access to navigation, and no misleading save/undo assurance. | Not started |

Per-package source listings are entry points: inspect rendered shared children,
dialogs and CSS before editing. Changes stay scoped to that page and its minimum
compatible shared dependencies. No package is marked complete just because its
title was replaced or its tests passed.

## Repeatable package workflow and review stop

1. **Inspect and propose.** Refresh branch/diff, guide and baseline for the page.
   Capture current desktop/mobile and light/dark states with stable fixtures.
   List a short visual delta and the keep/revise/reason copy review. Use a small
   mockup only if a decision would otherwise be hard to judge; a new full-page
   design is not the objective. Record existing defects separately.
2. **Implement the one page after its package is requested.** Keep product logic
   intact; extract/reuse compatible primitives and document the token subset.
   Include its tabs/modals/alternate states. Avoid unrelated cleanup.
3. **Verify.** Run the required implementation checks from `AGENTS.md`: trusted
   install, tests, coverage, lint, type-check and build. Add regression tests
   only for a meaningful behavior risk or verified defect, not mirrored CSS.
   Use isolated synthetic fixtures for writes; production data is not a UI
   fixture. Record any unavailable device/access/state check explicitly.
4. **Review the rendered result.** Compare before/after in light/dark at 320px,
   390px, tablet and desktop. Check relevant populated/loading/empty/filter-empty/
   signed-out/access-restricted/error/pending/success states, long labels/names,
   keyboard/focus, 44px standalone targets, contrast, text zoom/reflow, scrolling
   and reduced motion. No broad WCAG conformance claim from a sample.
5. **Check shared consumers.** When central CSS/components change, inspect Stats
   and another affected page in both themes on mobile/desktop, plus accepted
   consumers actually affected. Ensure navigation, Summer preference and footer
   remain intact. Reopen a row if a later change visibly alters its accepted UI.
6. **Present for owner review.** When publication is part of the requested
   package, commit only its scope, push `release/next`, and verify exact CI/Vercel
   identity and test-project isolation. Provide the preview link, a screenshot,
   brief changes/copy rationale, checks and limitations. Preserve unrelated work.
7. **Stop at this page.** Status becomes **awaiting owner review**, not passed.
   Adjust the same page until accepted. Record the owner's acceptance, source
   SHA and evidence, then mark **accepted**. Start the next package only when the
   owner requests it. Do not batch the remaining pages in the background.

These are future implementation steps; no tests, mockups, previews or application
changes are required to complete this planning-only request.

## Progress and evidence ledger

Use row status: **not started → in progress → awaiting owner review → accepted**.
Use **blocked** for a named missing prerequisite and **reopened** for affected
accepted pages. Keep the package table current and add a ledger row per package:

| Package | Source SHA / preview identity | Visual and copy delta / shared dependencies | Checks and evidence | Owner acceptance / limits | Next action |
| --- | --- | --- | --- | --- | --- |
| Plan | Baseline `351a4b0`; documentation only | Release checkpoint saved; 24 page packages inventoried. | Source/route/link/whitespace review only; no implementation verification claimed. | All packages unstarted. | Owner chooses to start P01, or requests a different first page. |
| P01 | App `2d81b61`, evidence `f757ed0`; shorter copy in P02 commit | Shared heading/actions/spacing retained. | Original checks and CI passed; Home rechecked in P02. | Owner accepted 2026-09-30 with shorter intro. | Accepted; preserve this appearance. |
| P02 | App `21f3e53`; stable preview | Shared feature heading/actions and filter roles adopted. | Full local checks, CI/Vercel and hosted read-only smoke passed. | Owner accepted 2026-09-30. | Accepted; retain appearance. |
| P03 | Baseline `21f3e53`; exact publication identity in QA packet | Matches adopts header/actions/form/panel roles and concise intro/link wording. | Full local checks, eight theme/width checks, local UI save/retry/team/history states, contrast and Home/Stats smoke. See P03 record. | Awaiting owner review; fixture saves are UI-only evidence. | Review P03; do not start P04. |

Keep screenshots and private synthetic fixture details in the existing ignored
QA locations; store a concise sanitized summary in `docs/`. Do not put credentials,
invitation tokens or real account details in the plan. For shared primitives,
keep a consumer/adoption list and review affected accepted rows before changing
their tokens. A final sweep is a completion gate of this plan, not a multi-page
implementation package.

## Finish the pass and return to W6/W7

Completion requires all 24 rows owner-accepted (or an explicit owner-approved
scope exception), guide/adoption/consumer records current, and no unresolved
regression in the changed pages. Perform a final combined read/journey sweep
covering navigation, profile, planning, match/night, Solo, Board, challenges,
invitation and password recovery, plus targeted full checks on the final SHA.
Do not repeat broad testing without changed code or an unresolved concern.

Then follow the [release checkpoint](release/pre-consistency-checkpoint-2026-09-30.md):
refresh the final app/candidate addendum; review any remaining W6 human/affected-
flow acceptance and the separate dependency/credential gates; include both W6
SQL supplements in the final rehearsal; rebuild the compatible rollback app;
and execute W7's exact artifact/SQL packet and owner go/no-go. W8 still needs the
fresh protected backup, drained write pause, approved production cutover and
observation. A UI pass cannot count as production or DB rehearsal evidence.

P01 accepted by the owner on 2026-09-30 with the shorter introduction: “Check the standings, follow the rivalries, and see who holds the bragging rights.” The owner authorized P02 in the same message. [P02 review record](release/p02-stats-consistency-2026-09-30.md) records the token adoption and checks. P02 was accepted and P03 authorized on 2026-09-30. See the [P03 review record](release/p03-matches-consistency-2026-09-30.md); do not start P04 before P03 acceptance and authorization.
