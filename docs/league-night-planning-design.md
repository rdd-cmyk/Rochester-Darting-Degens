# League Night — Plan & RSVP

Status: implemented and locally verified after the owner's "Build it" approval.
See [the implementation handoff](league-night-planning-handoff.md) for current evidence and local preview instructions.
Prepared: 2026-09-27.

## Workspace and scope

- Branch: `league-night-planning`.
- Worktree: `F:\RDD\Rochester-Darting-Degens-league-night-planning`.
- Base commit: `690a01b84d96c55b8ec455a6e298c17ec6093b50`.
- The existing League Night implementation was uncommitted on
  `league-night-mode`. Its 37 changed/untracked source files were copied into
  this worktree without altering the original checkout, index, or branch.
  `league-night-planning-source.json` records the source hashes. Those inherited
  files remain uncommitted here too; the branch commit alone does not contain them.
- The planning checkpoint added a proposal and synthetic mockup. The subsequent
  approved build adds the application, local-only SQL fixture, tests and local
  tooling. No dependencies, hosted writes or deployment were added.
- Existing League Night hosted rollout gates still apply. The Board branch is
  a separate feature; do not silently depend on or copy its membership tables.

## Confirmed request

Profiles can vote on when the next league night happens, where it happens, or
both, and contribute up to two suggestions each. Polls support manual closure
and automatic closure at a specified point. Multiple future nights can be set
up in advance, with **Going** and **Not going** responses. There is no Maybe.
Plan and review a mockup before building the feature.

## Recommended experience

Add **Plan & RSVP** as a section of League Night with a dedicated route,
`/league-night/plan`. Keep a compact next-night card and link on the existing
`/league-night` lobby. This gives planning a shareable destination without
crowding match entry or adding another top-level navigation item.

The planning page starts with the next confirmed night and its two RSVP
buttons. Follow it with open planning polls and the remaining upcoming nights.
If there are no confirmed nights, lead with the poll; if neither exists,
show an honest empty state and the organizer's creation action. Never show
placeholder vote counts or invented activity in the product.

Retain the existing navy, orange, cream, typography, and 44px controls. On
phones, date and venue ballots stack. Deadlines, saved state, and the suggestion
allowance stay next to their actions. Separate the organizer controls from
the normal member flow.

## Accepted implementation defaults

1. **Select all that work.** One profile can support multiple date/time options
   and multiple venues; at most one vote per profile per option. A saved ballot
   replaces that profile's previous selections. Members can change or clear
   their selections until closure. Counts measure support, not exclusive shares.
2. **Two suggestions total per profile per poll**, shared across date and venue
   when both are open. Initial organizer seed options are setup, not personal
   suggestion contributions. Creating seed options after publication must not
   provide a back door around the cap.
3. **Organizers manage planning.** Signed-in profiles participate; organizers
   create/publish/close polls and schedule/edit/cancel future nights. This is
   a new planning permission, not a change to the established right of every
   signed-in user to start an ad hoc night and enter matches.

The owner's "Build it" follows the mockup and these stated defaults. The build
uses a server-owned planning-organizer grant; editable profile metadata cannot
grant the role. Participation requires a signed-in profile. This feature does
not change signup policy or import the separate Board membership implementation.
Real organizer assignments belong to the separately approved hosted rollout;
only synthetic organizer accounts were assigned on the isolated local stack.

## Poll lifecycle and behavior

**Draft → Open → Closed → Scheduled**, with **Cancelled** available to organizers.
Only draft polls can freely change their question, categories, and initial options.

- A poll asks for Date & time, Venue, or Both. A date-only poll can carry a fixed
  venue; a venue-only poll can carry a fixed date/time. Missing fixed details
  must be supplied when scheduling.
- Date suggestions contain a date and start time in `America/New_York`. Venue
  suggestions contain a name and optional short location detail; all examples
  in the mockup are fictional. Suggestion and vote are separate actions.
- Count the two-suggestion allowance atomically across categories, tabs, and
  devices. Reject normalized duplicates without consuming a slot. Withdrawal
  retains the consumed slot to prevent delete/re-add cycling. Allow removal
  before any other profile votes; after votes exist, retain an audit entry and
  use a visible withdrawal/moderation state rather than silently changing meaning.
- Label member suggestions with their author; show the remaining allowance.
  New options do not inherit votes. Poll results show support totals. Proposed
  default: individual ballots remain private to the voter; an organizer receives
  aggregate overlap counts for date/venue combinations, not an identity list.
- Publish with either a specified closing timestamp or **Manual close only**.
  Always show an exact deadline with Rochester timezone context. An organizer
  can close early; a confirmation explains that voting and suggestions stop.
- Automatic closure is enforced on the server: an open flag is insufficient
  once server time reaches `closes_at`. Reject late votes/suggestions even if
  a tab is stale or no scheduler has run. Serialize manual-close races with
  writes. A UI timer or background task may update presentation, never authority.
- Proposed v1: deadlines cannot be extended after publication, and closed polls
  cannot reopen. Duplicate into a new draft for a fresh decision. This prevents
  previously final results from quietly changing.
- Closing freezes the outcome; it does not create a night automatically.
  Organizer reviews results, resolves ties or zero votes, chooses final date
  and venue, and confirms scheduling. Explain an override of leading options.
