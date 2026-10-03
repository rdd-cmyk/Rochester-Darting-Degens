# Solo Play — product and delivery plan

Approved product direction, 27 September 2026. The user authorized implementation with "Let's build it". The local implementation is documented in solo-play-verification-2026-09-28.md. Hosted deployment remains a separate gate. The original mockup and all local demo records are fictional.

Planning update: Practice & Performance is included in the authorized implementation. Local readiness and hosted release are separate.

## Product decision

Add **Solo Play** at `/solo`: a personal practice log for 501, 301 and Cricket, available to signed-in players anywhere and at any time. Start with recording a completed game, not a live dart-by-dart scorer. One entry represents one game/leg; a session groups entries without becoming an extra game. No opponent, winner picker, fabricated loss or league rating is needed.

Keep two independent facts: **what was played** (solo practice) and **where it belongs** (optional league night). Linking a solo game to a night never makes it competitive. Physical location alone does not link it: no GPS or automatic inference from a venue/date match.

Recommended league-night treatment: show an explicitly separate **Solo at the venue** section and a split activity count, such as “12 league matches · 3 solo games.” Official night averages, wins, awards and rating movement use competitive results only. Practice highlights can be labelled as such, but never compete for official night awards. A combined average on the night recap adds confusion without much value; defer it.

## Scope and counting contract

| Surface | Solo away from league night | Solo explicitly linked to a night |
| --- | --- | --- |
| League ranking, Power Rating, record, form and schedule strength | Never | Never |
| League scoring averages, qualification thresholds and awards | Never | Never |
| Owner's solo history | Yes, including entries excluded from stats | Yes |
| Profile Solo statistics | Yes, if “Include in my profile stats” is enabled | Same |
| Profile All play scoring statistics | Explicit opt-in view; compatible scores only | Same; counted once |
| Personal Practice & Performance analysis | Eligible logged practice, compared with later league results | Same; warmups distinguished from earlier practice |
| Competitive night recap | No | Never |
| Separate night practice activity | No | Yes, with explicit night-sharing consent |
| Attendance, eligibility or competitive participation credit | No | No automatic credit |

“All play” is a view, not a new ranked population. Profile opens on **League** to preserve established meaning; **Solo** and **All play** are clearly labelled alternatives. Win percentage, streak, wins/losses and ratings remain in League only. All play shows separate league/solo counts and comparable scoring metrics; never imply a solo completion is a win. Whether public profiles should open on All play is a later product decision.

Profile inclusion is not publication consent. Recommend private solo history and personal solo statistics by default. Provide a separate, explicit profile visibility setting for sharing solo summaries with the profile's permitted audience. Keep free-text notes and precise home location private. Linking to a night separately consents to showing name, game, board, score and time to that night's permitted audience; explain this before saving. Board organizer approval does not automatically gate solo entry or grant access to private practice records.

## Page and main flow

Match the current League Lab and League Night style: `#08264d` navy, `#f47c20` orange, warm cream/page background, white or dark panels, Arial/Helvetica typography, strong uppercase headings, tabular score values, rounded panels and restrained dartboard geometry. Use existing design tokens when implementing.

1. **Log a game** is the default tab. Lead with “Your board. Your pace.” and a persistent “Solo practice · Unranked” label.
2. Pick 501, 301 or Cricket; remember the previous board and scoring rules. X01 uses a clearly selected 3DA or PPD unit; Cricket uses MPR. Keep board type and X01 in/out rules available so comparisons remain compatible.
3. Enter the displayed game average, or record without a score. Optional result state: completed / stopped early. Optional raw fields and private notes live behind progressive disclosure. Do not infer darts, marks, points or checkout rate from an average.
4. Date/time defaults to now, with editable backdated entry. Preserve the played-at timestamp and timezone; creation time is separate. An optional general location label is sufficient; never request a home address.
5. Context defaults to **On my own**. **At league night** reveals an existing-night picker with date and venue, plus an explicit sharing/link control. Warn about date/venue mismatch and allow correction; never create or choose a night silently. Night association is optional even when physically at the venue. A missing or inaccessible night does not block an unlinked solo save.
6. Before saving, show “Profile stats: included/excluded · Night activity: linked/not linked · League rankings: never.” Profile inclusion defaults on for personal stats; audience is separately disclosed.
7. **Save & play again** keeps game/board/context and clears score; a new game gets a new operation ID. **Save game** returns a persistent receipt and recent-history entry. Focus follows the next task; validation errors retain inputs.

