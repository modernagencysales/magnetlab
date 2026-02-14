-- Custom domain support for funnel pages
-- Allows pro/unlimited users to map custom domains to their funnel pages

ALTER TABLE funnel_pages ADD COLUMN IF NOT EXISTS custom_domain TEXT;

-- Unique index ensuring no two funnel pages share the same custom domain
CREATE UNIQUE INDEX IF NOT EXISTS idx_funnel_pages_custom_domain
  ON funnel_pages(custom_domain) WHERE custom_domain IS NOT NULL;
