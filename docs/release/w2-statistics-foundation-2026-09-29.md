# W2: future statistics storage

Date: 2026-09-29. **Status: passed locally.** Branch: `release/next`.
Starting source: `9c582fa35cb03f644c0a8eb22e2a5cc59922b00f`.
Verified implementation: `6019d7b` (local commit; completion docs follow).
Scope: local synthetic SQL preparation and source review. No hosted SQL, private
data export, Auth/email configuration, GitHub push or production deployment.

The future foundation now fits the combined release's admission, game-mode and
RPC-saving rules. The current site does not use the view or future fields. No
new statistics, season setup, import or enhanced-score entry interface was added.
W0/W1 remain passed; this change needs W3's combined release acceptance before
any release freeze or hosted promotion. Their historical manifests remain intact.

## Source inputs and order

All SQL remains outside `supabase/migrations/`. The ordered input hashes and
local test target/results are in the [W2 evidence](w2-statistics-evidence-2026-09-29.json).
This is a source preparation manifest, not an approved deployment batch.
Execution-byte hashes preserve the actual checkout line endings; separate LF
hashes identify the committed Git source across Windows/Linux checkouts.

1. Existing schema baseline **only for a new local database**; synthetic legacy
   rows and original-value snapshots **before** any release SQL in upgrade tests.
2. `advanced_statistics_foundation.sql`: additive columns, constraints, timestamps,
   seasons and a closed compatibility view. No season is seeded. Explicit ACLs
   override broad managed defaults on these new surfaces. Authenticated clients
   have season SELECT permission but no permissive read policy yet.
3. League Night, planning, Board, invitation registration and parent admission.
   Invitation SQL can resolve `public.seasons` without a circular dependency.
4. `game_modes.sql`, then `advanced_statistics_final.sql`: member-only season
   read policy and final game-aware, security-invoker view. Finalization refuses
   missing admission or game configuration before changing permissions.
5. Solo, Rivalry's outer match-save wrapper, then separately staged direct-write
   enforcement. W2 exercises this complete final state, not just the old schema.
6. `advanced_statistics_profile.sql`: read-only conflict counts from the actual
   four CHECK predicates. Missing constraints fail explicitly; UNKNOWN values
   follow PostgreSQL CHECK semantics. Detailed real conflicts require protected
   handling and an evidence-backed decision, never automatic correction.
7. `advanced_statistics_validate.sql`: separate atomic validation, with 2-second
   lock timeout and 30-second statement timeout. W3/W5 must refresh and approve
   timeouts from representative-volume evidence; tiny synthetic timings are not
   production downtime estimates. Validation is not automatic after installation.

The final view has one row per canonical participant, with caller base-table
permissions/RLS. It includes the complete nullable `game_config`, preserving
preset, sides/team totals, competitive/practice context, handicap and completion
status. NULL configuration stays unknown. Shared team totals stay in configuration
and are never copied into personal measurements. There are no calculated metrics
in this view. Profile output is limited to ID, display name, first name and its
display preference; surname, sex, notes and creator metadata are omitted.

## Defaults and measurement contracts

| Field | Historical records / default | Meaning and constraint |
| --- | --- | --- |
| `matches.season_id` | NULL / NULL | Optional verified season relationship; no automatic assignment or rating reset. |
| `matches.detail_level` | `summary` / `summary` | Capture completeness only: summary, enhanced or turn; does not certify accuracy or enable UI. |
| `matches.entry_source` | `unknown` / `manual` for subsequent current-recorder inserts | Historical entry route is unverified. Allowed: unknown, manual, csv, scoreboard_image, integration. Imports remain future work. |
| `matches.format_best_of` | NULL / NULL | Optional positive count; no inferred historical match format. |
| `matches.updated_at` | NULL / capture time for new inserts | Last actual database match update afterwards, including parent revision updates from participant changes. Migration time and played time are not fabricated edit histories. `now()` is transaction-stable. |
| `throw_order` | NULL / NULL | Optional positive participant order; no inferred batting/throw order. |
| `legs_won`, `legs_lost` | NULL / NULL | Nonnegative individual leg counts, never shared-team duplication. |
| `darts_thrown` | NULL / NULL | Known positive individual denominator; missing/zero participation is not a fabricated denominator. |
| `x01_points_scored` | NULL / NULL | Nonnegative individual raw X01 total, never reconstructed from an average. |
| `cricket_marks` | NULL / NULL | Nonnegative individual raw marks, distinct from legacy Cricket points. |
| `first_nine_average` | NULL / NULL | Optional three-dart-scale First 9 average, 0–180. Not computed from summary scores. |
| `checkout_attempts`, `checkouts_made` | NULL / NULL | Nonnegative individual counts; made ≤ attempts when both are known. One missing count does not invent the other. |
| `highest_checkout` | NULL / NULL | Nonnegative optional finish value. No double-out 170 ceiling imposed on unknown/open/master-out historical rules; future writers must enforce their actual preset. Smallint storage limit still applies. |
| `scores_100_plus`, `scores_140_plus`, `scores_180` | NULL / NULL | Nonnegative individual achievement counts; overlapping versus exclusive buckets require the future input/calculation contract, not guessed relationships now. |
| `cricket_misses`, `cricket_triple_bull_hits` | NULL / NULL | Nonnegative individual recorded events. Detailed counting convention belongs to a future verified entry source. |
| `marks_5_plus`, `marks_7_plus`, `marks_9` | NULL / NULL | Nonnegative individual high-mark counts; no inferred bucket nesting or raw-total reconstruction. |

