-- READ ONLY / DEFERRED. Run before separately approving validation. Counts only;
-- detailed conflicting rows must remain in approved protected storage.
-- Use the database's actual CHECK definition, rather than a drifting duplicate.
do $$
declare c record; conflicts bigint; expression text;
begin
  if (select count(*) from pg_constraint where
    (conrelid='public.matches'::regclass and conname in
      ('matches_detail_level_valid','matches_entry_source_valid','matches_format_best_of_positive'))
    or (conrelid='public.match_players'::regclass and conname='match_players_advanced_counts_nonnegative')) <> 4 then
    raise exception 'Statistics profile requires all four foundation constraints';
  end if;
  for c in select conname,conrelid,convalidated,pg_get_expr(conbin,conrelid) as predicate
    from pg_constraint where (conrelid='public.matches'::regclass and conname in
      ('matches_detail_level_valid','matches_entry_source_valid','matches_format_best_of_positive'))
      or (conrelid='public.match_players'::regclass and conname='match_players_advanced_counts_nonnegative')
    order by conname
  loop
    expression := c.predicate;
    -- A SQL CHECK allows UNKNOWN; only FALSE is a violation.
    execute format('select count(*) from %s where (%s) is false',c.conrelid::regclass,expression) into conflicts;
    raise notice '%: violations=%, validated=%',c.conname,conflicts,c.convalidated;
  end loop;
end $$;
