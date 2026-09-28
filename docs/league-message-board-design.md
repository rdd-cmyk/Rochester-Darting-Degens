# League Board design proposal

Status: implemented locally on the session branch; hosted rollout pending.
Date: 2026-09-26
Branch: `league-message-board`

## Purpose and agreed access

Give players a useful place to talk between league nights: find a sub, arrange
practice, share highlights, and follow organizer announcements. The user has
chosen members-only access: sign in to read and post. This includes replies,
previews on the homepage, direct post links, and any future notifications.

The user selected organizer approval. Signed-in players request board access;
organizers approve or revoke it. Account signup and editable profile metadata
cannot grant membership or organizer privileges. Access is enforced in the
database as well as the page.

## Proposed page

- Navigation label: **League Board**. Proposed route: `/board`.
- Reuse the existing navy, orange, cream, light/dark, and profile-name conventions.
- One readable column on desktop and mobile; no empty sidebar or channel grid.
- Short heading and a clear members-only label.
- At most one expanded pinned organizer message above the composer. Additional
  pinned items, if needed later, should not push conversations down the page.
- A compact composer with optional starters: **Find a sub**, **Who's throwing?**,
  and **Share a highlight**. Starters populate editable text; they do not publish.
- One feed, ordered by the latest post or reply. Reactions do not bump a thread.
- Each post shows the author's chosen display name, date, text, reactions, and
  reply action. No required title for ordinary posts.
- Flat replies, oldest first, in an expandable thread with a shareable direct
  link. Posting returns the person to their new contribution.
- Preserve drafts during recoverable failures and sign-in interruptions; show
  success only after the server confirms persistence.

## Low-activity design

Do not split a small audience across categories or rooms. Keep prompts near the
composer, but let ordinary free-text posts work with one tap. Add filtering only
when actual volume warrants it.

| State | Proposed experience |
| --- | --- |
| No posts yet | Composer plus a concrete invitation: “Who's throwing this week? Start with a time and place.” An organizer welcome appears only if actually published. |
| A quiet week | Show the genuine existing conversation and its date. Keep useful starter actions visible without repeating empty-state messaging. |
| Active night | Same layout with more posts and reply previews; paginate when needed. |
| Signed out | Brief members-only introduction and sign-in action; no post bodies, authors, or activity previews. |
| Loading or error | Dedicated loading or retry state; never mislabel a failed request as an empty board. |

Avoid online counters, zero-post category badges, “trending” labels at low volume,
fabricated activity, and a separate post for every recorded match. Sample content
in design previews is fictional and must not become production seed content.

## Discovery and launch

For members, add a compact **From the League Board** section on the homepage with
up to two recent conversations and direct reply links. If the board is empty,
show a useful invitation to arrange practice rather than an empty preview box.
Respect membership access before fetching or rendering previews.

At launch, ask the organizer to publish a short welcome and one timely question.
Invite a few willing players to contribute real posts or replies. These are
proposed human launch activities, not authorization for automated outreach.

A weekly league-night discussion is an optional organizer habit, not a scheduled
stream of unanswered system posts. If used, keep replies in that one thread.
Later, consider opt-in reply notifications once the board demonstrates use.

Judge early usefulness by real back-and-forth, requests finding a response, and
players returning across league nights. If only the organizer posts, first
revisit the prompts and how members discover the board before adding features.

## Initial scope and open decisions

Implemented first release: posts, flat replies, one simple reaction, author editing
and deletion, organizer pin/hide/lock controls, and a member reporting action.
Include rate limits, safe text rendering, accessible controls, pagination, and
clear loading/error/permission states in the implementation plan.

Deferred: private messages, attachments, polls, channels, reputation scores, and
push/email notifications. Posts and replies are limited to 2,000 characters;
reports to 500. Deleting a post removes its conversation from member access and
replaces its body and reply bodies with deletion markers. Hiding is reversible.
The first organizer must be provisioned by the database owner; the app cannot
self-promote an account. See `league-message-board-handoff.md` for setup and evidence.

The earlier design prototype remains illustrative. The application now uses
real local Supabase persistence and membership policies. Hosted changes remain
subject to the repository's database release gate; local acceptance does not
authorize deployment.
