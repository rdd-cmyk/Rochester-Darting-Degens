-- Run only on an empty disposable PostgreSQL database, never a hosted project.
\set ON_ERROR_STOP on
CREATE SCHEMA rivalry_private;
CREATE TABLE rivalry_private.avatar_catalog (
  id text PRIMARY KEY,
  selectable boolean NOT NULL DEFAULT true
);
INSERT INTO rivalry_private.avatar_catalog VALUES ('fox', true), ('retired', false);
CREATE TABLE rivalry_private.avatars (
  user_id text PRIMARY KEY,
  avatar_id text REFERENCES rivalry_private.avatar_catalog(id),
  revision integer NOT NULL DEFAULT 1
);
INSERT INTO rivalry_private.avatars VALUES ('existing-player', 'fox', 7);
CREATE TEMP TABLE original_catalog AS SELECT * FROM rivalry_private.avatar_catalog;
CREATE TEMP TABLE original_selections AS SELECT * FROM rivalry_private.avatars;
\ir ../fixtures/three_player_avatars.sql
\ir ../fixtures/three_player_avatars.sql
DO $$
BEGIN
  IF (SELECT count(*) FROM rivalry_private.avatar_catalog) <> 5 THEN
    RAISE EXCEPTION 'Catalog insert or replay failed';
  END IF;
  IF (SELECT count(*) FROM rivalry_private.avatar_catalog
      WHERE id IN ('cactus','gorilla','dragon') AND selectable) <> 3 THEN
    RAISE EXCEPTION 'New avatar is not selectable';
  END IF;
  IF EXISTS(SELECT * FROM original_catalog EXCEPT SELECT * FROM rivalry_private.avatar_catalog)
     OR EXISTS(SELECT * FROM original_selections EXCEPT SELECT * FROM rivalry_private.avatars) THEN
    RAISE EXCEPTION 'Existing catalog or selection changed';
  END IF;
END $$;
INSERT INTO rivalry_private.avatars (user_id, avatar_id)
VALUES ('new-a', 'cactus'), ('new-b', 'gorilla'), ('new-c', 'dragon');
UPDATE rivalry_private.avatar_catalog SET selectable=false WHERE id='cactus';
\ir ../fixtures/three_player_avatars.sql
DO $$
BEGIN
  IF (SELECT selectable FROM rivalry_private.avatar_catalog WHERE id='cactus') THEN
    RAISE EXCEPTION 'Replay re-enabled a retired avatar';
  END IF;
END $$;
SELECT 'PASS: catalog insert, replay, FK selections and existing-row preservation' AS result;
