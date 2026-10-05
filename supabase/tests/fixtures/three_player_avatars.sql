-- Existing installations: add only the three approved avatar IDs.
-- Apply through the reviewed release process before the application deploys.
-- No schema, policy, function, or existing player selection changes.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10s';
INSERT INTO rivalry_private.avatar_catalog (id, selectable)
VALUES ('cactus', true), ('gorilla', true), ('dragon', true)
ON CONFLICT (id) DO NOTHING;
COMMIT;
