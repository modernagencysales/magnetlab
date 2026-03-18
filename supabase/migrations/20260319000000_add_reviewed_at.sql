-- Add reviewed_at to lead_magnets and funnel_pages
-- Tracks when an operator marked the asset as reviewed in the content queue.
-- NULL = not reviewed. Timestamp = when marked reviewed.
-- Reset to NULL when client requests revisions.

ALTER TABLE lead_magnets ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE funnel_pages ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

COMMENT ON COLUMN lead_magnets.reviewed_at IS 'When an operator marked this lead magnet as reviewed in the content queue. NULL = not reviewed.';
COMMENT ON COLUMN funnel_pages.reviewed_at IS 'When an operator marked this funnel as reviewed in the content queue. NULL = not reviewed.';
