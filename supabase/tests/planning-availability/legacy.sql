-- Fictional fixture inserted before the upgrade, for preservation checks.
INSERT INTO auth.users(id,email,raw_user_meta_data)
SELECT ('da000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'availability-'||n||'@example.test','{"organizer":true}'::jsonb FROM generate_series(1,4) n;
INSERT INTO public.profiles(id,display_name) SELECT ('da000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Example '||n FROM generate_series(1,4) n ON CONFLICT(id) DO NOTHING;
INSERT INTO public.league_members(user_id) SELECT ('da000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid FROM generate_series(1,3) n;
INSERT INTO rdd_private.planning_organizers(user_id) VALUES('da000000-0000-4000-8000-000000000001');
INSERT INTO rdd_private.planning_polls(id,title,scope,status,published_at,created_by) VALUES('da000000-0000-4000-8000-000000000010','Example availability','both','open',now(),'da000000-0000-4000-8000-000000000001');
INSERT INTO rdd_private.planning_options(id,poll_id,kind,starts_at) SELECT ('da000000-0000-4000-8000-'||lpad((20+n)::text,12,'0'))::uuid,'da000000-0000-4000-8000-000000000010','date',('2090-10-16 23:00Z'::timestamptz+make_interval(days=>n-1)) FROM generate_series(1,4) n;
INSERT INTO rdd_private.planning_options(id,poll_id,kind,venue) VALUES('da000000-0000-4000-8000-000000000025','da000000-0000-4000-8000-000000000010','venue','Example room');
INSERT INTO rdd_private.planning_ballots VALUES('da000000-0000-4000-8000-000000000010','da000000-0000-4000-8000-000000000003',1);
INSERT INTO rdd_private.planning_votes VALUES('da000000-0000-4000-8000-000000000010','da000000-0000-4000-8000-000000000021','da000000-0000-4000-8000-000000000003'),('da000000-0000-4000-8000-000000000010','da000000-0000-4000-8000-000000000025','da000000-0000-4000-8000-000000000003');
