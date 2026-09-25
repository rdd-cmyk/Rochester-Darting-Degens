# Supabase GitHub integration: application PR release gate

As of 2026-09-25, the advanced-statistics PR is intended to release the web
application without changing the hosted Supabase database. The site uses
existing `matches`, `match_players`, and `profiles` columns for `/stats`.

Supabase documents that **Deploy to production** applies new files under
`supabase/migrations/` on pushes or merges to the production branch. Its
working directory is `.` for this repository. Keeping that option enabled is
acceptable for this PR only if the merged tree has **no deployable migration
SQL** and no other unreviewed migration reaches `main` in the meantime.
The local baseline and additive foundation SQL live under
`supabase/tests/fixtures/`; the guarded local startup and synthetic rehearsal
apply them only to local databases.

Before merging this PR, inspect the final PR diff and Supabase preview check,
confirm `supabase/migrations/` has no SQL, confirm the integration still targets
the intended repository and production branch, and check that no other main
changes introduced pending migrations. Do not merge solely on this source
review. The GitHub integration may still create a schema-empty Supabase preview
branch because its preview schema comes from migrations, not the production
database; this preview is not a substitute for local RLS tests.

Later database rollout is a separate owner-approved change. Refresh the hosted
schema/policies and migration history; verify a recoverable backup and rollback
path; rehearse the additive SQL against a representative database; resolve the
historical baseline/history mismatch; and dry-run deployment until it queues
only approved SQL. Never move the baseline into `supabase/migrations/` for the
existing project or run `migration repair` merely to silence a warning.

References: [Supabase GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration),
[database migrations](https://supabase.com/docs/guides/deployment/database-migrations).