The sidebar shows the player's recent practice with explicit units and a comparable personal best. No streak pressure, fake activity or competitive rank. First use replaces these with a useful invitation to log the first game. Below, keep recent solo history and edit/delete entry access. Corrections reflow derived stats and linked practice recaps, with confirmation and undo/recovery appropriate to deletion.

**Your progress** previews the profile's League / Solo / All play breakdown and makes sample sizes and scoring coverage visible. It will also contain **Practice & Performance**, described below. **Night recap** in this mockup demonstrates the proposed integration; in production it belongs within `/league-night`, reached by a link after linking a result, rather than a permanent duplicate recap inside Solo Play.

## Metric definitions

- Solo games: saved, nondeleted entries in the selected date/format/board/rules scope; incomplete entries are labelled separately. Profile summary counts obey inclusion and visibility settings. Night counts obey night association/sharing independently.
- Summary average: arithmetic mean of compatible reported game averages, labelled **Average of game averages**, with `n scored / N games`. Missing scores stay null, not zero. Stopped-early games remain in history but are excluded from comparable performance summaries by default.
- Exact aggregate 3DA: `3 × sum(net X01 points scored) / sum(darts thrown)` only over entries with complete valid raw data and compatible rules. Count bust darts according to the documented scoring contract. Do not mix this with reported-average entries and call the result exact.
- PPD to 3DA: multiply by three, retaining original units/source. Cricket MPR: `3 × sum(valid marks) / sum(darts thrown)` only with valid compatible raw evidence. No X01/Cricket or soft-/steel-tip pooling.
- Personal best: highest eligible reported game average in that same scope, separately labelled from best finish or fastest leg. With insufficient data, show the available games without improvement claims.
- Combined profile averages: use the same metric definition and compatible scoring coverage across league and solo. Do not average two already-averaged population numbers equally. When only summaries exist, weight each population by scored-game count. Display separate counts and source/detail quality. Night association is metadata and never adds a second copy of a solo game.
- Trends compare equal, disclosed windows with enough samples. Defer trend conclusions when score coverage or format changes invalidate comparison.

## Practice & Performance

Add a personal analysis section within **Your progress** to explore whether logged solo practice is associated with subsequent league performance. It never changes league rankings or competitive eligibility. The first delivery includes a paired timeline, a **Practice before league night** comparison and one plain-language insight card.

### Two questions, two views

1. **Am I improving?** Plot solo and league scoring averages as separately labelled lines, with logged practice-game counts underneath on the same time axis. Keep the scoring lines on one common scoring scale and practice volume in its own panel. Show actual observations, gaps and sample sizes; do not fill missing periods with zero or imply continuity through long gaps. Selecting a period reveals the underlying eligible games and scoring coverage.
2. **Do better league nights tend to follow more practice?** Use one observation per player/night. Compare the number of eligible solo games logged in the seven local calendar days before that night with the player's league scoring average that night. Also show that night's difference from their recent league baseline, so gradual improvement over time is visible rather than mistaken for a practice effect. Each point exposes its dates, practice count, league-game count, score coverage and baseline.

Use 3DA for X01 and MPR for Cricket as the primary outcomes, preserving the summary-versus-exact aggregation rules above. Filter by player, format, board and compatible rules; do not mix 301/501, X01/Cricket or soft-/steel-tip results. Win rate and opponent-adjusted rating movement are possible secondary views later, because opponents and competitive sample size affect them.

### Comparison and interpretation contract

