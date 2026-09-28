-- LOCAL / DEFERRED ONLY. Refresh the task-owned preview inside a transaction.
-- Old cancelled records need positive publication evidence before member reads.
ALTER TABLE rdd_private.planning_polls ADD COLUMN IF NOT EXISTS published_at timestamptz;
UPDATE rdd_private.planning_polls p
SET published_at=coalesce(
  (SELECT min(o.created_at) FROM rdd_private.planning_operations o
   WHERE o.action='save_poll' AND o.result->>'poll_id'=p.id::text
     AND coalesce((o.payload->>'publish')::boolean,false)),
  CASE WHEN p.status IN ('open','closed','scheduled') THEN p.created_at END)
WHERE p.published_at IS NULL;