Optional columns remain nullable. The four added checks are initially `NOT VALID`:
new/updated rows are checked, but successful additive installation does not claim
historical validation. W2 profiles and validates clean fictional cases, exercises
a conflicting fictional denominator, and proves failure rolls back validation
without editing the conflicting row or partially accepting other constraints.

No global/default-privilege change is bundled: each new W2 table/view/function
closes inherited PUBLIC/anonymous/client rights explicitly inside its transaction.
Seasons and the finalized view allow member reads only; clients have no season
administration or enhanced-stat writes. Direct canonical writes remain revoked.

## Recorder compatibility and limits

The current match recorder still accepts only its established fields. Extra
season/provenance/raw-stat payload fields cannot change storage. Existing valid
saves, exact retries, creator corrections and revision conflict checks work
through admission, game modes and Rivalry. Receipts reflect the final participant
revision triggers; timestamp updates do not introduce a second saving path.

Retained participants preserve optional measured values. Removed participants'
live rows are deleted as before, with prior values retained in owner-only correction
snapshots. Replacement participants start with unknown optional measurements.
Rule/game changes preserve opaque future values; the present API does **not**
reinterpret, clear, recalculate or certify them against changed rules. A future
enhanced-stat editor/consumer must reconcile such changes before using measurements.
This release adds storage, not that editing contract or a richer metric pipeline.

An older experimental installation of the original deferred foundation is
explicitly refused before any changes: it already imposed a 170 ceiling and
fabricated manual provenance/modification timestamps. W2 does not guess which
values were real. A regression installs the original source at `9c582fa`, then
proves rejection preserves rows, ACLs, constraints and policies. W1's production
baseline has no foundation installed; this stop concerns older local experiments
or future drift, not an extra hosted migration authorized here.

## Evidence and review

Reproduce with `node scripts/rehearse-statistics.mjs` (no target/linked flags).
It starts only project `rdd-w2-statistics` under `.local/w2-statistics`, using
loopback API 56821/database 56822 and the loopback Docker network. It uses managed
Auth schema definitions without copying accounts, creates new timestamped
databases, and never resets the original or another feature database. CLI startup
keys are captured without printing or writing them. Results contain fictional
records only and are retained locally in `result.json` and `tap.txt`.
After verification, the dedicated W2 stack was stopped with synthetic volumes
retained. W3 needs its own release stack, not a reset of this evidence target.

The synthetic SQL checks cover fresh install, pre-foundation legacy upgrade,
historical constraint conflict, and refusal of the older experimental foundation.
They cover populated anonymous/provisional/active/revoked reads, owner/nonowner
denial, optional values, preservation, invalid counts, context, wrapper saving,
exact retries, corrections and final revisions. A two-session lock test proves
validation times out and leaves constraint state intact; clean validation then
accepts all four checks. This is not HTTP Auth/PostgREST/browser acceptance.

| Check | Result |
| --- | --- |
| Focused SQL | 303 TAP assertions: 26 storage + 69 final in each of three successful modes, plus nine preservation assertions in each populated legacy mode. |
| Additional guards | Both missing-dependency stages refused; conflicting-row validation rolled back; two-session lock timeout preserved state; old experimental schema refused atomically with unchanged rows/ACLs/constraints/policies; `--linked` refused before mutation. |
| Constraint acceptance | All four checks subsequently validated in the three clean fictional cases. Synthetic end-to-end validation process times: 220 ms fresh, 222 ms legacy, 225 ms conflict-repaired; not production estimates. |
| Application tests | 531 tests / 68 files passed, including future-field isolation. |
| Coverage | Statements 96.53%, branches 90.90%, functions 97.76%, lines 97.59%; thresholds passed. |
| Static checks | Lint, TypeScript, source-hash consistency and documentation checks passed. |
| Build/publication | App runtime/components/dependencies/workflows unchanged from W1. No new build/deployment claim, push or hosted change. |

An independent reviewer examined the SQL, test cases, full save/admission/Rivalry
implementations and harness. One confirmed issue was resolved: silent preservation
of the older deferred fixture through `IF NOT EXISTS`. The explicit refusal and
unchanged-state regression were independently re-reviewed. No remaining confirmed
defects were identified. The owner authorized the separate review agent.

Application regression testing includes a new check proving populated future
fields do not change current summary statistics or ratings. Invitation-only API
stage expectations now require the unfinished view to stay closed; the final-state
member-read contract is exercised here. The Solo full-parent rehearsal includes
the final fixture after game modes. Older partial feature stacks remain stage
evidence; W3 must use this new dependency order on its dedicated release target.

## Remaining release gates

W3 must exercise the complete app, HTTP/API/browser suite, interrupts, preservation,
reader compatibility and rollback on its dedicated synthetic target. W4/W5 must
prove protected backup/restore and production-shaped timing/validation. W6 must
settle real membership, operational configuration and controlled hosted acceptance.
No hosted schema/permission/constraint acceptance is claimed by W2. W7/W8 still
require the final release packet and separate owner authorization.

Primary references checked 2026-09-29: [PostgreSQL 17 caller-permission views](https://www.postgresql.org/docs/17/sql-createview.html),
[constraint validation and locks](https://www.postgresql.org/docs/17/sql-altertable.html),
and [default privilege scope](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).
