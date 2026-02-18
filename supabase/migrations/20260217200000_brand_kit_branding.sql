-- Add visual branding fields to brand_kits
ALTER TABLE brand_kits
  ADD COLUMN IF NOT EXISTS logos JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS default_testimonial JSONB,
  ADD COLUMN IF NOT EXISTS default_steps JSONB,
  ADD COLUMN IF NOT EXISTS default_theme TEXT DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS default_primary_color TEXT DEFAULT '#8b5cf6',
  ADD COLUMN IF NOT EXISTS default_background_style TEXT DEFAULT 'solid',
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS font_family TEXT,
  ADD COLUMN IF NOT EXISTS font_url TEXT;

-- Add font fields to funnel_pages (snapshot from brand kit at creation)
ALTER TABLE funnel_pages
  ADD COLUMN IF NOT EXISTS font_family TEXT,
  ADD COLUMN IF NOT EXISTS font_url TEXT;

-- Add page_type to page_views for opt-in vs thank-you tracking
ALTER TABLE page_views
  ADD COLUMN IF NOT EXISTS page_type TEXT DEFAULT 'optin';

-- Update unique constraint to include page_type
ALTER TABLE page_views
  DROP CONSTRAINT IF EXISTS page_views_funnel_page_id_visitor_hash_view_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS page_views_funnel_visitor_date_type_key
  ON page_views (funnel_page_id, visitor_hash, view_date, page_type);

-- Backfill: copy user-level defaults into brand kit for users who have them set
UPDATE brand_kits bk
SET
  default_theme = COALESCE(u.default_theme, bk.default_theme),
  default_primary_color = COALESCE(u.default_primary_color, bk.default_primary_color),
  default_background_style = COALESCE(u.default_background_style, bk.default_background_style),
  logo_url = COALESCE(u.default_logo_url, bk.logo_url)
FROM users u
WHERE u.id = bk.user_id
  AND (u.default_theme IS NOT NULL
    OR u.default_primary_color IS NOT NULL
    OR u.default_background_style IS NOT NULL
    OR u.default_logo_url IS NOT NULL);
