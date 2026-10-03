# The Rivalry Room and player avatars

Created: 2026-09-28. Status: implemented and locally verified on `rivalry-room`;
owner visual/play acceptance and hosted release gates remain open. See the
[implementation handoff](rivalry-room-handoff-2026-09-28.md).

## Purpose and scope

Make RDD feel like a professional sports presentation starring the people in
this league. The first visit should deliver an immediate visual surprise; the
next visit should matter because a real rivalry or accepted challenge changed.

The owner requested a plan for the Rivalry Room, emphasized an exceptional
first impression, and added player-selected profile avatars, potentially from
a pool of generated cartoon characters. This document records that direction
and records the proposed defaults. The subsequent instruction to build the
reviewed concept authorized the implementation described in the handoff.

The original task created this plan only. On the owner's subsequent mockup
request, a first [interactive concept](mockups/rivalry-room.html) and a
six-character art pilot were created. See the [preview notes and art
provenance](mockups/rivalry-room-assets/preview-notes.md). This is a synthetic
design checkpoint for owner review; application implementation is future work.

Source inspected: `release/next` at
`16e58f991fb9e357c590e3959e0c00e1d9d568b1`, in the existing
`Rochester-Darting-Degens-league-night-mode` worktree. This plan is a future
feature proposal; it does not add scope to the recorded W0 inventory or change
the [current release plan](release-next-readiness.md). Choose its integration
base and release placement when implementation begins.

## The experience to build

**Discover a rivalry → issue a challenge → play the showdown → keep the story.**

An illustrative first screen, using fictional results:

> BEN vs MIKE
>
> 24 GAMES. DEAD EVEN. UNFINISHED BUSINESS.
>
> Recorded singles series: 12–12. Ben has won the last three meetings.
>
> Challenge Mike at the next League Night.

Two expressive player portraits face each other inside a custom matchup
poster. The numbers, headline, and next action form one composition. Below it,
the player can explore the rivalry's past or arrange its next chapter.

Someone with few wins should still find a meaningful matchup. Participation,
close series, personal progress, and familiar opponents give the page value
throughout the league. No global rank is required to be the main event.

### Page structure and discovery

| Surface | Proposed behavior |
| --- | --- |
| `/rivalries` — Rivalry Room | Lead with the viewer's active showdown, then an upcoming accepted challenge, then a supported personal rivalry. Include an opponent picker, a small set of rivalry stories, and incoming/outgoing challenges. |
| Pair detail | A stable member-only page for two players: matchup poster, scoped series record, recent meetings, turning points, and challenge action. Route shape can be finalized with the mockup. |
| Challenge detail | Stable member-only URL for one accepted series, its terms, score, linked games, and final result. A rivalry can contain multiple challenges over time. |
| My Profile | Select, preview, save, change, or remove a roster avatar. Show the avatar on the profile and in a player-card preview. |
| Existing entry points | Add Rivalries to navigation and a compact personal entry on the homepage. Link from player profiles and League Night; preserve the existing recording flow. |

Choose the initial opponent deterministically. Prefer an active challenge;
otherwise use eligible rivalry stories, then the most recently played singles
opponent. Let the player choose someone else without navigating away. Never
invent a personal rivalry for a member with no recorded opponents.

## Art direction: make the first screen exceptional

Use the RDD navy, dartboard orange, cream, charcoal, and restrained silver.
Build a recognizable broadcast identity: oversized condensed headings,
expressive illustrated portraits, crisp score numerals, angled framing,
subtle paper/arena texture, and controlled lighting behind the characters.
Keep typography and scores as real HTML so they stay sharp and accessible.

The hero should look art-directed, with a deliberate silhouette and hierarchy.
Reserve dense statistics for the supporting sections. One main action and
one clear storyline should be apparent within five seconds.

| Moment | Intended treatment | Usability requirement |
| --- | --- | --- |
| First reveal | Portraits settle into position; a short light sweep resolves into the matchup title and series score. | About 600–900 ms, once per entry. Content and controls work immediately; reduced motion renders the completed composition. |
| Opponent selection | Both cards and the shared history transition together. | Keep focus stable; no page reload or temporary display of mismatched players/results. |
| Challenge acceptance | Reveal a finished fight poster with the agreed game, night, and race target. | Only after confirmed acceptance; no forced animation, sound, or sharing. |
| Recorded game | Update the series score and highlight the newly confirmed result. | Use saved games, with last-updated/stale indicators; never imply dart-by-dart scoring. |
| Series completion | A restrained winner reveal becomes a permanent result card. | Avoid replaying celebrations on every refresh or making the losing player a joke. |
| TV view | Fullscreen poster, huge series score, clear race target, and latest result. | Explicit entry/exit, keyboard support, reconnect state, and no automatic screen takeover. |

