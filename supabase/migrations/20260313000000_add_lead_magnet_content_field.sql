-- Add unified content field for agent-native MCP v2
-- Replaces the 3-layer pipeline (extracted_content, generated_content, polished_content)
-- Everything optional on create/update; archetype Zod schema validates at publish time

ALTER TABLE lead_magnets
  ADD COLUMN IF NOT EXISTS content JSONB,
  ADD COLUMN IF NOT EXISTS content_version INTEGER NOT NULL DEFAULT 1;

-- Index for content field queries
CREATE INDEX IF NOT EXISTS idx_lead_magnets_content_version
  ON lead_magnets (id, content_version);

COMMENT ON COLUMN lead_magnets.content IS 'Unified content field (MCP v2). Shape defined by archetype Zod schema. Replaces extracted_content/generated_content/polished_content pipeline.';
COMMENT ON COLUMN lead_magnets.content_version IS 'Optimistic locking version. Incremented on each content update.';
