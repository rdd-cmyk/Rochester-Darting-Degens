# Bridge-free ESLint 10 options — deferred evaluation

Date: 2026-09-08. Status: research candidates, not an approved migration.
The user requested that these options be saved for possible later evaluation
while Package 3F proceeds. The installed bridge and approved overrides remain.

## Why a different path is possible

The current ESLint 10.10.0 migration preserved the existing plugin behavior
using `@eslint/compat` 2.1.1 and three exact-plugin peer overrides. That was a
bounded migration, not the only possible ESLint 10 configuration.

`eslint-config-next@16.3.4` installs the old React, Import and JSX accessibility
plugins itself. Merely adding replacement plugins leaves that dependency graph
in place. A replacement evaluation should use the official
`@next/eslint-plugin-next` directly, preserving Core Web Vitals rules, and
explicitly configure TypeScript ESLint, React Hooks, globals, parsing and ignores.
This changes the lint preset, not the Next.js application framework.

## Dated candidates

| Existing plugin | Candidate | Evidence and tradeoff |
| --- | --- | --- |
| `eslint-plugin-react` 7.37.5 | `@eslint-react/eslint-plugin` 5.19.0 | Current upstream documentation requires ESLint 10.3+, Node 22+, TypeScript 5+. Its published ESLint peer is broad (`*`); the rule set is not a one-for-one replacement. |
| `eslint-plugin-import` 2.32.0 | `eslint-plugin-import-x` 4.17.1 | Published ESLint peers explicitly include 10. Our active surface is only `no-anonymous-default-export`; verify options and diagnostics. |
| `eslint-plugin-jsx-a11y` 6.10.2 | `eslint-plugin-jsx-a11y-x` 0.2.0 | Published ESLint peers explicitly include 9 and 10. Documents flat-config migration; smaller alternative with maintenance/provenance scrutiny still needed. |

The original three plugins' latest published peer ranges still end at ESLint 9.
Metadata and documentation were inspected on 2026-09-08; these replacements
were not installed or tested together. Declared support does not establish
dependency-graph compatibility, behavior parity or maintainer quality.

## Evaluation gates if separately approved

1. Refresh exact releases, peers, engines, advisories, licenses and maintenance
   evidence. Check for native updates of the original plugins first.
2. Inventory all effective rules and options before replacing the Next preset.
   Map the current 17 React rules (including two usage-marking rules), one Import
   rule and six accessibility rules to equivalents or explicit reviewed gaps.
   Preserve custom Next `Image` accessibility handling and dynamic-route linting.
3. Use an isolated trial. Keep TypeScript ESLint and official Hooks checks;
   resolve overlapping React checks deliberately, not by blanket disabling.
4. Require strict full-graph clean installation without the three overrides,
   the bridge, force, or legacy peer resolution. Verify removed plugins do not
   remain transitively installed through an aggregator.
5. Adapt the existing lint regression corpus to test intended diagnostics,
   including negative/valid examples, and explicitly review non-equivalent rules.
6. Run standard application gates and independent review before adoption.

Success would remove both the runtime bridge and the peer exceptions. The cost
is owning more explicit configuration and changing plugin maintainers. No
promise of exact rule parity is made; this is not a prerequisite for 3F.

## Primary sources

- [Next.js: using its ESLint plugin directly](https://nextjs.org/docs/app/api-reference/config/eslint#using-the-plugin-directly)
- [ESLint React documentation and requirements](https://github.com/Rel1cx/eslint-react)
- [Import X](https://github.com/un-ts/eslint-plugin-import-x)
- [JSX accessibility X and migration instructions](https://github.com/es-tooling/eslint-plugin-jsx-a11y-x)
- Published npm metadata via `npm view <package>@<version> peerDependencies engines repository --json`.

Related: RDD-INFO-016/017/018/019 and `docs/eslint-10-adoption-2026-09-08.md`.
Refresh before any trial; no automated monitoring or new skill was created.
