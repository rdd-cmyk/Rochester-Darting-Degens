# League front door branch publication

Owner requested publication of the reviewed local changes to `release/next`
on 2026-10-01, followed by complete CI and Vercel preview checks.

Fresh fetch: local HEAD and origin/release/next both
`a5dbf31cda1ac7bfee004d95d8fe7b7d42c5773b`, ahead/behind zero. No unrelated
commits would publish. Candidate includes the front-door redesign and repairs,
accepted mockup, existing owner-authorized provisional schedule amendment,
and their documentation/tests. It contains no deployable SQL or credentials.

Local application gate before dependency patch: 614 tests, coverage, clean
lint, typecheck, build and trusted install passed. Independent source review
and repair verification are in `league-front-door-review-2026-10-01.md`.

The existing dependency gate must be cleared before pushing. Exact proposed
security patch: Next.js and eslint-config-next 16.3.4 to 16.3.6; compatible
brace-expansion lockfile updates 1.1.18 to 1.1.21 and 5.0.9 to 5.0.12.
Registry versions were verified. No broad upgrade or force-audit fix is proposed.
The [Next.js advisory](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j)
identifies 16.3.6 as patched. Automatic approval review rejected mutation until
separate dependency approval is provided, citing AGENTS.md. Approval was asked
through the pending user question. No dependency changes or push occurred yet.

After approval: apply patches in a separate commit, re-run the complete local
gate and audit, inspect final commit range, push release/next, then verify CI
and Vercel status for the exact published SHA and preview availability.
Production and hosted Supabase schema/data remain unchanged; this preview
publication does not authorize W7/W8 cutover.
