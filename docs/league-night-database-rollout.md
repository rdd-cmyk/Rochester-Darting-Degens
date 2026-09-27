# League Night database rollout

Implementation target: local rehearsal only until the hosted release gate is
completed. User authorized building League Night Mode on 2026-09-26.

The SQL in `supabase/pending/` is deliberately outside automatic deployment.
It depends on the existing three tables, not the deferred statistics schema.

## Security contract

`rdd_save_match` is a transaction containing the complete result and its replay
record. It derives the recorder from `auth.uid()`, checks authenticated role,
validates typed player IDs and scores, and permits only creator edits. A stable
operation UUID returns the original saved outcome on retry without replaying
an older edit. The record is retained indefinitely in v1; no cleanup is enabled.
The app also supplies its original user ID as a mismatch guard; the function
checks it against the JWT, never uses it as authorization. Device-local pending
operations are kept until reconciliation. Only unsent/released drafts expire
after 24 hours; one tab cannot erase another operation's recovery record.
Request canonicalization ignores extra fields, normalizes UUID/timestamp and
nullable representations, and sorts participants before comparison.

Definer functions use an empty search path and qualified tables. This is needed
to keep the operation log unwritable by clients and, after enforcement, make
complete transactional operations the only browser match-write path. No
service-role key is sent to the browser. New nights/attendance are readable by
authenticated users; all signed-in users can create nights and update attendance
through restricted RPCs. Saved match-edit ownership is unchanged.

Match and participant triggers increment revisions, including for legacy or
administrative writes. The RPC rejects stale edits. Retained participant row
IDs and fields outside the submitted summary remain intact. Legacy matches
with duplicate or unidentified participants require explicit repair.

## Ordered hosted release

1. Recheck hosted schema, policies, grants, migration history and integration
   settings. Obtain a protected backup and prove restoration in an isolated
   target. Resolve the existing schema/migration-history mismatch with Tim.
2. Review and rehearse both SQL files on a legacy-only database and obtain
   approval for the exact hosted target and SQL. No baseline replay on hosting.
3. Install `league_night.sql` first. Existing clients can still save at this
   point; the complete safer-saving guarantee begins after enforcement.
4. Deploy the RPC-capable app and verify it against the authorized hosted
   target. Keep this release as the rollback version after enforcement.
5. Arrange a short coordinated pause in match entry. Wait for in-flight legacy
   saves to finish and inspect incomplete recent records before continuing.
   Then apply `league_night_enforce.sql` to revoke direct split writes. Tell
   players to refresh old tabs before resuming entry. A transaction spanning
   two HTTP requests cannot be drained merely by waiting for a database lock.
6. Verify create/edit, retries, two-user access, attendance and existing match
   preservation. Remove the pause only after acceptance. This runbook does not
   authorize automatic production deployment or migration-history repair.

Rollback after enforcement must retain an RPC-capable app. Do not restore the
old split-save release blindly, delete new nights, or overwrite newly entered
matches with a stale backup. Revoking enforcement would be a separately
reviewed emergency step with the original partial-save risk made explicit.

## Local targets

`npm run night:local -- start` creates a separate `rdd-league-night` stack with
ports 55420–55429 and app port 3010. Configuration is generated under ignored
`.local/league-night`; inherited remote Docker/workdir settings are removed.
The old advanced-statistics stack and its volumes are preserved. Never link
this local workdir to a hosted project.

Run `node scripts/rehearse-league-night.mjs` for a new legacy-only rehearsal
database and pgTAP tests. It retains the synthetic rehearsal database and, only
after success, refreshes function bodies/enforcement in this isolated development
stack. It never resets tables, changes hosted migration history, or touches the
older stack. Schema changes beyond function bodies require a new reviewed step.

`npm run night:local -- dev` serves the isolated app; `-- build` and `-- serve`
exercise the production build. These commands inject only the guarded local
Supabase configuration and disable hosted telemetry/change-log integrations.

References checked 2026-09-26:
[Supabase function security](https://supabase.com/docs/guides/database/functions),
[PostgreSQL locking](https://www.postgresql.org/docs/17/explicit-locking.html).
