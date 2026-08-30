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

Use npm with the checked-in `package-lock.json`. Preserve useful point-of-use
comments and avoid duplicating them in the registry. Never place credentials,
tokens, private personal data, or environment-file contents in tracked files.

Do not apply the Supabase migration to a hosted project until the roadmap's
schema, Row Level Security, backup, test, and rollback gate is satisfied.