- Use played-at chronology, not submission time. Anchor date windows in the league night's timezone. Primary practice volume covers the seven calendar days before the night's date; same-day practice is separate. The proposed recent baseline is the player's preceding five eligible league-night averages, weighted equally by night, excluding the current night. Show available baseline coverage. Freeze the window and baseline definitions before evaluating patterns; do not search many windows and present only the most flattering result.
- Distinguish **same-night warmups** from preceding-days practice. For that separate comparison, only solo games demonstrably completed before the player's first competitive game qualify. Practice between or after competitive games cannot explain earlier results. The current generic played-at timestamp is not enough to prove completion order: define timestamp semantics or collect completion time before shipping warmup claims. Ambiguous chronology stays out of that comparison.
- Practice volume counts completed, nondeleted solo entries included in personal stats, even if their score is missing. Scoring trends require a valid compatible score. Excluded entries and stopped-early games remain visible in history but outside this initial analysis. Label counts as **logged practice**; zero logged games does not establish that no practice occurred. Linking a game to a night neither creates a second observation nor makes it competitive.
- Use only the signed-in player's permitted records. Keep the analysis private by default; public solo-summary visibility does not automatically publish this analysis. Editing, deleting, backdating or changing inclusion must recompute affected windows and insights.
- Show the timeline as soon as observations exist. Before releasing directional insight text, define and test minimum eligible-night counts, scoring/baseline coverage, variation in practice volume and uncertainty criteria. No fixed count alone guarantees a reliable relationship. With insufficient evidence, show **Not enough comparable nights yet**; with adequate but inconclusive evidence, show **No clear relationship yet**. Constant practice counts cannot support a practice-volume correlation.
- Communicate association, not causation. Opponent mix, ordinary improvement over time, selective logging and other changes can affect results. Baseline comparisons help describe the pattern but do not establish that practice caused it. Repeated nights and overlapping practice windows are not independent samples; any formal correlation, interval or inference needs an appropriate documented method before release. Do not infer a relationship merely because both time-series lines rise.

Example insight wording, illustrative only: **“Your league scoring has tended to be higher after weeks with more logged practice.”** When justified, accompany the statement with the observed difference and units, the exact comparison definition, supporting night counts and uncertainty. Avoid a prominent unexplained correlation coefficient, causal claims such as “practice improved your average by X,” or conclusions drawn from a few standout games. A readable methodology disclosure should expose how every insight was calculated.

## Source-informed technical proposal

Inspected the main checkout and the active `league-night-mode` and `league-message-board` worktrees at base `690a01b`, including their uncommitted local feature work. Source-only findings:

- `lib/stats/engine.ts` ignores records with fewer than two participants or anything other than one winner, but that is not a sufficient exclusion guarantee for every consumer.
- `app/profiles/[id]/page.tsx` derives profile games/wins/losses from `match_players`; solo records placed there could pollute those denominators.
- `lib/league-night/types.ts` and `api.ts` have explicit night IDs, revisions and match participants. The League Night write design requires 2–10 players and one winner.
- League Night already defines transactional saves, stable retry IDs, conflicts and recovery. Reuse the reliability pattern without weakening competitive validation.

Recommend additive **`solo_sessions`** and **`solo_games`** tables, leaving `matches` and `match_players` untouched. Sessions group practice; each game snapshots its own context and may link to a night. No assumption that every game in a session has the same venue/night. A signed-in user creates only their own solo entries in v1; recording on behalf of others is deferred.

Proposed game fields: UUID, session ID, authenticated owner ID, played-at UTC instant and IANA timezone, format, board type, rule variant, completion status, original summary value/unit, optional validated raw points/marks/darts and checkout fields, input source/detail level, nullable night ID, include-in-profile-stats, private notes, revision, creation/update timestamps and deletion state. No winner field, rating-eligible toggle or season-ranking field. Night association is not competitive eligibility.

Expose dedicated solo read/write contracts and explicit profile/night projections. The league engine continues to receive only competitive facts; combine sources only in deliberate All play or activity views, with a discriminator and globally unique identity. Avoid a universal union view that existing ranking queries might accidentally adopt. Audit homepage totals, all profiles, CSV exports, profile counts and recap/share-card code, not just `/stats`.

Enforce ownership and audience rules in the database; clients cannot trust themselves to select another player's identity or grant visibility. A narrowly scoped night projection must not expose private notes or unshared locations. Validate existing night, access, bounds, units and revisions server-side. Organizer moderation of a shared practice item may unlink/hide it from that night's recap without rewriting the owner's private score; define and test that role before shipping.

