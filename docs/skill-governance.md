# Project Skill Governance

Status: active

Last reviewed: 2026-08-30

## Purpose

A project skill is a reviewed, reusable workflow that helps an agent perform a
specific task consistently. Skills are executable guidance; the information
registry stores declarative facts, decisions, constraints, and verified
procedures. A fact does not become a skill merely because it is important.

## When a skill is justified

A skill should normally satisfy at least two of these conditions:

- The workflow has been performed more than once and is likely to recur.
- It contains non-obvious branching, ordering, or stopping conditions.
- A missed step could damage hosted data, disclose sensitive information, or
  produce a falsely successful release.
- It repeatedly requires substantial project context that can be referenced
  more safely and concisely.
- It has deterministic inputs, outputs, and verification gates that can be
  tested.
- It relies on reusable scripts, templates, fixtures, or examples.

A single workflow may qualify before repetition when the safety consequence is
high and the procedure can already be validated in a representative, reversible
environment.

## What should not become a skill

Do not create a skill for:

- a one-time plan, status update, or ordinary package bump;
- facts, decisions, preferences, or constraints that belong in the information
  registry;
- generic engineering advice already expressed by standard tooling;
- a simple command with no project-specific judgment;
- an unverified workaround or speculative future workflow;
- instructions that bypass user approval, security controls, tests, reviews,
  or hosted-environment safeguards.

## Candidate dossier

Before implementation, a proposed skill must document:

1. its name, narrow purpose, and owner;
2. positive trigger examples and clear non-trigger examples;
3. required inputs, expected outputs, permissions, and stopping conditions;
4. related information-registry IDs and authoritative project files;
5. reusable scripts, templates, or fixtures, if any;
6. how success, failure, and rollback will be tested;
7. the current Codex-supported discovery or installation location.

Do not invent a repository-local skill path. Confirm the currently supported
Codex tooling and discovery rules when a candidate is approved, because that
interface can evolve independently of this repository.

## Lifecycle

1. **Candidate:** record the dossier; it has no authority to run.
2. **Draft:** write the smallest workflow and reuse existing project scripts.
3. **Review:** check scope, permissions, secret handling, stop conditions, and
   overlap with existing skills or docs.
4. **Validate:** exercise positive, negative, and failure-path examples in a
   reversible environment.
5. **Adopt:** commit the reviewed skill and add a registry pointer with its
   validation date.
6. **Maintain:** revalidate when referenced files, tools, permissions, or
   external APIs change.
7. **Retire:** remove it from discovery and mark the registry record retired or
   superseded.

Skills never silently rewrite themselves. Material changes follow the same
review and validation lifecycle as initial adoption.

## Current assessment

No project skill is being created in this preparation package. The dependency
plan is deliberately a series of independently reviewed changes, not yet a
repeated workflow.

The following are only candidates to revisit after real use:

- dependency-package preflight and verification, if the same guarded sequence
  proves useful across multiple packages;
- Supabase migration rehearsal, once a local or branch database procedure has
  been completed and validated;
- statistics import validation, once the league selects a real CSV or
  scoreboard format and representative fixtures exist.

Candidate status does not authorize implementation or hosted access.

## RDD player release notes — owner-requested project skill

- **Name / owner:** `rdd-player-release-notes`; RDD maintainers Ben and Tim.
  Requested by Ben on 2026-10-04 after player-facing corrections to PRs #75/#76.
- **Purpose:** reusable PR title/body authoring for the website Change Log,
  limited to PRs targeting `main`, including post-merge metadata corrections.
- **Triggers:** "Create the combined release PR to main"; "Rewrite the merged
  main PR description for players." **Non-triggers:** feature PR to
  `release/next`; implementation work without a PR-description task. Unknown
  destination permits a draft, not an assumed `main` metadata update.
- **Inputs / outputs:** actual base branch, final diff, verification evidence
  and current public names; a player-facing title/body followed by technical
  material under `## Testing`, plus saved-metadata verification when authorized.
- **Permissions / stopping conditions:** author locally by default; honor
  existing user authorization for PR publication. Never infer merge, deployment
  or hosted-data permission. Reconcile uncertain writes before retrying.
- **Authorities:** RDD-INFO-025, `AGENTS.md`, `app/api/change-log/route.ts`,
  `app/change-log/ChangeLogClient.tsx`; PRs #69/#75/#76 are tone examples.
- **Resources:** instruction-only skill; no executable helper, dependencies or
  per-user installation. `AGENTS.md` links it for other AI tools.
- **Discovery:** `.agents/skills/rdd-player-release-notes/SKILL.md` at repo root,
  verified against [official Codex skill documentation](https://learn.chatgpt.com/docs/build-skills)
  on 2026-10-04. Codex scans `.agents/skills` from CWD through the repo root.
- **Validation:** frontmatter validator, repository-relative link checks and
  source contract review; reversible local cases cover a main PR, non-main PR,
  unknown destination and preservation of a merged PR's original maintainer
  evidence. No live metadata mutation is required to validate this skill.
- **Rollback / maintenance:** remove the discovery folder and AGENTS pointer
  to retire the skill. Revalidate when the Change Log extraction/rendering,
  supported discovery path or owner wording direction changes. Removing the
  skill does not alter already published PR descriptions.
