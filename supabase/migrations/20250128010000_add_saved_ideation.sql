-- Add saved_ideation_result column to brand_kits
-- This stores the last ideation result so users can continue from where they left off

ALTER TABLE brand_kits
ADD COLUMN IF NOT EXISTS saved_ideation_result JSONB;

-- Comment explaining purpose
COMMENT ON COLUMN brand_kits.saved_ideation_result IS 'Cached ideation result from last ideation session';
