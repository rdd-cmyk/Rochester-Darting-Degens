# Five additions for the upcoming release

Branch: `feat/rivalry-power-rating`. Owner authorized all five on 2026-10-04.
Implementation starts after this short combined plan. “Opponent sitting” is
interpreted as the previously suggested opponent sorting.

| Feature | Placement and behavior | Boundaries and verification |
| --- | --- | --- |
| Invitation search | An email-or-sender search field, Search and Clear actions. Match case-insensitive literal text across the complete authorized history before status filtering and pagination. Return to page 1 when the query changes. | Organizers search all invitations; ordinary members search only their own. Sender matching uses the same disclosed name shown in the UI. Hidden first names must not be searchable. No new resend/revoke permissions. Test scope, pagination, literal wildcard characters, name privacy, and stale requests. |
| Run it back | A button on a completed challenge for either participant. Open the existing challenge form with the same opponent, game, rules, board and series length. Require selection of a different upcoming night. | Create a fresh pending challenge with a new ID and normal recipient acceptance. Never reopen or mutate the completed series. Preserve existing limits and durable mutation recovery. No button for spectators or incomplete challenges. |
| Add to calendar | A secondary action alongside the next-night planning/RSVP action, in both next-night card variants. Download an iCalendar file with the actual scheduled start, title, venue, notes and a link back to the plan. | Use the real timestamp in UTC, not the browser timezone. No invented end time or duration. Escape and fold RFC 5545 text safely; stable event identity and revision. Export no attendee list or account details. Explain that downloaded entries do not update automatically. |
| Opponent sorting | A native Sort opponents control beside Find a player. Retain Recommended as the default; add Closest Power Rating, Most played and Never played. Apply it to both cards and the chooser. | Closest uses the existing rating difference; Most played uses eligible competitive singles; Never played filters to players with no such history. Keep provisional labels. Changing sort must not silently change the selected rival. Show a useful empty state. Rating math and K=32 remain unchanged. |
| Challenges waiting | A compact home/League Night lobby panel with the count of pending incoming challenges and a Review challenges link. Link directly to the challenge when there is only one. | Signed-in account scope only; no outgoing/completed challenges. Refresh while visible and on focus, clear state on account changes, and distinguish errors from no pending challenges. Reuse existing authorized rivalry reads; no push or email notifications. |

Implement search first, then the two Rivalry Room improvements, calendar
export, and the home panel. Reuse existing components/tokens and keep the mobile
profile avatar in place. Add focused tests for the new behavioral boundaries,
then run the repository's installation, full tests, coverage, lint, typecheck,
build, and synthetic desktop/mobile browser checks in both themes.

Any additive invitation-search SQL stays in `supabase/tests/fixtures/`, after
the organizer tools fixture, with local permission rehearsal. Hosted database
activation remains subject to the separate schema/RLS/backup/rollback release
gate. Publishing this branch updates the app Preview; it does not apply SQL.

## Implementation and verification

All five are implemented. Rating calculations retain K=32. Rematches preserve
the original terms but create a new normal challenge; the completed series is
unchanged. Calendar entries are downloads, without automatic synchronization.

- Required locked installation, all **654 tests in 84 files**, coverage, lint,
  typecheck, and production build passed on 2026-10-04. Coverage checks passed
  at 96.36% statements, 90.05% branches, 97.83% functions, and 97.55% lines.
  Installation reported the existing five high-severity dependency findings;
  this update changes no dependencies or install-script approvals.
- **58 pgTAP checks** passed in an isolated temporary local database, including
  email/sender search across pages, disclosed-name matching, literal wildcard
  characters, status filters, ordinary-member scope, anonymous/authenticated
  direct-call denial, and banned/revoked actor denial. Both additive fixtures
  were applied twice successfully. Existing users and league data were not changed.
- Production-build Edge checks used synthetic accounts and responses in both
  themes at 1440, 390, and 320 pixels. Home incoming count/link, downloaded ICS
  UTC timestamp, rematch form/payload/new ID, sorting with preserved selection,
  and email/sender search beyond page 1 passed. No browser errors or horizontal
  overflow were observed. Mobile screenshots were visually inspected.
- Component tests additionally cover both rematch participants, spectator
  exclusion, account changes with delayed reads, empty/error/retry states,
  and invitation search reset/clear/error recovery. Calendar tests cover DST
  offsets, UTF-8 folding, escaping, revisions, and cancellation.

### Release activation