On mobile, retain two recognizable portraits and a central series score in a
compact composition, with readable names and the primary action near the hero.
Do not shrink the desktop poster until its text becomes unreadable. Use a
separate mobile arrangement. TV view is part of the same challenge page.

No autoplay audio, flashing effects, confetti loops, forced intros, hover-only
controls, or motion needed to understand a result. A static screenshot should
still feel distinctive. Light and dark themes both receive intentional styling.

## Player avatars: an original RDD roster

### Proposed launch direction

Create **24 original cartoon avatars** with one cohesive art style. Treat them
as a roster of memorable characters: bold silhouettes, expressive faces,
slightly mischievous sports personality, and consistent portrait framing.
They should look appealing at 40 px and impressive on a large matchup card.

Start with a six-character art pilot before generating the entire pool.
Suggested pilot: a confident raccoon, focused fox, determined bull, unbothered
owl, retro robot, and cheerful skeleton. These establish a range of shapes
and personalities without requiring caricatures of actual members. Final
characters and names remain open to revision after seeing the contact sheet.

Use a shared chest-up crop, eye line, lighting, outline weight, material
treatment, and limited accent palette. Favor mostly forward-facing or mild
three-quarter poses that work on either side of a matchup. Keep important
details inside circular and rounded-square crop guides. Avoid baked-in text,
scores, medals, brand marks, or backgrounds that clash with the page.

The proposed initial picker is a curated roster. Personal image uploads and
in-app image generation are later options, not requirements of this launch.
Choosing an avatar is free, changeable, and unrelated to rating or membership
privileges. Multiple players may choose the same character; names remain
visible everywhere. Do not assign a character from someone's name, sex, or
assumed personality.

### Art production and asset handoff

1. Establish a style brief and six-character contact sheet using image
   generation. Use original designs, retain prompts/references, and record
   generation date/tool plus the selected output and subsequent edits.
2. Review the pilot in actual 40 px list rows, a 96 px profile crop, a large
   matchup card, and both themes. Check consistency and recognition before
   producing the remaining characters.
3. Produce each approved character as an individual high-resolution image
   with a transparent background. Keep source masters separate from optimized
   site assets; do not ship a contact sheet as the picker implementation.
4. Export optimized small, medium, and hero variants with consistent dimensions
   and alpha edges. Reuse the same approved artwork across sizes.
5. Maintain an asset manifest: stable ID, friendly label, source/master path,
   web paths, dimensions, provenance, version, review status, and availability.
   Keep retired asset IDs resolvable for previously saved selections.

Proposed assets: `public/avatars/rdd-v1/`; catalog metadata under `lib/avatars/`;
art brief, manifest, and contact-sheet evidence under `docs/art/avatars/`.
Confirm repository size/LFS conventions before adding source masters. Avoid
celebrity likenesses, franchise characters, or copying another product's art.

### Profile picker and save behavior

- Add a prominent **Choose your avatar** control to My Profile, with the
  current selection, a labeled grid, and a larger live player-card preview.
- Selection changes the preview; **Save avatar** persists it. Cancel restores
  the saved selection. Avatar-only updates must not require editing unrelated
  profile fields or overwrite a newer name/preference from another device.
- Include **Use initials** as an explicit choice. Existing profiles begin
  with a deterministic initials fallback, not a randomly assigned character.
- Save a stable catalog ID, never a client-supplied asset URL or storage path.
  Validate the ID on the server and allow only the owner to change it.
- Preserve the pending choice after an error. On an ambiguous save, read the
  current server selection before retrying or showing success. Reconcile
  concurrent edits with a revision check and an understandable conflict state.
- Support keyboard navigation, selected-state labels, visible focus, and at
  least 44 px targets. Decorative duplicate portraits should not repeat names
  unnecessarily to screen readers.
- Use one shared avatar renderer for Rivalries, profiles, player selection,
  League Night, and Board author rows. Preserve existing name-display choices
  and access rules; a missing or retired image must have a usable fallback.

## Rivalry stories must be earned by the data

The homepage already has a head-to-head table; this feature adds presentation,
discovery, agreed series, and lasting chapters around pairwise history.
Existing home-page calculations must be examined before reuse: opponents in
a free-for-all or team game are not automatically a singles rivalry result.

