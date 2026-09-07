-- Existing hosted schema, exported and reviewed 2026-09-07.
-- The filename orders this baseline BEFORE the additive statistics migration;
-- it is not a claim that the hosted schema was created at this timestamp.
-- Schema only: no player data, passwords, or custom role definitions.
-- Preserve current grants/RLS here; hardening is a separate reviewed change.
-- DO NOT push this baseline to the existing hosted project. Its tables already
-- exist and its migration history was empty at inspection. Reconciliation needs
-- explicit owner approval, a fresh schema comparison, and a verified backup.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

COMMENT ON SCHEMA "public" IS 'standard public schema';

CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";

SET default_tablespace = '';

SET default_table_access_method = "heap";

CREATE TABLE IF NOT EXISTS "public"."match_players" (
    "id" bigint NOT NULL,
    "match_id" bigint,
    "player_id" "uuid",
    "score" numeric,
    "is_winner" boolean,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "points_scored" numeric,
    CONSTRAINT "match_players_points_scored_check" CHECK (("points_scored" > (0)::numeric)),
    CONSTRAINT "match_players_score_check" CHECK (("score" > (0)::numeric))
);

ALTER TABLE "public"."match_players" OWNER TO "postgres";

COMMENT ON COLUMN "public"."match_players"."points_scored" IS 'Points scored in a cricket match';

CREATE SEQUENCE IF NOT EXISTS "public"."match_players_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."match_players_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."match_players_id_seq" OWNED BY "public"."match_players"."id";

CREATE TABLE IF NOT EXISTS "public"."matches" (
    "id" bigint NOT NULL,
    "played_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "game_type" "text",
    "created_by" "uuid",
    "notes" "text",
    "board_type" "text",
    "venue" "text",
    CONSTRAINT "matches_notes_check" CHECK (("length"("notes") < 100)),
    CONSTRAINT "matches_venue_check" CHECK (("length"("venue") < 50))
);

ALTER TABLE "public"."matches" OWNER TO "postgres";

CREATE SEQUENCE IF NOT EXISTS "public"."matches_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE "public"."matches_id_seq" OWNER TO "postgres";

ALTER SEQUENCE "public"."matches_id_seq" OWNED BY "public"."matches"."id";

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text",
    "favorite_checkout" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "first_name" "text",
    "last_name" "text",
    "sex" "text",
    "include_first_name_in_display" boolean,
    CONSTRAINT "profiles_display_name_check" CHECK (("length"("display_name") < 35)),
    CONSTRAINT "profiles_first_name_check" CHECK (("length"("first_name") < 30)),
    CONSTRAINT "profiles_last_name_check" CHECK (("length"("last_name") < 30))
);

ALTER TABLE "public"."profiles" OWNER TO "postgres";

ALTER TABLE ONLY "public"."match_players" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."match_players_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."matches" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."matches_id_seq"'::"regclass");

ALTER TABLE ONLY "public"."match_players"
    ADD CONSTRAINT "match_players_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."match_players"
    ADD CONSTRAINT "match_players_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."match_players"
    ADD CONSTRAINT "match_players_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."matches"
    ADD CONSTRAINT "matches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");

ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

CREATE POLICY "Authenticated can read match_players" ON "public"."match_players" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));

CREATE POLICY "Authenticated can read matches" ON "public"."matches" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));

CREATE POLICY "Authenticated can read profiles" ON "public"."profiles" FOR SELECT USING ((( SELECT "auth"."role"() AS "role") = 'authenticated'::"text"));

CREATE POLICY "Match creator can delete match_players" ON "public"."match_players" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."matches"
  WHERE (("matches"."id" = "match_players"."match_id") AND ("matches"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));

CREATE POLICY "Match creator can insert match_players" ON "public"."match_players" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."matches"
  WHERE (("matches"."id" = "match_players"."match_id") AND ("matches"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));

CREATE POLICY "Match creator can update match_players" ON "public"."match_players" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."matches"
  WHERE (("matches"."id" = "match_players"."match_id") AND ("matches"."created_by" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."matches"
  WHERE (("matches"."id" = "match_players"."match_id") AND ("matches"."created_by" = ( SELECT "auth"."uid"() AS "uid"))))));

CREATE POLICY "User can insert own matches" ON "public"."matches" FOR INSERT WITH CHECK (("created_by" = ( SELECT "auth"."uid"() AS "uid")));

CREATE POLICY "User can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));

CREATE POLICY "User can update own matches" ON "public"."matches" FOR UPDATE USING (("created_by" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("created_by" = ( SELECT "auth"."uid"() AS "uid")));

CREATE POLICY "User can update own profile" ON "public"."profiles" FOR UPDATE USING (("id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("id" = ( SELECT "auth"."uid"() AS "uid")));

ALTER TABLE "public"."match_players" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."matches" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";

GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

GRANT ALL ON TABLE "public"."match_players" TO "anon";
GRANT ALL ON TABLE "public"."match_players" TO "authenticated";
GRANT ALL ON TABLE "public"."match_players" TO "service_role";

GRANT ALL ON SEQUENCE "public"."match_players_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."match_players_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."match_players_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."matches" TO "anon";
GRANT ALL ON TABLE "public"."matches" TO "authenticated";
GRANT ALL ON TABLE "public"."matches" TO "service_role";

GRANT ALL ON SEQUENCE "public"."matches_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."matches_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."matches_id_seq" TO "service_role";

GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
