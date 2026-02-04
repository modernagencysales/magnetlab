-- Add saved ideation results to brand_kits
-- This stores the 10 generated lead magnet ideas so users can reuse them

ALTER TABLE brand_kits
ADD COLUMN IF NOT EXISTS saved_ideation_result JSONB,
ADD COLUMN IF NOT EXISTS ideation_generated_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN brand_kits.saved_ideation_result IS 'Cached IdeationResult from AI generation - 10 lead magnet concepts';
COMMENT ON COLUMN brand_kits.ideation_generated_at IS 'When the ideation was last generated';
