-- W4 SELECT-only effective privilege matrix. No row values.
SELECT jsonb_build_object(
 'schemas',(SELECT jsonb_agg(jsonb_build_object('name',nspname,
   'anon',has_schema_privilege('anon',oid,'USAGE'),
   'authenticated',has_schema_privilege('authenticated',oid,'USAGE'),
   'service_role',has_schema_privilege('service_role',oid,'USAGE')) ORDER BY nspname)
   FROM pg_namespace WHERE nspname IN ('public','rdd_private','invite_private','rivalry_private')),
 'tables',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,
   'anon_read',has_table_privilege('anon',c.oid,'SELECT'),
   'auth_read',has_table_privilege('authenticated',c.oid,'SELECT'),
   'auth_write',has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE'),
   'service_read',has_table_privilege('service_role',c.oid,'SELECT')) ORDER BY n.nspname,c.relname)
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname IN ('public','rdd_private','invite_private','rivalry_private') AND c.relkind IN ('r','p','v','m')),
 'functions',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,
   'signature',p.oid::regprocedure::text,
   'anon',has_function_privilege('anon',p.oid,'EXECUTE'),
   'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),
   'service_role',has_function_privilege('service_role',p.oid,'EXECUTE')) ORDER BY n.nspname,p.oid::regprocedure::text)
   FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname IN ('public','rdd_private','invite_private','rivalry_private'))
) AS w4_effective_access;
