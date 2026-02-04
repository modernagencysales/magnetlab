-- Add polished content columns to lead_magnets table
-- polished_content stores the AI-polished, block-based content for the public content page
-- polished_at tracks when the content was last polished

ALTER TABLE lead_magnets
ADD COLUMN IF NOT EXISTS polished_content JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS polished_at TIMESTAMPTZ DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN lead_magnets.polished_content IS 'AI-polished block-based content for public content page rendering';
COMMENT ON COLUMN lead_magnets.polished_at IS 'Timestamp of when content was last polished by AI';
