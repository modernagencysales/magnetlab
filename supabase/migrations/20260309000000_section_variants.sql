-- Add variant column to funnel_page_sections
ALTER TABLE funnel_page_sections
  ADD COLUMN variant TEXT NOT NULL DEFAULT 'default';

-- Drop the old CHECK constraint on section_type and add updated one
ALTER TABLE funnel_page_sections
  DROP CONSTRAINT IF EXISTS funnel_page_sections_section_type_check;

ALTER TABLE funnel_page_sections
  ADD CONSTRAINT funnel_page_sections_section_type_check
  CHECK (section_type IN (
    'logo_bar', 'steps', 'testimonial', 'marketing_block', 'section_bridge',
    'hero', 'stats_bar', 'feature_grid', 'social_proof_wall'
  ));

-- Index for variant queries
CREATE INDEX idx_funnel_page_sections_variant
  ON funnel_page_sections(section_type, variant);
