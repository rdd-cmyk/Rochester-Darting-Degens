# UI and avatar candidate update

Owner-authorized publication of the local changes on `release/next`, following
the W6 acceptance fixes at `d043d3f`, on 2026-09-30.

The changes add the compact navbar logo, grouped responsive navigation and a
desktop profile avatar; rename avatar display labels; replace the wolf artwork
and its three exports; and include the style guide, source audit and comparison
mockup with their repository pointers. All 24 persisted avatar IDs remain
unchanged. The style guide's remaining proposals do not authorize a site-wide
migration.

No SQL, migration history, dependencies, environment configuration, admission
rules, game writes, statistics calculations or privacy defaults change. The
existing W0-W6 evidence remains valid for its recorded inputs. This is an app
candidate addendum, not a claim that historical checks exercised new UI. W7
must freeze the new app SHA/artifact and include it in the final affected-flow
and compatible-app rollback checks. W7/W8's existing SQL amendment, backup,
approval and cutover requirements are unchanged.

Local checks passed: trusted install; 578 tests; coverage (96.53% statements,
90.90% branches, 97.76% functions, 97.59% lines); lint; type-check; production
build; whitespace check; and avatar ID/asset-path preservation. An initial
coverage run failed one unchanged League Night recovery test while tests and
build ran concurrently; a standalone full coverage rerun passed without source
or test changes. Existing dependency audit findings were not changed.

Local browser checks at 390px and 1440px verified the logo, navigation links,
grouped mobile menu, Escape closing, and no horizontal document overflow.
Hosted preview deployment/CI and signed-in affected controls are verified after
publication; their exact deployment identity belongs in the W7 candidate packet.
No production or hosted database changes are part of this publication.
