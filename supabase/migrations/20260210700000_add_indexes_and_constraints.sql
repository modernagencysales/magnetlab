-- Add indexes on foreign key columns used in joins and cascade deletes,
-- and a partial unique constraint to prevent duplicate buffer positions per user.

-- FK indexes for faster joins and ON DELETE CASCADE lookups
CREATE INDEX IF NOT EXISTS idx_cp_content_ideas_transcript_id ON cp_content_ideas(transcript_id);
CREATE INDEX IF NOT EXISTS idx_cp_pipeline_posts_idea_id ON cp_pipeline_posts(idea_id);
CREATE INDEX IF NOT EXISTS idx_cp_knowledge_entries_transcript_id ON cp_knowledge_entries(transcript_id);

-- Partial unique index: only one post per buffer_position per user (NULLs excluded)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cp_pipeline_posts_buffer_position
ON cp_pipeline_posts(user_id, buffer_position)
WHERE buffer_position IS NOT NULL;
