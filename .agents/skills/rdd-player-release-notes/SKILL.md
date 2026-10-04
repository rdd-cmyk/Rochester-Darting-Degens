---
name: rdd-player-release-notes
description: "Write or revise Rochester Darting Degens PR titles and descriptions for PRs targeting main, where the website Change Log displays them as player-facing release notes. Do not apply to PRs targeting feature or release branches."
---

# RDD player release notes

Use this skill when preparing, creating or editing a PR **whose destination is
`main`**, including editing an already merged PR. The readers are league players,
not just code reviewers. Keep the title and opening description useful to both.

## Establish the scope

- Confirm the PR's actual base branch (`baseRefName` in GitHub, or the explicitly
  requested destination for a new PR). A source branch named `release/next` does
  not establish the destination. If it is not `main`, use ordinary engineering
  PR wording instead. If the destination is unknown, draft locally and resolve
  it before publishing metadata.
- Read the final diff and relevant acceptance evidence. Describe the complete
  final change, including combined feature branches, rather than narrating
  commits, merge history or abandoned approaches.
- Use public feature/page names from current code. Separate implemented behavior
  from proposed features, future work and hosted acceptance that has not passed.
  A PR description is release intent, not proof that production is already live.

## Write for the league

Give the PR a concise, player-friendly title naming the main benefit. Avoid
branch names, commit hashes and internal work-package labels in the title.
An occasional darts emoji is welcome, not required.

Open the body with what players gain and where they can use it. Use the league's
light sports-broadcast voice: competitive, clear and friendly, like friends
talking about the next match. Let the actual features supply the personality.
Avoid forced catchphrases, exaggerated claims, generic AI marketing language
and jokes that obscure instructions.

Scale the notes to the release. A small fix can be a short paragraph and a few
bullets. A combined release can use short headings and a compact feature table.
Explain concrete actions and meaningful changes to familiar flows. Mention
limits that affect players, such as organizer permissions, private practice or
unranked results. Never invent statistics, capabilities or successful checks.

Before publication, read the text as a player on a phone: can they tell what
changed, why they care and where to go? Remove repeated feature lists and
implementation details that do not help them play or use the site.

## Respect the website's extraction contract

Recheck `app/api/change-log/route.ts` and the Change Log renderer when using this
skill; those files are authoritative if the behavior changes.

Currently the site:

- displays the current GitHub title and body for merged PRs with base `main`;
- displays body text only **before the first newline-prefixed Markdown heading
  beginning with `Testing`**, case-insensitively;
- removes whole lines containing `codex`, case-insensitively;
- renders Markdown and caches the GitHub response for fifteen minutes.

Put all player-facing content first, then a separate **`## Testing`** heading.
Below it, keep reviewer validation, limitations, deployment/DB gates, operational
links and maintainer details. Do not remove important approval or release gates
to make the public section prettier. Do not put an early Testing heading above
player notes. Prefer headings, lists and small tables to images or raw HTML;
do not depend on arbitrary remote images being displayed.

For an already merged PR, preserve useful original technical notes below the
cutoff. Label obsolete staging instructions as historical pre-merge evidence,
so they are not mistaken for the current release state. Editing metadata needs
no new merge; the website may retain the earlier text until its cache refreshes.

Public tone examples: PR #69 (September 25, 2026) and revised PRs #75/#76
(October 2 release). Use them as references, not fixed templates or sources of
claims about the next release.

## Deliver and verify

Draft the exact title/body locally if publication is not already authorized.
Creating or editing an authorized PR includes writing its description; this
skill itself grants no permission to send messages, merge, push, deploy or change
hosted data. Do not demand extra approval when the user's existing request
already authorizes the metadata update.

When publishing, use structured tool arguments or `gh pr edit --body-file` to
preserve Markdown and newlines. Read back the saved title, body and base branch;
confirm the visible section ends at the intended Testing heading. For an edit
to a merged PR, also confirm the merge identity remains unchanged. If an edit
has an uncertain outcome, read current metadata before retrying.

Report metadata verification separately from website visual verification. If
the browser remains cached or login is unavailable, state that limit instead
of claiming the website already shows the new notes. Keep secrets, private
account details and internal evidence files out of the public description.