Launch rivalry records use completed competitive singles with exactly two
distinct players and one winner. Exclude practice, team/free-for-all games,
handicaps, tied/abandoned results, and invalid records. Preserve the current
statistics engine's rules; do not award extra Power Rating for winning a
challenge. The underlying games already contribute normally.

- Show **Recorded singles series**, its game/board/rules scope, and game count.
  An all-games record can summarize wins/losses but cannot merge incompatible
  score averages. Unspecified historical board/rules remain visibly unknown.
- Offer game and board filters; compare scores only within the existing
  compatible-rule cohorts. Never fill missing averages or raw stats with zero.
- Pairwise streaks use only that pair's eligible meetings, ordered by
  `played_at` and the existing stable chronology tie-breaker. Show dates.
- Use the existing rating engine for any displayed rating/form, with an
  explicit matching scope and provisional marker. No new opaque overall score.
- “Career” or “first ever” claims require complete relevant recorded history;
  otherwise say “in recorded history” and expose the coverage limit. A failed
  or partially loaded query cannot establish a record, absence, or milestone.

Proposed discovery rules, to verify against synthetic history in the mockup:

| Story | Minimum evidence and selection |
| --- | --- |
| Closest series | At least five eligible meetings and a win difference of zero or one; prioritize more meetings, then recency. |
| Familiar opponent | At least three eligible meetings; most meetings, then recency. |
| Turning the tide | The player previously trailed the recorded series and has won the last two or more meetings; show the actual before/after record. |
| New chapter | Fewer than three meetings or none: show the exact record or “Your first recorded meeting awaits,” plus a challenge action. |

Use deterministic, testable sentence templates. Link each story to the games
supporting it. No runtime AI is needed to invent commentary, predictions, or
personality labels. Do not fabricate dramatic moments from summary-only data.

## Challenges: clear terms and a trustworthy result

### Proposed first-release rules

- Singles only; 301, 501, and standard Cricket using known catalog presets.
  Select board type, rules, and best of 3, 5, or 7 **games**. One eligible saved
  RDD result counts as one game; do not call those records legs or sets.
- Select an upcoming scheduled League Night. Default to the next one. If no
  night exists, keep rivalry browsing available and link to planning. Ad hoc
  unscheduled challenges can follow after this flow works.
- Show **First to 2/3/4 wins**, opponent, game, board, rules, and night before
  sending. The invited player sees identical terms before accepting.
- Allow only one pending or unfinished challenge for the same unordered pair
  at the same night. Propose a maximum of three outgoing pending invitations
  per player and a 24-hour resend cooldown after a decline/withdrawal, enforced
  server-side. Surface invitations in the site; email/push is later scope.
- Pending invitations expire at the earlier of seven days after sending or
  the scheduled start. Enforce deadlines using server time. Starting a night
  does not automatically accept a pending challenge.
- Acceptance is separate from RSVP and attendance. Never set Going or present
  on behalf of either player. Terms are frozen after acceptance.

### Lifecycle and scheduling changes

**Pending → Accepted → In progress → Completed.**

The invitee may decline; the sender may withdraw while pending. Expiry is a
server-enforced outcome. Either participant may cancel an accepted challenge
before its first game; retain the cancellation reason and history. After
play begins, either player may propose abandonment; the other confirms it,
with an audited organizer resolution available for a dispute. An abandoned
series has no fabricated winner. Use existing server-owned organizer authority.

Date/time/venue changes to the linked night mark a pending or accepted
challenge as **Needs reconfirmation** against the new event revision. Require
both players to reconfirm before starting. A cancelled night makes an unstarted
challenge cancelled. Rescheduling creates a reviewed replacement rather than
silently moving an agreed series. If play has begun, preserve results and
surface the schedule issue; continuation/abandonment needs an explicit audited
resolution. An incomplete series is never completed merely because time passed.

### Counting games, corrections, and recovery

Start entry from the challenge to prefill the accepted players, rules, board,
and night into the existing League Night recorder. The recorder makes it clear
which challenge the next game belongs to. Do not automatically consume every
future game between those players or silently attach older results.

Extend the existing atomic match-save contract so a successful operation saves
the game, validates/links it to one challenge, and returns the authoritative
series score and revision together. Enforce pair, night, preset, board,
competitive status, and race target on the server. A match may count toward
only one challenge; lock the series when concurrent devices submit the final
game. Reject a new challenge game after completion without losing its draft.

Support an explicit repair action for a game saved outside the challenge:
show the eligible same-night game, require participant confirmation, enforce
one-series membership and play after acceptance, and record the link/unlink
audit. Ordinary challenge linking requires one of its participants; other
members may still record ordinary league games for a participant to link.
Do not change who may edit the underlying match; preserve the existing
creator-only rule.

