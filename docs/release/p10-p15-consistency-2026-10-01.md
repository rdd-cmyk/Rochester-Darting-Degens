# P10-P15 consistency and copy

Status: owner-accepted at `f4613de` on 2026-10-01. Baseline
`release/next` at `6e4683b`. The owner authorized all six packages as one batch
on 2026-10-01. P16-P24 remain unstarted; release W6/W7/W8 remain paused at the
saved checkpoint.

## P10: Rivalry Room

The shared feature heading, action variants, fields and panel roles now frame
the existing showcase. Keep “Your history. Your rivals. Your next chapter.”,
“Familiar foes” and “Every game leaves a mark”: these fit the league's broadcast
voice without making functional instructions harder to understand. Incoming
challenges retain their prominent call to action. Selected rivals retain
aria-pressed and gain the shared accent underline without a padding shift.

## P11: Rivalry Pair

The standard “Head to head” heading and “The tale of the tape. Every game leaves
a mark.” introduction distinguish this page from the landing page. Ordinary
sections and dialog controls adopt shared roles. Fight art, TV layout, avatar
geometry and generated poster canvas remain deliberate domain treatments.
The poster download remains a native download link, and the Board draft keeps
its permission boundary and roomy text field.

## P12: Challenge Detail

The standard “The challenge” heading leads with “Set the stakes. Follow the
series. Write the next chapter.” Status, next-game and repair controls use the
same action and field styles. Eligibility, first-to/best-of wording, revision
checks, confirmation, pending-action recovery and match selector remain precise
and unchanged. No challenge lifecycle or result calculation changes.

## P13: League Board

The shared standard heading, form-width shell, panels and buttons replace local
skins. Keep “Between rounds. Before next week. Your league, off the board.” and
the existing starter prompts. Keep/Resume draft copy explicitly describes
storage in this browser tab. Organizer approval, privacy and reporting text
remain literal. Destructive moderation actions use the shared danger variant.

## P14: Board Thread

The page title becomes “League conversation”, with the same Board introduction
and hierarchy. Replies, metadata, composer and options use the shared control
family. Posting, editing, moderation, pagination, markdown, retry identifiers
and ownership rules remain unchanged. Missing-conversation wording is distinct
from a temporary load failure.

## P15: Invitations

“League invitations” adopts the shared standard heading, fields, actions and
panels. Keep “Bring someone to the oche” and the welcoming introduction, while
retaining exact seven-day, inbox verification, origin restriction and retry
instructions. Send invitation and Send challenge retain explicit native submit
semantics. Join remains on its existing styling pending P17.

## Shared dependencies and review boundaries

ActionButton adds an opt-in danger variant. Section-title size is centralized
at its existing value. Inverse action roles are opt-in for dark rivalry artwork;
existing primary/secondary/quiet token values are unchanged. Legacy selectors
exclude opted-in controls so they cannot override shared styling. Home's Board
preview and League Night's challenge banner retain their existing treatment.
BoardComposer also supplies the poster draft; its shared field skin and larger
textarea were reviewed there. No API, SQL, Auth, access, scoring or mutation
handler changes are included.

## Evidence and limits

Focused tests: 109 tests in 12 files pass; focused lint passes. Required trusted
install, 578 tests in 73 files, coverage, full lint, typecheck and production
build pass. Coverage: 96.53% statements, 90.90% branches, 97.76% functions and
97.59% lines. Build uses local defaults when hosted variables are absent. The
pre-existing one high and one critical dependency audit findings remain the
separate release gate. Source review compared button types,
disabled states, handlers, aria attributes and link destinations with baseline.

Synthetic local review covered rivalry discovery, pair/detail navigation,
pending and accepted challenge controls, repair selection, centered poster and
Board draft, Board feed/thread and Keep/Resume draft, invitation submit and
load-error recovery. No real invitation was sent or hosted record changed.
Observed light layout samples include 320, 390, 768 and 1280px; narrow document
views have no horizontal overflow. Controlled dark-token samples cover Board,
Invites and challenge repair. The temporary dark-media override was restored
before final verification. Desktop Stats was checked as an accepted shared
consumer. This is a sampled visual review, not every route/state at every width
and theme, nor proof of real Auth/RLS or durable/exactly-once persistence.

Phone acceptance, keyboard/assistive-technology and zoom checks, remaining theme
and shared-consumer combinations, and real multi-account journeys remain owner
review/final-sweep work. Screenshots and exact publication identities are kept
in the ignored `.local/page-consistency` evidence directory.

No production deployment, main merge, hosted SQL/configuration change or release
gate closure occurred. All six were accepted; the owner authorized P16-P20 as the next batch.