The new service-only
[`invitation_search.sql`](../supabase/tests/fixtures/invitation_search.sql)
must follow the existing organizer fixture. The server verifies the actor with
`Auth.getUser`; browsers cannot call this function with a supplied actor.
Until it is installed, empty searches retain the previous authorized listing
fallback. A nonempty search reports that search is unavailable and lets the
user clear it. Authorization and network failures do not fall back.

**Hosted SQL and hosted account flows have not been applied or verified.**
Use the separate schema/RLS/backup/rehearsal/rollback approval gate for database
activation. Invitation API origin restrictions also continue to apply to app
Preview addresses. The browser checks above do not prove live email delivery.

For rollback, deploy the preceding application revision first. The additive
function is compatible with older applications and can remain installed. If
removal is required through the reviewed database process, remove only
`public.invite_search(uuid,integer,text,text)`. Existing invitations and
completed challenges are retained.

## RSVP calendar follow-up, 2026-10-04

The owner requested the calendar action on the destination of View plan & RSVP.
Each upcoming scheduled planning card now offers the shared Add to calendar
action directly below the recorded RSVP response, with the same download-update
disclosure. It is available before and after responding, including after the
RSVP cutoff; cancelled and already-started nights do not offer it.

Locked installation, all 654 tests, coverage, lint, typecheck, build, and diff
checks passed again. Synthetic production-build browser checks in both themes
at 1440, 390, and 320 pixels confirmed Going → saved response → calendar
download with the correct event and UTC timestamp, plus cancelled/past exclusion.
No page errors or horizontal overflow were observed; mobile layout was visually
inspected. No database, dependency, or calendar-file-format changes were made.

## Calendar workflow feedback, 2026-10-04

The owner reported that Add to calendar silently downloaded a file and confirmed
Google Calendar is the primary league preference, with some Apple Calendar users.
The shared action now opens an inline chooser instead of starting a download.
Google Calendar is the primary option and initially opened its prefilled event editor in a
new tab for the user to review and save. The secondary Download .ics file action
shows a live Download requested message and changes its repeat label to
Download .ics again. A browser does not expose reliable file-save completion;
the UI makes no claim that a download finished or that an event was saved.

