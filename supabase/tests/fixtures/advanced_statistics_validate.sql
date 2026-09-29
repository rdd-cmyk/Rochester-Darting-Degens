-- LOCAL / DEFERRED ONLY. Separate from additive storage preparation.
-- Profile violations first; never auto-correct, delete or fabricate real data.
-- Validation scans historical rows and takes SHARE UPDATE EXCLUSIVE locks.
-- W3/W5 must measure on the approved representative target before promotion.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';
alter table public.matches validate constraint matches_detail_level_valid;
alter table public.matches validate constraint matches_entry_source_valid;
alter table public.matches validate constraint matches_format_best_of_positive;
alter table public.match_players validate constraint match_players_advanced_counts_nonnegative;
commit;
