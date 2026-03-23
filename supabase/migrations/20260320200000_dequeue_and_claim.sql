-- Atomic dequeue: selects the oldest queued action for an account and marks it executing in one statement.
-- Uses FOR UPDATE SKIP LOCKED to prevent race conditions if two workers somehow run concurrently.

CREATE OR REPLACE FUNCTION dequeue_and_claim(p_account_id text)
RETURNS SETOF linkedin_action_queue
LANGUAGE sql
AS $$
  UPDATE linkedin_action_queue
  SET status = 'executing'
  WHERE id = (
    SELECT id
    FROM linkedin_action_queue
    WHERE unipile_account_id = p_account_id
      AND status = 'queued'
    ORDER BY priority ASC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
