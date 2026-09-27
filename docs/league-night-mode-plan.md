# League Night Mode

Status: local implementation authorized by Ben ("Love it. Build it."); 4A–4C built
and locally verified. Ben reported local demo testing complete on 2026-09-27.
The [read-only hosted audit](league-night-hosted-audit-2026-09-27.md) is complete;
backup/restore, migration-history adoption, hosted changes and merge remain gated.
Ben authorized local commits and publication of `league-night-mode` on 2026-09-27;
that permission does not authorize main or database deployment.

Created: 2026-09-26

Branch: `league-night-mode`

Starting point: `origin/main` at `690a01b84d96c55b8ec455a6e298c17ec6093b50`,
the merge of [PR #69](https://github.com/rdd-cmyk/Rochester-Darting-Degens/pull/69).
Local `main` was fast-forwarded to that same commit before this branch was created.

## Local delivery checkpoint — 2026-09-26

- 4A: transactional create/edit RPC, revision conflicts, retained participant
  identities, user-bound retry IDs, cross-recorder duplicate review, and an
  explicit additive-app-enforcement rollout. The existing Matches form uses
  the same write contract; there is no split-write fallback.
- 4B: `/league-night`, shared attendance with revision checks, all-signed-in
  entry, Save & Rematch/Finish, per-user/night drafts, operation-specific
  recovery across tabs, and visible saved-result receipts. Poll on focus,
  visibility and every 20 seconds while visible, with manual refresh.
- 4C: shared recap, scope-separated rating contributions, all five award
  categories, eligibility explanations and exact canvas preview/download plus
  a text alternative. No automatic uploads or public recap endpoint.
- Design decisions: nightly date and recap times use Rochester/New York
  context; entry uses the existing local-time helpers. There is no close-night
  control or scorekeeper role. Unknown formats do not earn comparable-score
  awards. Incomplete evidence withholds affected claims.
- Ordinary/released unsent drafts expire after 24 hours. Submitted operations
  stay in device-local user-scoped recovery until checked; the server replay
  records are retained indefinitely. The UI discloses this distinction.
- [Verification and review instructions](league-night-verification-2026-09-26.md)
  record 221 source tests, 36 fresh-legacy database checks, seven production-build
  browser scenarios, independent review fixes, and remaining acceptance gates.

The detailed package descriptions below retain the design rationale. Local
implementation does not approve hosted SQL, production export, push or merge.

## The experience we are building

Make league night feel like a polished darts scoreboard, not an administrative
form. Set up once, record a result in a few deliberate taps, know it saved,
and finish with a recap people actually want to share.

The three deliveries are **safer match saving**, **Save & Rematch**, and
**a league-night recap**. Reliability is part of the experience: no ambiguous
success messages, discarded scores after a failed request, or invented stats.

Ben confirmed on 2026-09-26 that anyone should be able to enter matches, as they
do today. Preserve entry for every signed-in user: no designated scorekeeper,
host approval, or requirement that the recorder played in the match. The night,
attendee pool and confirmed results must be shared across devices in v1;
unsaved score drafts remain device-local. Creating entries does not grant
permission to edit someone else's saved match.

This implements Phase 4 of the [statistics roadmap](advanced-statistics-roadmap.md).
The existing League Lab visual language and metric definitions remain the
starting point. Rivalry pages are a possible follow-up, not part of this scope.

## Delivery order and approval boundaries

| Package | Outcome | Database impact | Exit gate |
| --- | --- | --- | --- |
| 4A — Save with confidence | One complete match save, safe retries, conflict handling | A small new database function and narrowly scoped supporting schema are expected | Fault-injection, RLS, preservation, deployment-order and owner-approval gates |
| 4B — Save & Rematch | Shared night and attendance, entry from multiple phones, fast rematches, device-local drafts | Minimal persistent night/attendance records and match-to-night association, using the 4A write contract | Multi-user permission/concurrency checks, phone-width entry and draft recovery acceptance |
| 4C — Night recap | Results from all contributors, earned night awards, rating movement, upsets, bests and a share card | Shared night association plus existing match history | Deterministic calculation, award eligibility, completeness, privacy and visual acceptance |

Keep packages in reviewable commits and prefer separate PRs at release boundaries.
Prototype 4B/4C with synthetic data while 4A awaits hosted approval, but do not
ship the new entry flow using the old multi-request save as a silent fallback.
Planning does not authorize pushing, merging, changing integration settings,
repairing hosted migration history, exporting production data, or deploying SQL.

## Design direction: a league-night scoreboard

- Retain Rochester navy, dartboard orange, cream and restrained silver; reuse
  existing typography and tokens. Use orange to focus the primary action, not
  to make every component compete for attention.
- Lead with the current night and a compact editable context strip: venue,
  board, game type and roster. Keep it out of the way once setup is complete.
- Offer clear **Open tonight's night** and **Start a night** actions, then a
  **Who's here?** attendee picker. Show confirmed results from everyone with
  recorder attribution and a refresh/stale indicator; do not imply unsaved
  scores on another phone have been saved or synchronized.
- Use player cards with prominent names, plainly labelled score fields and
  an obvious winner selector. Do not make users hunt through a winner dropdown.
- Put **Save & Rematch** in a thumb-friendly action area; offer **Save & Finish**
  as a clearly distinct alternative. Editing an existing match gets **Save changes**,
  not a button that accidentally starts another match.
- Show a persistent recent-result receipt with winner, participants, time and
  score units. Celebrate briefly only after server confirmation; do not rely
  on a disappearing toast or color alone to communicate success.
- Favor progressive disclosure: scores and winner first, optional notes and
  context changes second. Preserve the existing 3DA/PPD conversion and Cricket
  labels; never infer raw darts or checkout data from a match average.
- A recap should look like a small sports broadcast: one strong headline,
  a few evidence-backed highlights, then the full results. Avoid a wall of gauges.

### Visual and usability acceptance

- Review setup, active entry, saving, saved, error, draft recovery, edit conflict,
  empty night and completed recap states before calling the design finished.
- Test at 320, 390, 768 and 1440 CSS pixels, with long names, 2 and 10 players,
  portrait/landscape, light/dark themes and Summer overlay on/off.
- Aim for at least 44 by 44 CSS-pixel primary touch targets. No clipped labels,
  page-wide horizontal scrolling, sticky controls covering errors, or mobile
  keyboard obscuring the active field/action.
- Keyboard operation, visible focus, explicit field labels, inline errors,
  screen-reader save announcements, 200% zoom and reduced motion must work.
- A normal rematch requires no venue/roster re-entry: enter scores, choose the
  winner and save. Proposed usability target: a regular player can do that
  unaided in about 15 seconds once scores are known; validate with Ben rather
  than presenting it as an achieved performance claim.
- Use deliberate transitions and a restrained winner highlight, not constant
  animation. Review actual rendered screens and the deployed preview with Ben.

## Package 4A — Save with confidence

### Why this comes first

In the merged `app/matches/page.tsx`, create saves the match and its participants
in separate requests. Edit updates the match, deletes participants, and inserts
replacements separately. This predates PR #69. A later request failing can leave
an incomplete record. No production data-loss incident is asserted here.

### Proposed write contract

- Route both the existing match editor and League Night entry through one
  database operation that commits the complete match and participants together
  or leaves the previous state unchanged. A server route making the same
  separate database calls would not solve the transaction problem.
- Validate on the server as well as in the UI: authenticated caller, creator
  ownership for edits, 2–10 distinct valid players, exactly one winner in that
  roster, supported score units and bounds, timestamps, notes and venue limits.
  Every signed-in user may create an entry, including for other players;
  being the night's creator or an attendee is not an entry permission check.
  Preserve established validation semantics unless separately reviewed.
- Derive creator identity from the authenticated context, not a trusted-looking
  client field. Prefer security-invoker functions and existing RLS; review
  execute grants explicitly. Any need for security-definer privileges requires
  a separate security justification, constrained search path and policy tests.
  Never expose a service-role key in the browser or bypass ownership checks.
- Make each save carry a stable operation ID. A same-user retry with the same
  normalized payload returns the recorded outcome without inserting again;
  reusing an ID with different content is rejected. Persist the operation ID
  with the draft before submission. A deliberate rematch gets a new ID.
- User-scoped retry IDs do not identify the same physical game entered
  independently by two people. Check possible duplicates across contributors
  and offer review, without silently dropping legitimate rematches or claiming
  heuristic matching guarantees unique real-world games. See 4B's duplicate flow.
- When 4B adds night association, validate it server-side and save it in the
  same transaction as the result. A night is context, not ownership: saving
  into someone else's night must not transfer match-edit rights. Keep ordinary
  matches without a night valid; no mandatory backfill of historical matches.
- Include an edit version/expected revision and serialize conflicting edits.
  A stale editor must reload or reconcile instead of silently overwriting a
  later save. Design how this interacts with older open tabs and legacy direct
  writes; a new version column alone does not protect writes that never update it.
- Prefer updating retained participant rows to replacing them unnecessarily.
  Preserve unrelated fields and stable identities; remove only participants
  explicitly removed in the edit. Do not silently reinterpret legacy null
  game types as 501 or backfill historical results.
- Return a canonical match ID and revision. Distinguish failed writes from a
  successful commit followed by a failed list refresh. An interrupted response
  means **Checking save**, not automatic failure or permission to submit a new ID.
- Freeze or snapshot the submitted payload while saving. Handle retries,
  navigation and account changes without applying a late response to a new draft.

The operation record, uniqueness constraint and revision mechanism are a
design target, not finalized SQL. Define retention, replay-after-edit behavior
and old-client compatibility before implementation; retries must not resurrect
old results or overwrite a later edit.

### Tests that must pass

- Successful create/edit; invalid payloads; signed-out attempts and non-owner
  edits. Two signed-in users can independently create matches, including in
  the same night, but neither can edit the other's saved result.
- Inject failure after the match write and after a participant change: complete
  original rows, relationships and values remain unchanged; no orphan creates.
- Concurrent same-ID retries produce one match; different payload with that ID
  is rejected. Explicit rematches with new IDs still work.
- Simulated timeout after commit is reconciled without duplication. A refresh
  failure after successful save does not clear confirmation or invite a new write.
- Concurrent stale edits are rejected without overwriting newer values; replay
  of an already committed operation does not reapply its earlier payload.
- Preserve current creator-only match-edit rules and authenticated read behavior.
  Test functions and ordinary table access, not just hidden UI controls.
- Existing historical matches remain readable and valid. Test against the
  legacy baseline without requiring the deferred advanced-statistics fixture.

## Hosted database gate and rollout order

This branch starts with **no deployable migration SQL**. The historical baseline
and future advanced-statistics SQL remain local-only fixtures. Neither 4A nor
4B needs the seasons, advanced score columns or stats view from that deferred
work. Shared nights do require new persistent storage; they are not a
client-only shortcut around database review.

Before any 4A or 4B SQL enters the automatic deployment path:

1. Refresh runtime/audit checks from the dependency plan's Phase 4 entry gate.
   Inspect current hosted schema, RLS, grants, migration history and integration
   settings read-only. Do not assume the last inspection is still current.
2. Obtain approval for any production export; make a protected backup and prove
   a restore path in an isolated target. Keep credentials and real player data
   out of Git, ordinary logs and synthetic fixtures.
3. Reconcile the existing schema/history mismatch through an owner-reviewed
   plan. Do not replay the baseline over existing tables or run history repair
   simply to remove a warning. Preview branches also need a deliberate baseline.
4. Rehearse on a fresh legacy-only database and with preservation fixtures;
   test failure rollback, permissions, duplicate retries, shared-night access
   and concurrency. The current local bootstrap includes deferred stats fields,
   so its success alone
   cannot prove compatibility with today's production schema.
5. Review a minimal additive migration and the deployment dry run. Independently
   review the SQL and security contract. Update the empty-migrations assertion,
   `AGENTS.md` and release-gate docs only in that explicitly approved change;
   do not weaken those safeguards now to make a test pass.
6. Obtain owner approval of the exact SQL, target, backup and release sequence.
   With Supabase production deploy enabled, a merge containing migrations is a
   database deployment. Vercel and Supabase do not become ready atomically.
7. Deploy each package's backwards-compatible database operation and supporting
   schema first, verify them, then release the app using them. Choose a reviewed
   maintenance/old-client strategy before enforcing the new write path.
   If the operation is unavailable, retain
   the draft and explain the problem; do not fall back to unsafe split writes.
8. Verify authorized hosted behavior, existing match counts/relationships and
   representative values without destructive production tests. Record evidence.
   Plan an app-first rollback that leaves additive schema/data intact; restoring
   a stale backup over newly recorded matches is not a routine rollback.

See [the Supabase release gate](supabase-github-integration-release-gate.md) and
registry records RDD-INFO-003, RDD-INFO-011 and RDD-INFO-021. Local rehearsal is
not a claim that production data, backup restoration or hosted policies passed.

## Package 4B — Save & Rematch

### Night setup and match entry

- Proposed route: `/league-night`, linked from Matches and the main navigation.
  Keep existing match browsing/editing available; share validation and save
  logic rather than maintaining a second, different write implementation.
- Let any signed-in user open an existing night or start one. Make current
  nights discoverable by date/venue, with a stable authenticated link that opens
  the same night on another phone. Surface an existing similar night before
  creating another, without assuming one venue/date can only have one session.
- Start with venue and **Who's here?** attendance; board and format provide
  defaults for match entry. Recent-player chips and searchable names should
  make familiar groups quick to assemble. Use existing accounts and profiles;
  do not require a new role, season, or advanced scoring detail.
- Keep a pool of attendees separate from the 2–10 players in the current match.
  Offer attendees first in player selection, with **Add someone** for late
  arrivals or a missing name. Attendance is not a permission gate or proof that
  someone played. Marking someone as left must not alter saved matches.
- Persist the night, attendee pool and confirmed match associations on the
  server. Everyone signed in can record results in the same night; nobody
  needs the original creator's device or a designated scorekeeper's approval.
- Proposed roster behavior: any signed-in user can add attendees or mark them
  present/left. Review this new table's policies explicitly; use per-attendee
  updates and conflict handling rather than replacing a whole stale roster.
  Do not extend this collaboration permission to existing match editing.
- Keep each recorder's selected players, scores and match-specific board/format
  independent. Shared updates must not overwrite a form in progress or change
  a score's meaning. Multiple boards and concurrent matches must work.
- Refresh shared attendance and confirmed results on entry, return to the tab,
  and after saves, with a visible manual refresh/staleness state. Choose polling
  versus subscriptions during implementation; do not promise live delivery
  without reconnect and permission tests. Other devices need not reload the
  entire site to see confirmed results.
- Save & Rematch retains setup and current players, clears scores, optional
  match-specific notes and winner, refreshes the next match timestamp, and
  focuses the first score field only after confirmed success.
- Editing a historical match preserves its actual time; live rematch entry
  cannot reuse yesterday's timestamp accidentally. Handle midnight and DST
  explicitly using the existing date-validation helpers.
- Show recent confirmed results with a clear Edit action. Do not add destructive
  one-tap Undo/Delete or bulk changes as part of this feature. Show Edit only
  for the match's creator and enforce that rule on the server. **Save & Finish**
  ends the recorder's entry flow, not everyone else's ability to enter matches.

### Drafts, errors and duplication

- Store versioned, expiring, device-local drafts scoped to the signed-in user
  and environment. Unsent drafts expire after 24 hours; submitted operations
  with unknown outcomes retain their exact payload and retry ID until checked.
  This implementation refinement prevents expiry from turning a lost response
  into a duplicate write. Store concurrent operations separately. Offer Restore or
  Discard with the saved time; do not silently replace a newly started form.
- Persist only needed match/setup data, never tokens or privileged keys. Clear
  sensitive active state on sign-out/account change. Handle storage being full,
  unavailable or cleared, schema changes and two tabs editing the same draft.
- Unsaved score drafts are not shared across devices and do not appear as
  confirmed results. The night and attendee pool are shared; distinguish those
  from **Draft on this device**. No offline submission/background queue in v1.
- Keep all entered values on failed saves and show an actionable retry state.
  On reload after an uncertain submission, reconcile its operation ID before
  allowing another write.
- Separate retry deduplication from a friendly possible-duplicate warning that
  checks results from all recorders, not just the current user. Show the prior
  result, recorder and time; offer **View saved match** or an explicit
  **This is another game** confirmation. Never automatically merge by matching
  roster/scores, change another user's result, or discard the current draft.
- Recheck likely duplicates at submission and test near-simultaneous entries,
  not only stale client lists. Finalize server-side race handling and the
  intentional-rematch override contract before implementation. Different users'
  operation IDs alone cannot prevent double-recording the same physical game;
  retain honest possible-duplicate language rather than promising certainty.

Acceptance: component and browser tests with two authenticated users on separate
browser sessions for discovering the same night, shared attendance, late arrivals,
concurrent distinct matches, duplicate warnings, creator-only edits and refreshed
results. Also test rematch, roster conflicts without lost local scores, failed
save, lost response, reload recovery, reconnect, sign-out, two tabs and an auth
session expiring mid-entry. Signed-out access remains denied. Existing Matches
and Stats must still work, including historical matches with no night.

## Package 4C — League-night recap

### Define the night before calculating its highlights

For v1, a night has a persistent server-side identity and an explicit set of
associated confirmed matches from all contributors. Its recap survives closing
the browser and is the same on another device. It does not end automatically
at midnight. Attendee changes do not rewrite who played in saved matches.

Show the shared night scope by default. If offering a filtered share-card view,
label that scope and do not silently change the shared night membership. Any
later flow to attach/detach an existing match must respect its creator's rights,
show confirmation and preserve the match itself. Do not silently claim every
match at a venue or on a date belongs to a night, or auto-assign old records.

Default display timezone proposal: `America/New_York`, shown with the night
date/range. The recap must state its confirmed-match count, scope and refresh
state. A recap is available while entry continues; opening or exporting it does
not close the night for other users. A global close/reopen control and its
permissions require an explicit design decision, not an implicit host-only role.

### Highlights and truthful calculations

- Results: chronological match list, wins and games per player, with format
  and board labels. Only server-confirmed results count; unsaved drafts do not.
- Rating mover: reuse the existing chronological rating engine and required
  prior history. Sum the selected matches' rating updates for each player;
  do not reset ratings to 1500 at the start of the night or include updates
  from unselected matches in the displayed night contribution.
- Biggest upset: lowest pre-match winner probability among the selected valid
  matches, calculated from the same history and discipline scope as ratings.
- Personal best: compare a selected scored result with earlier compatible
  recorded scores for that player, format and board. Label it **best recorded**,
  distinguish ties and first recorded scores, and do not compare missing/Other
  disciplines or incompatible score units. No claim about unrecorded play.
- Show ties, provisional samples and missing data honestly. A zero-match night
  gets useful next steps; a one-match night does not need four forced headlines.
- Fetch/paginate all required authorized history. If a page fails or historical
  coverage is incomplete, show a clear limitation and withhold unsupported
  highlights rather than publish a plausible-looking result. Edits must refresh
  the recap instead of leaving a stale victory card.

### Night awards — a little earned bragging material

Ben requested reward-style recap highlights on 2026-09-26. Include a small
**Tonight's awards** section in 4C: collectible-looking badges that celebrate
actual results and personal milestones. Give improving players something to
celebrate alongside the night's strongest players. These are automatically
derived recap highlights in v1; they require no extra entry fields or manual
nominations.

Proposed first set (names and eligibility thresholds are design defaults to
validate during implementation):

| Award | What earns it | Evidence and limits |
| --- | --- | --- |
| Giant Slayer | The night's biggest qualifying upset in a labelled game/board/player-count group | Reuse pre-match win probability; require probability below the equal-chance baseline of `1 / player count` and at least ten prior matches in that discipline for every participant. Compare like-sized matches; no award from provisional ratings alone. |
| Power Surge | Largest positive night rating gain among eligible players in a game/board scope | Use the existing night-contribution calculation, at least three night matches and ten matches before the night in that scope. Show the gain and games played; ties share the award. |
| Personal Best | A player's score exceeds their previous best compatible recorded score | Use the existing best-recorded calculation and show old/new values with units. Require at least one earlier valid score; a first recorded score or tied best gets its own honest label. Multiple players can earn this. |
| Hat Trick | Three or more consecutive wins in a player's appearances that night within a game/board scope | Count confirmed results in played order, including losses between wins. Show the longest qualifying run once per player. Do not infer legs or an ordering that ambiguous timestamps cannot establish. |
| First of Many | A player's first recorded win falls in this night | Check all available authorized prior match history, across formats, and label it **First recorded win**. Never imply it was their first win outside the site. Multiple players can earn this. |

Keep the cards tangible and legible: a small medal/ribbon icon, award name,
player name, and one concrete reason such as **Three straight 501 wins** or
**New recorded best: 62.4 3DA, previously 59.8**. Offer a **Why this award?**
detail with qualifying matches, scope, sample size and the rule. Use the site's
navy/orange/cream palette, readable long names and restrained celebration that
respects reduced motion. No extra tap is required to claim an award.

- Lead with up to three distinct highlights and an **All awards** disclosure
  when more qualify. Keep all recipients visible there; do not change winners
  or hide ties to manufacture variety. Let the share-card preview choose which
  earned awards to feature.
- Label awards **So far tonight** while results can still arrive. Recompute
  after new entries, edits and night-association changes. These badges are a
  current recap view, not permanent grants; reopening the recap must not fire
  the same celebration repeatedly.
- Omit an award when nobody qualifies or its required history is incomplete.
  Show useful personal milestones when supported, without forcing a winner
  for every category. Keep humor celebratory; no automatic worst-player or
  losing-streak awards.
- Existing results support these awards. Checkout, comeback, 180-count and
  clutch awards wait for the actual scoring detail needed to prove them.
  A permanent profile trophy cabinet, achievement points and season-wide
  reward economy are possible later work, not requirements for this recap.

Award acceptance: verify exact eligibility boundaries, shared winners,
multiple personal milestones, first-score versus improvement versus tied best,
provisional ratings, different multiplayer counts, mixed formats/boards,
intervening losses, ambiguous match order, incomplete history, and award
changes after corrected results. Repeated rendering and retries must not
duplicate cards or repeatedly trigger celebrations.

### Sharing and finish

Build an attractive in-app recap plus a user-initiated downloadable image and
copyable text summary. Preview the exact card before sharing; show date, scope,
format, sample sizes and a concise methodology note. Start with text/CSS and
deterministic rendering, not a new chart library or AI-generated statistic art.

No automatic posting, public player-data endpoint, public recap link, or upload
of participant information. Omit personal contact details, free-text notes and
private venue details by default; let the user inspect what leaves the site.
Use display names, preserve readable long names, and provide a useful textual
alternative. Export failure must not lose the recap or the saved match.

Acceptance: shared results from multiple recorders, reload/on-another-device
recaps, seeded nights with known rating changes, all-time versus night-only
history, interleaved unselected matches, ties, unknown disciplines, edited data,
midnight/DST and incomplete pagination. Review exported cards, not only DOM
snapshots; verify export at mobile and desktop sizes.

## Verification and handoff

- Before implementation, rerun the documented baseline/runtime/audit checks in
  this new worktree. No dependency upgrade or dependency install is part of
  this planning-only change.
- Use existing Vitest/Testing Library, pgTAP and Playwright workflows. Add
  regression tests alongside the code and repeat required install, test,
  coverage, lint, typecheck and build gates before implementation commits.
- Inspect Docker/Supabase targets before running local DB tools. The checked-in
  local project ID and ports are shared across worktrees; a new Git worktree is
  not automatically an isolated database. Never reset another worktree's stack.
- Independently review 4A/4B's database/security behavior and the complete branch.
  GitHub checks, Vercel preview, mobile visual acceptance and Ben's real-use
  feedback are distinct gates; do not substitute one for another.
- Keep a short dated verification record per package, with actual commands,
  commit, target, results and limitations. Update the roadmap and information
  registry only for verified facts or explicitly approved constraints.
- Before each release, review the full diff against fresh `origin/main`, the
  migration inventory and automatic-deploy settings. Request authorization
  before publishing or deploying; write public-facing PR notes for Change Log.

## Not included; decisions to confirm during design

Not included: seasons, raw turn/leg tracking, checkout analytics, OCR/CSV imports,
automatic social posting, shared per-dart live scoring or collaborative unsaved
score editing, public leaderboards, changes to existing match-edit permissions,
or the deferred advanced-statistics schema as a bundled dependency.
Shared nights, attendance and confirmed result entry by multiple users are in v1.

Confirm before implementation locks them in: night discovery/setup UX and timezone,
new night/attendance metadata permissions and whether a close/reopen control is
needed at all, concurrent duplicate-warning/override behavior, award names and
eligibility thresholds,
24-hour unsent-draft retention and reconciliation-only submitted recovery on shared devices, old-client save-transition strategy,
idempotency retention, and exactly which details belong on a share card.
These are review checkpoints, not blockers to writing this plan.

## Primary technical references

Reviewed 2026-09-26; recheck before implementation/deployment:

- [PostgreSQL 17 transactions](https://www.postgresql.org/docs/17/tutorial-transactions.html):
  grouped writes commit or roll back together.
- [Supabase database functions](https://supabase.com/docs/guides/database/functions):
  callable database operations and invoker/definer security considerations.
- [Supabase GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration):
  merges to the configured production branch can deploy migrations; previews
  are built from migration files rather than cloning production schema/data.