Atomic writes use a stable caller-scoped operation ID plus normalized payload hash. Same-ID/same-payload retry returns the canonical saved outcome. Changed payload is rejected; deliberate new game gets a new ID. Preserve submitted snapshots through unknown responses and reconcile before retrying edited content. Edits require expected revision; retries cannot resurrect deleted entries. Drafts are user/device-scoped, recover after sign-in, and are never shown as synced until confirmed. V1 allows offline draft entry and manual retry after reconnect; durable background offline synchronization is a later feature.

## States and acceptance

- Signed out: explain Solo Play and sign in to save; no private history prefetch. Empty, loading and request failure are distinct states.
- Saving / checking save / saved / refresh failure: preserve the correct receipt and inputs without double counting. Switching tabs, formats, accounts or nights cannot relabel an already-submitted payload.
- Summary-only, no score, early stop, backdated, duplicate-looking rematch, invalid score, edit conflict, revoked night access and deleted night: explicit behavior and preserved drafts.
- Phone at 320/390 pixels, tablet at 768, desktop at 1440; light/dark, long names, 200% zoom, keyboard and screen reader, reduced motion. Touch targets at least 44px. No page overflow or keyboard-obscured errors/actions.
- Regression proof: adding/editing/deleting/linking/unlinking any solo game leaves league ratings, wins, losses, averages, qualification and awards unchanged. Profile/nights update exactly once in their intended scope.
- Tests for unit conversion, missing-score denominator, incompatible rules, private/public visibility, cross-account reads/writes, invalid night linkage, stale revisions and interrupted-save recovery. Never rely only on UI filters for exclusion or privacy.
- Practice & Performance: verify prior-only windows and baseline calculations, timezone/date boundaries, missing scores versus no logged practice, incompatible formats/rules, constant practice volume, sparse history and overlapping windows. Verify same-night completion ordering before showing warmup comparisons. Corrections must update affected comparisons without double counting or changing competitive results. Test inconclusive/insufficient states and keyboard-accessible chart details with a text/table alternative.

## Delivery sequence

1. **Agree on the experience:** the user approved building Solo Play and Practice & Performance. Local implementation follows the self-entry-only, private-by-default direction. Hosted release is a separate decision.
2. **Local foundation:** additive fixture schema, owner/audience policies, atomic solo writes and deterministic exclusion tests. Keep SQL outside `supabase/migrations/` under the repository release rules. Reconcile with whichever League Night changes are accepted at implementation time.
3. **Solo page:** entry/history/editing, drafts, receipts, format-aware fields and personal summaries. Start with 501, 301 and Cricket; defer arbitrary drills until their scoring semantics are defined.
4. **Profile and night integration:** explicit filters, separate totals, optional night sharing, profile visibility and separately labelled share-card practice section. Retest all competitive consumers.
5. **Practice & Performance:** build the paired timeline, preceding-practice comparison and guarded insight card within Your progress, using the established solo and league data contracts. Finalize metric definitions, sample/uncertainty rules and chronology semantics before enabling conclusions. Sparse real history receives honest empty/insufficient states, not synthetic production insights.
6. **Release review:** relevant application/database/browser checks, then repository-required implementation gates. Hosted schema/RLS inspection, backup/rollback, migration-history review and owner publication approval remain separate from local readiness.

Later ideas: checkout drills, personal targets, live scoring, bot practice, CSV import and richer turn analysis. Bot games remain practice; no route into league rankings. Avoid adding these to the first delivery just to fill the page.

## Mockup boundary

`solo-play.html` is an interactive, responsive design fragment: game selection, context/link selection, stat inclusion, synthetic save receipt/history, profile scopes and separate night activity work locally in memory. It has no backend, sign-in, upload, actual draft persistence or production writes. Read-only sample records cannot be edited. The fragment can be shown directly in the conversation; screenshots and a temporary local wrapper are used only for visual review.

The original mockup did not include Practice & Performance. The application now implements it in Your progress; see [implementation, verification and remaining release gates](solo-play-verification-2026-09-28.md). The archived mockup remains a design artifact, not a backend test.
