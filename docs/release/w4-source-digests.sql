-- W4 SELECT-only stable-key snapshots. Outputs counts and whole-row SHA-256
-- digests, never player, email, Auth, or Storage row values. Run immediately
-- before/after a logical export, then on the isolated restored copy.
SELECT jsonb_build_object(
  'observed_at_utc', now(),
  'tables', jsonb_build_object(
    'auth.users', (SELECT jsonb_build_object('count',count(*),'sha256',
      encode(digest(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY t.id),''),'sha256'),'hex')) FROM auth.users t),
    'auth.identities', (SELECT jsonb_build_object('count',count(*),'sha256',
      encode(digest(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY t.id),''),'sha256'),'hex')) FROM auth.identities t),
    'public.profiles', (SELECT jsonb_build_object('count',count(*),'sha256',
      encode(digest(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY t.id),''),'sha256'),'hex')) FROM public.profiles t),
    'public.matches', (SELECT jsonb_build_object('count',count(*),'sha256',
      encode(digest(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY t.id),''),'sha256'),'hex')) FROM public.matches t),
    'public.match_players', (SELECT jsonb_build_object('count',count(*),'sha256',
      encode(digest(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY t.id),''),'sha256'),'hex')) FROM public.match_players t),
    'storage.buckets', (SELECT jsonb_build_object('count',count(*),'sha256',
      encode(digest(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY t.id),''),'sha256'),'hex')) FROM storage.buckets t),
    'storage.objects', (SELECT jsonb_build_object('count',count(*),'sha256',
      encode(digest(coalesce(string_agg(to_jsonb(t)::text,E'\n' ORDER BY t.id),''),'sha256'),'hex')) FROM storage.objects t)
  ),
  'sequences', jsonb_build_object(
    'matches_id_seq', (SELECT jsonb_build_object('last_value',last_value,'is_called',is_called) FROM public.matches_id_seq),
    'match_players_id_seq', (SELECT jsonb_build_object('last_value',last_value,'is_called',is_called) FROM public.match_players_id_seq)
  )
) AS w4_digests;
