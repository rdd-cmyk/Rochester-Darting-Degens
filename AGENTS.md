# Repository Collaboration Guide

Before planning or changing this repository:

1. Read `docs/advanced-statistics-roadmap.md` for delivery order and gates.
2. Read relevant entries in `docs/info-registry.md`; reverify dated or
   inexpensive facts instead of assuming they remain current.
3. Follow `docs/dependency-modernization-plan.md` for Packages 3A–3F. Do not
   begin a package without the requested approval and do not combine packages
   silently.
4. Apply `docs/skill-governance.md` before proposing or creating a project
   skill.
5. Before planning, implementing or reviewing website interface work, read
   `docs/design-standards.md`, including its token, action, accessibility and
   page-title-header contracts. Reuse shared variants instead of route-local
   colors or dimensions. Follow the owner-selected Plain heading with orange
   terminal period (2026-09-30); other draft values remain proposals.
   Documentation does not authorize a site
   migration. For the site-wide upgrade, follow
   `docs/sitewide-design-upgrade-plan.md` and keep its progress ledger current.
   League Night is the root/logo landing page; Stats contains Power, Records
   and Head to Head (owner accepted 2026-10-01). Summer decorations remain optional and
   restrained. Design-only requests stay documentation/mockup-only.

When preparing, creating or revising a PR whose **base is `main`**, read and use
[RDD player release notes](.agents/skills/rdd-player-release-notes/SKILL.md).
It keeps player-facing notes above the Change Log's `## Testing` cutoff and
technical validation and release gates below it. Confirm the destination;
PRs to other branches use ordinary engineering descriptions. This also applies
to post-merge metadata corrections and agents without automatic skill discovery.

Use npm with the checked-in `package-lock.json`. Preserve useful point-of-use
comments and avoid duplicating them in the registry. Never place credentials,
tokens, private personal data, or environment-file contents in tracked files.

Do not apply the Supabase migration to a hosted project until the roadmap's
schema, Row Level Security, backup, test, and rollback gate is satisfied.
The current PR must not contain deployable SQL under `supabase/migrations/`:
the Supabase GitHub integration may deploy it automatically on merge. Keep
the deferred SQL in `supabase/tests/fixtures/` and follow
`docs/supabase-github-integration-release-gate.md` before any merge.

## Required verification

Before committing an implementation change, run the checks relevant to its
scope. A complete application change requires:

```powershell
npm run ci:install
npm test
npm run test:coverage
npm run lint
npm run typecheck
npm run build
```

Report any unavailable or deferred gate explicitly; do not turn it into a
pass. Do not describe hosted Supabase schema, policies, authentication, data, or
migration behavior as verified unless it was exercised against an authorized
target and the evidence was reviewed. Otherwise, label the result source-only
or local-only.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