Corrections, deletions, and link changes recompute the series in recorded order.
If a correction removes the winning result, withdraw the winner presentation
and show the corrected/incomplete state. If changed chronology makes later
linked games fall after the race was won, flag them for review and exclude
them from the series while preserving the ordinary league results. Keep an
audit trail, revision, and clear correction label on the archived chapter.

Reuse durable operation IDs, same-payload retries, expected revisions, and
uncertain-save recovery. Never create a replacement operation before checking
whether the original game/challenge action committed. Refresh in other tabs
using the established supported update mechanism; include a polling/focus
refresh fallback and an explicit stale state. “Updating” means saved results,
not live dart telemetry.

## Sharing and the permanent chapter

Reuse the existing share-card approach for a pre-match poster and final result.
Preview exactly which names, avatars, game, date, and scores will be included;
export only after the user chooses to. Do not include RSVP rosters, private
practice, or unrelated profile details.

**Share to Board** opens a reviewed draft and uses the current Board access,
moderation, and save-recovery rules. Accepted challenges do not auto-publish.
The current Board supports text, so launch sharing can be a reviewed message
with an authenticated challenge link; downloadable poster images are separate.
If an embedded poster is desired, scope and review a typed challenge-card
attachment rather than assuming general image uploads already exist.

Completed challenges remain browsable in the rivalry timeline. Canonical
results always reflect authorized corrections; an exported image is a dated
snapshot. Use current chosen names/avatars on member pages; do not create an
unnecessary permanent archive of old personal identity choices. Generic avatar
assets may be public, but personalized matchup pages, metadata, and generated
previews must honor league access. No public social-card endpoint may leak
member results as a side effect of link sharing.

## Source integration and storage proposal

| Existing source | Integration intent |
| --- | --- |
| `app/profile/page.tsx`, `app/profiles/[id]/page.tsx`, `app/profiles/page.tsx` | Add selection and display while preserving existing profile fields/name preferences. Audit the current whole-profile upsert before adding avatar-only saving. |
| `app/page.tsx`, `app/components/Navbar.tsx` | Personal discovery entry and navigation; retain existing leaderboards. |
| `lib/games/catalog.ts`, `lib/stats/engine.ts`, `lib/stats/types.ts` | Reuse rules/cohort/eligibility definitions and rating semantics; add a focused pair-history calculation module. |
| `lib/league-night/api.ts`, `match-write.ts`, `recovery.ts`, `types.ts` | Extend the actual match transaction and recovery contracts; avoid a second result-entry system. |
| `lib/planning.ts`, `components/planning/` | Read scheduled nights and revisions; keep scheduling/RSVP authority intact. |
| `lib/league-night/share-card.ts`, `components/league-night/NightRecapPanel.tsx` | Reuse export techniques and honest saved-result language. |
| `lib/board.ts`, `components/board/` | Avatar rendering and explicit reviewed challenge-link sharing under Board permissions. |

Proposed persistence, to finalize during the source-design package:

- A nullable profile avatar ID and avatar-specific revision, constrained to an
  approved catalog. Retired IDs remain displayable; only available IDs may be
  newly selected. Avoid coupling selection to admission or privileged claims.
- Challenges with two distinct member IDs, immutable accepted terms, night ID
  and accepted event revision, lifecycle/revision, timestamps/deadline, and
  actor-attributed cancellation/reconfirmation information.
- Unique match-to-challenge links, audited link/correction events, and durable
  operation receipts. Derived series results are computed from canonical match
  rows, not an independently editable second scoreboard.
- Pairwise rivalry history derived from existing matches. Any cached summary
  must invalidate on match corrections, deletion, chronology/rule changes, or
  access changes and retain inspectable source IDs.

Enforce `league_members` admission for new reads/writes and retain the separate
Board permission boundary. Only the invited player accepts; participants own
ordinary challenge actions. Reuse verified server-owned organizer authority
for any exceptional action. Reject forged actors, arbitrary avatar IDs, and
unauthorized direct writes. Clear private client state after logout/revocation.

Use an isolated local Supabase project/workdir/ports for implementation and
synthetic demos; a Git worktree alone does not isolate a database. Keep proposed
SQL in `supabase/tests/fixtures/` or the established deferred-SQL location,
outside `supabase/migrations/`, until the existing
[Supabase release gate](supabase-github-integration-release-gate.md) is met.

## Delivery sequence