- In a Both poll, the most popular date and most popular venue may be supported
  by different people. Show the number who selected both before finalizing;
  never imply either marginal count is likely attendance. Voting never RSVPs.
- Create a scheduled night and link the source poll atomically and idempotently,
  allowing only one resulting night per poll. A retry returns the existing night.

## Scheduled nights and RSVPs

- Organizers can schedule directly without a poll and create several nights
  ahead of time. V1 uses individual events; recurrence is deferred.
- Required setup: title, date, start time, venue, timezone. Optional notes and
  RSVP cutoff. For v1, RSVP cutoff defaults to start time and cannot be later.
- **Going** and **Not going** are the only stored response choices. No response
  means no answer yet; it is not Maybe and must not be counted as Not going.
- Each profile controls its own RSVP. Show totals and profile lists for the
  two responses to eligible signed-in viewers. Do not expose emails. An
  unanswered total needs a defined invited roster; omit it until one exists.
- A response can change until cutoff. Server confirmation sets the visible
  saved state; failed or uncertain requests preserve the prior confirmed state
  and offer reconciliation. Account changes cannot reuse another user's state.
- Date, time, or venue edits after responses require reconfirmation. Retain the
  old response against its event revision, mark **Please respond again**, and
  exclude stale answers from current totals. Title/note corrections need not
  invalidate RSVPs. Show the change in-page; no unsolicited email/push scope.
- Cancellation preserves the event and its history, displays **Cancelled**,
  and stops new responses. Past nights move out of Upcoming.
- Starting play opens the existing League Night experience with the same night
  identity, title, date, and venue. An RSVP must never set `present=true` or
  silently populate **Who's here?**. Actual attendance and match permissions
  retain their current semantics.

## Implementation shape

Extend the existing night identity rather than creating parallel match-night
records. Model planning metadata additively (a companion schedule record is a
candidate): start timestamp, timezone, status, RSVP cutoff, event revision, and
optional source poll. Keep existing ad hoc nights and historic matches valid.

Private records now store polls, typed options, per-profile votes and ballot
revisions, schedule metadata, revision-bound RSVPs, organizer grants and replay
operations. The suggestion allowance counts retained member-authored options.
All reads/writes use two authenticated, narrowly scoped RPCs. The SQL remains
in a local fixture outside the automatic deployment path.

Use authenticated, permission-checked transaction operations for publishing,
ballot replacement, suggestion submission, closing, scheduling, event editing,
and responding. Derive the caller from authentication. Enforce uniqueness,
limits, deadlines, ownership, role checks, event revisions, and replay behavior
in the database, with RLS/grants tests for both RPC and direct access. Do not
trust disabled buttons, client clocks, or a profile ID passed by the browser.

Retain the current focus/visibility/manual refresh conventions. Refresh server
state at deadline, show stale/offline and conflict states, and preserve pending
work on an uncertain save. Recheck source state before implementation: the
parent feature is uncommitted and may evolve independently after this snapshot.

## Delivery sequence

1. Owner approved the mockup direction and build; use the defaults above.
2. Build local schema contracts and permission/concurrency tests using a new,
   dedicated local stack identity and ports. A worktree alone does not isolate
   a Supabase stack; do not reuse/reset the parent stack.
3. Implement polling and the two-suggestion cap, then scheduling and RSVPs,
   then the handoff into existing night entry. Keep changes reviewable.
4. Run repository-required checks plus focused browser and database acceptance.
   Keep SQL outside `supabase/migrations/` until the established release gate
   is explicitly cleared. Hosted rollout and publication remain separate.

Acceptance covers signed-out/unauthorized operations; each poll type; editable
ballots; duplicate options; third-suggestion attempts across categories/devices;
manual and deadline closure including races; ties and zero votes; pair overlap;
idempotent scheduling; multiple upcoming nights; own-RSVP-only writes; cutoff and
event-edit races; rescheduling/reconfirmation; cancellation; actual-attendance
separation; legacy night/match preservation; offline/uncertain saves; and keyboard,
screen-reader, light/dark, 320/390/768/1440px and 200% zoom behavior.

## Mockup boundary

`docs/mockups/league-night-planning.html` is an inline design fragment with
synthetic names, venues, vote counts, and dates. It demonstrates ballots,
two suggestions, poll closure, scheduling, and yes/no RSVPs entirely in local
mock state. Design controls switch page placement, poll scope, and organizer
visibility. It is not evidence that application behavior or database policies
are implemented. Votes in it never affect the real league.

### Preview review — 2026-09-27

- Exercised the fragment in headless Microsoft Edge using bundled Playwright:
  switching Going/Not going; saving votes; adding two suggestions and blocking
  a third; manual closure; scheduling from a poll; zero-based RSVP totals for
  a newly scheduled night; direct scheduling; deadline-closed state; date-only
  scope; member view; and the embedded-section alternative.
- Checked document overflow at 320, 390, 768, and 1440 pixels. Reviewed rendered
  desktop, mobile, and dark screenshots. The primary interaction pass produced
  no JavaScript page errors. This is mockup QA, not full accessibility acceptance.
- All 37 inherited files still matched the captured source hashes after writing
  the proposal. No application build or database checks were run for this
  planning-only change. No commit, push, deployment, or hosted write was made.
- The preview wrapper is generated for local inspection. The editable inline
  source remains `docs/mockups/league-night-planning.html`.
