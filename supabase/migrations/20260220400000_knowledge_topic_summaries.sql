-- Add summary caching columns to cp_knowledge_topics
ALTER TABLE cp_knowledge_topics ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE cp_knowledge_topics ADD COLUMN IF NOT EXISTS summary_generated_at TIMESTAMPTZ;
