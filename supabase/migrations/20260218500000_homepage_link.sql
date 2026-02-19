-- Add homepage link fields for funnel pages and brand kits

-- Team-level default homepage URL (brand kit)
ALTER TABLE brand_kits
  ADD COLUMN IF NOT EXISTS website_url TEXT;

-- Per-funnel homepage link override
ALTER TABLE funnel_pages
  ADD COLUMN IF NOT EXISTS homepage_url TEXT,
  ADD COLUMN IF NOT EXISTS homepage_label TEXT;

COMMENT ON COLUMN brand_kits.website_url IS 'Team default homepage URL shown as a clickable link on funnel pages';
COMMENT ON COLUMN funnel_pages.homepage_url IS 'Per-funnel override for homepage link URL (falls back to brand_kits.website_url)';
COMMENT ON COLUMN funnel_pages.homepage_label IS 'Custom link text for homepage link (e.g. "Visit our website")';
