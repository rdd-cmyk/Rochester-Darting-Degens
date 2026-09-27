-- NOT automatically deployed. Run only after the RPC-capable app is ready and
-- legacy writes have been paused and drained. See the rollout document.
BEGIN;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.matches, public.match_players FROM anon, authenticated;
COMMIT;