| Package | Deliverable | Completion evidence |
| --- | --- | --- |
| R0 — Product and visual prototype | Six-avatar art pilot and interactive synthetic mockup of the lobby, pair page, challenge flow, profile picker, completed result, and TV view. | Owner review of the actual mobile/desktop composition, avatar style, and challenge terms before application implementation. |
| R1 — Player identity | Approved roster expanded toward 24, manifest/optimized variants, shared renderer, owner-only avatar saving, and profile integration. | Picker works across devices, saves survive reload, concurrent failures recover, and initials/retired/missing-image fallbacks work. |
| R2 — Rivalry discovery | Member-only page, opponent selection, exact pair history, evidence-backed stories, profile/home entry points. | Synthetic calculations match the displayed story; real zero/thin/unknown-data states remain engaging. |
| R3 — Accepted showdowns | Invitations, lifecycle, schedule reconfirmation, atomic game linking, correction handling, and recovery. | Full local lifecycle, policy/concurrency tests, and a two-device browser rehearsal. |
| R4 — Presentation and release | Finished transitions, fullscreen view, explicit sharing, archived chapters, final responsive/accessibility/performance pass. | Owner visual acceptance, relevant full application checks, and separately documented hosted/release evidence. |

Packages make the work reviewable; a launched Rivalry Room should include the
complete discover/challenge/play/remember loop. Refresh the current release
state before choosing a feature branch/base. Keep commits scoped and inspect
all outgoing commits before any later push. Do not silently add this work to
an active release rehearsal.

## Acceptance: prove the delight and the fundamentals

The prototype must demonstrate the following with clearly labeled fictional
players/results; mockup content must never become production seed history.

- **First impression:** within five seconds, a reviewer can name the players,
  see why the matchup matters, and identify the next action. The main screen
  has a distinctive finished composition even with motion disabled.
- **Identity:** six pilot avatars remain recognizable at list size and look
  consistent side by side. Saving a new avatar changes the profile and matchup
  card without overwriting unrelated edits.
- **Return visit:** a submitted result changes the score, and a completed
  series becomes a meaningful chapter. No duplicate challenge rating reward.
- **Small league:** cover no opponents, one recorded game, few eligible games,
  no scheduled night, no incoming challenges, and a quiet week without invented
  counts, fake activity, or an overwhelming wall of empty panels.
- **Interaction:** review 320/390/768/1440 px widths and a 1920 px TV view;
  light/dark, keyboard-only, reduced motion, touch, long names, identical avatars,
  zoom/reflow, screen-reader score updates, and real image-loading failures.
- **Speed:** set explicit image dimensions; load only the visible portraits
  eagerly and lazy-load the roster. Target no more than 300 KB combined for
  the initial mobile hero portrait assets; tune using measured visual quality.
  Verify no image-driven layout shift or animation-delayed interaction in a
  production build under representative mobile network/CPU throttling.
- **Correctness:** test thresholds, chronology ties, partial-history failures,
  invalid/unknown cohorts, privacy, admission loss, forged actions, simultaneous
  acceptance/cancellation/final-game saves, expiry, schedule changes, duplicate
  submissions, ambiguous responses, relinking, and corrected winners.

During implementation, run the relevant checks required by `AGENTS.md`; a
complete application change includes `npm run ci:install`, `npm test`,
`npm run test:coverage`, `npm run lint`, `npm run typecheck`, and `npm run build`,
plus the affected database/policy and browser scenarios. Local evidence does
not establish hosted readiness. This planning-only change needs document/link
and scope review, not an application build.

## Decisions to settle with the prototype

Recommended starting point: **The Rivalry Room**, 24 curated cartoon mascots,
a six-character pilot, singles best-of-3/5/7 challenges attached to scheduled
nights, and a polished navy/orange broadcast composition. Review the art pilot
and working mockup to settle roster style, portrait intensity, headline tone,
and the exact mobile layout.

Later possibilities include personal uploads, doubles rivalries, unscheduled
challenges, title belts, league predictions, season competitions, opt-in
notifications, and additional game types. They are outside the initial build.
The first R0 art-and-interaction prototype is ready for design review. It
demonstrates the visual direction, avatar selection, opponent switching,
challenge/acceptance, sample series results, and TV presentation. It does not
implement persistence, real member access, real invitations, exports, or the
complete edge-state coverage in this plan. Owner acceptance remains open.

## Implementation handoff

The owner requested implementation after the interactive mockup. R1–R3 and
the local presentation work are implemented on `rivalry-room`, based on
`release/next` at `16e58f9`. See the
[dated handoff and verification](rivalry-room-handoff-2026-09-28.md).
Final owner visual/play acceptance and all hosted/release gates remain open.
The design proposal above is preserved for its rationale and acceptance scope.
