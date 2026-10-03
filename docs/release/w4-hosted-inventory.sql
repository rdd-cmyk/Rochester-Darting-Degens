-- W4 read-only hosted inventory. This returns metadata and aggregate counts
-- only; no player, email, credential, or Auth row values.
SELECT jsonb_build_object(
  'observed_at_utc', now(),
  'database', current_database(),
  'server_version', current_setting('server_version'),
  'database_size_bytes', pg_database_size(current_database()),
  'counts', jsonb_build_object(
    'auth_users', (SELECT count(*) FROM auth.users),
    'profiles', (SELECT count(*) FROM public.profiles),
    'matches', (SELECT count(*) FROM public.matches),
    'participants', (SELECT count(*) FROM public.match_players),
    'storage_buckets', (SELECT count(*) FROM storage.buckets),
    'storage_objects', (SELECT count(*) FROM storage.objects)
  ),
  'schemas', (SELECT coalesce(jsonb_agg(nspname ORDER BY nspname),'[]'::jsonb)
    FROM pg_namespace WHERE nspname IN
    ('public','auth','storage','rdd_private','invite_private','rivalry_private','supabase_migrations','cron','net')),
  'relations', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'schema',n.nspname,'name',c.relname,'kind',c.relkind,
    'bytes',pg_total_relation_size(c.oid)) ORDER BY n.nspname,c.relname),'[]'::jsonb)
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('public','rdd_private','invite_private','rivalry_private')
    AND c.relkind IN ('r','p','v','m','S')),
  'extensions', (SELECT coalesce(jsonb_agg(jsonb_build_object(
    'name',e.extname,'version',e.extversion) ORDER BY e.extname),'[]'::jsonb)
    FROM pg_extension e),
  'custom_trigger_count', (SELECT count(*) FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE NOT t.tgisinternal AND n.nspname IN ('public','auth','storage','rdd_private','invite_private','rivalry_private')),
  'policy_count', (SELECT count(*) FROM pg_policies WHERE schemaname IN
    ('public','auth','storage','rdd_private','invite_private','rivalry_private')),
  'default_acl_count', (SELECT count(*) FROM pg_default_acl),
  'migration_history_exists', to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,
  'cron_job_table_exists', to_regclass('cron.job') IS NOT NULL,
  'net_queue_table_exists', to_regclass('net.http_request_queue') IS NOT NULL
) AS w4_inventory;
