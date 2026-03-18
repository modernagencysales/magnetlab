-- Add edited_at column to cp_pipeline_posts
-- Tracks when an operator marked a post as edited in the content queue.
-- NULL = not yet edited. Timestamp = when marked edited.
-- Reset to NULL when client requests revisions.

ALTER TABLE cp_pipeline_posts
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

COMMENT ON COLUMN cp_pipeline_posts.edited_at IS 'When an operator marked this post as edited in the content queue. NULL = unedited.';
