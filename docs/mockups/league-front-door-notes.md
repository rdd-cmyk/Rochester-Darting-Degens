# League front door concept — 2026-10-01

Design study only. Owner requested mockups after agreeing with the proposed
page roles; implementation and publication are not authorized by this study.
Open [the clickable concept](league-front-door.html).

## Proposed roles

- League Night replaces Home at the base URL and logo destination. There is
  one League Night navigation entry. Its lobby leads with tonight/next plan,
  then a small overall power snapshot, latest recap, Board preview and archive.
- Stats defaults to Power & Performance, with Records and Head to Head as
  separate linkable views in a future implementation. Records preserves all
  old Home leaderboard categories. Existing score-cohort rules remain.
- Matches becomes an archive first. Recording through League Night is primary;
  standalone recording begins with an explicit context choice. Existing
  corrections, permissions, uncertain-save reconciliation and recovery remain.

The HTML is self-contained apart from the existing local logo/avatar assets.
It reuses current semantic palette, heading size, shell padding, panel and
44px control roles. It proposes a content hierarchy, not another visual system.
Current Machine artwork remains installed; exploration alternatives are unused.
All people, dates, ratings, scores and posts in this study are fictional.
No network API calls, authentication, hosted data or storage writes occur.

## Interactions to review

1. Click the logo and League Night/Matches/Stats navigation.
2. Change League Night's Preview state, including no upcoming plan.
3. Open recap/start-night concepts and try the local sample RSVP.
4. Explore all three Stats views. General stats controls illustrate layout
   only; they do not calculate sample statistics.
5. Filter Matches by player/game/night, expand details, and open correction.
6. Try standalone recording: choose League Night or continue to the mock form.
7. Switch appearance and resize to phone width.

Night workspaces are retained rather than redesigned here. Stats lower detail
sections are represented by an explicit continuation note. Permission states,
loading/errors and full team-entry controls need implementation planning, not
claims of completion from this mockup. The future standalone-to-night linking
decision remains open.

W6 acceptance and W7/W8 stay at the saved release checkpoint. Before any
implementation, revise the older leaderboard-first Home/navigation contract
to record the newly accepted direction, refresh affected W6 journeys, and
identify route/auth/reset/recovery links affected by changing the root page.
No backup, SQL, deployment or release gate is closed by this study.

## Mockup verification

Checked in the local browser on October 1: all three page destinations,
all Stats views, League Night's three preview states, mobile navigation,
match filtering and the standalone choice/form. Mock submission confirms
nothing saved. Light/dark appearances and 390px layout were inspected; the
Stats table-width issue was corrected and all three Stats views rechecked
with no page-level horizontal overflow. The inline script parses successfully.
Saved screenshots are in [front-door-assets](front-door-assets/).

The production app and existing local provisional-rating changes were left
untouched. No application suite, CI or Vercel deployment was run for this
standalone documentation/mockup study.