The Google link follows [Google's supported event-editor template](https://developers.google.com/workspace/calendar/api/concepts/inviting-attendees-to-events#provide_a_link_for_users_to_add_the_event).
It encodes the real start, title, venue, notes and plan link, without attendee
data. No end time is recorded, so the draft uses the same start/end instant and
explicitly tells the user to choose an end time before saving. No guessed
duration is stored. Calendar copies still do not synchronize future changes.

Apple instructions distinguish [Mac Calendar file import](https://support.apple.com/guide/calendar/import-or-export-calendars-icl1023/mac)
from [iPhone's documented import from Mail](https://support.apple.com/guide/iphone/ipha0d932e96/ios).
The UI does not promise a universal native-app launch from a browser download.
No calendar permissions, OAuth integration or automatic email was added.

Locked install, 658 tests in 85 files, coverage, lint, typecheck, build and diff
checks passed. Component tests exercise no automatic download when opening the
chooser, Google encoding, visible download feedback, explicit repeat action and
failure without a success message. Synthetic production-build browser checks
passed on Home and planning in both themes at 1440, 390 and 320 pixels, including
RSVP, Google new-tab navigation, ICS contents, feedback and import-help expansion.
No browser errors or horizontal overflow were observed; narrow layouts were
visually inspected. External provider navigation was intercepted for these
synthetic checks; actual Google save and physical iPhone import remain owner
acceptance. No hosted data or schema changed.

## Android Chrome handoff follow-up, 2026-10-04

The owner observed a brief popup followed by the Google Calendar app opening
without an event draft, and confirmed Android Chrome. This is consistent with
Android routing the HTTPS editor link to the installed app; the exact device
handoff has not been instrumented. Android Chrome now receives a user-clicked
[Chrome intent](https://developer.chrome.com/docs/android/intents) targeting
`com.android.chrome`, with the complete editor URL and an encoded HTTPS fallback.
Other browsers retain the ordinary HTTPS link. The action uses a native anchor
and the shared primary-action appearance, without a new-tab target or scripted
popup. Event fields, calendar-file contents and schedule duration are unchanged.

Locked install, 660 tests in 85 files, coverage, lint, typecheck and production
build passed. Synthetic browser checks covered same-tab HTTPS navigation, the
Android Chrome intent and fallback fields, RSVP and file feedback, both themes
and widths 1440/390/320. Narrow layouts were visually inspected. These checks
intercept provider navigation and simulate the Android user agent; they do not
verify OS dispatch or a real Google save. Owner Android Chrome retesting remains
required. No hosted data or schema changed.

## Repeated Pixel Chrome handoff failure, 2026-10-04

The owner confirmed that the Chrome-targeted intent still focused the Calendar
app without an event on their Pixel using Chrome. The previous simulated
user-agent and URL checks did not verify actual OS behavior and are superseded
as acceptance evidence. Remove the intent and user-agent branch. Use the HTTPS
`https://www.google.com/calendar/render?action=TEMPLATE` endpoint shown in
[Google-hosted event-link support examples](https://support.google.com/calendar/thread/107797661/url-to-add-event-to-calendar?hl=en),
preserving all event fields. This alternative is not a guarantee against Android
app-link interception. Rename the action Add to Google Calendar and remove the
claim that it always opens in Chrome.

The chooser now includes recovery help: copy the event link, paste it into
Chrome's address bar, and, if interception continues, disable Calendar's Open
supported links setting. Android documents this user-controlled setting in its
[app-link verification guide](https://developer.android.com/training/app-links/verify-applinks).
Copy success is announced only after clipboard completion; failure exposes a
labeled selectable link, without a success message. Calendar permissions,
OAuth, hosted data and schema are unchanged.

Locked install, 660 tests in 85 files, coverage, lint, typecheck and build passed.
Synthetic browser checks passed in both themes on Home and the RSVP destination
at 1440/390/320 pixels, including HTTPS navigation, file feedback, clipboard
success and failure, selectable-link recovery and narrow-screen layout. Actual
Google navigation remains intercepted in local QA. The Pixel handoff and real
event save remain unverified until the owner tests the refreshed Preview.

## Two-hour calendar default and reminder question, 2026-10-04

The owner confirmed that the replacement Google approach worked on their phone
and requested an end time two hours after the start. Both the Google template
and downloaded ICS now use that editable calendar default. This supersedes the
earlier no-end-time export decision; it does not store an end time on the league
schedule. Calculate two elapsed hours from the real start instant, including
across midnight and daylight-saving changes. The chooser and event description
explain the default and allow review before saving.

The owner also asked whether the one-day email reminder can default to a
notification. Google's [supported template fields](https://developers.google.com/workspace/calendar/api/concepts/inviting-attendees-to-events#provide_a_link_for_users_to_add_the_event)
do not expose a reminder override. New events use the user's calendar-level
settings unless the user edits the event reminder, as documented in
[Google's notification settings guide](https://support.google.com/calendar/answer/37242).
Programmatic per-event overrides require authenticated Calendar API access
([reminder API guide](https://developers.google.com/workspace/calendar/api/concepts/reminders)).
No unsupported reminder URL parameter, calendar-account setting change or new
OAuth integration was added.

Locked install, 661 tests in 85 files, coverage, lint, typecheck and production
build passed. Tests include midnight rollover and both daylight-saving
transitions. Synthetic browser checks confirmed the two-hour Google dates and
downloaded DTEND on Home and planning, plus RSVP, recovery and download feedback,
in both themes at 1440/390/320 pixels. Actual Google navigation remains
intercepted in these checks; the owner confirmed the previous link handoff, while
the newly defaulted end time still needs owner review in the actual draft.

## Stable Home calendar action row, 2026-10-04

The owner accepted the calendar update and reported that expanding the chooser
on mobile moved Add to calendar below View plan & RSVP. Reproduced the same
reflow in the production build: the calendar wrapper grew to the chooser's
width, making the action-row flex items wrap. The next-night action rows now
keep the calendar trigger as a flex item alongside the planning link, while the
expanded chooser and calendar errors occupy their own full-width row below.
The change is scoped to next-night actions; shared calendar behavior and the
planning-card layout remain unchanged. At very narrow widths, the buttons can
still wrap naturally, but opening or closing no longer changes their positions.

Locked install, 661 tests in 85 files, coverage, lint, typecheck and production
build passed. The added local browser regression assertion failed before the
fix and passed afterward: both buttons' document coordinates and dimensions
stay identical before opening, while open and after closing, at widths
1440/448/390/320 in both themes. Screenshots at phone widths were inspected.
Existing RSVP, two-hour calendar fields, downloads and recovery controls also
passed synthetic browser checks. No page errors or horizontal overflow were
observed. No calendar provider, hosted data or schema changes were made.
