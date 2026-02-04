-- Add theming options to funnel pages

ALTER TABLE funnel_pages
ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'dark',
ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#8b5cf6',
ADD COLUMN IF NOT EXISTS background_style TEXT DEFAULT 'solid',
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add comments for documentation
COMMENT ON COLUMN funnel_pages.theme IS 'Theme mode: dark, light, or custom';
COMMENT ON COLUMN funnel_pages.primary_color IS 'Primary/accent color in hex format';
COMMENT ON COLUMN funnel_pages.background_style IS 'Background style: solid, gradient, or pattern';
COMMENT ON COLUMN funnel_pages.logo_url IS 'Optional logo URL to display above headline';
