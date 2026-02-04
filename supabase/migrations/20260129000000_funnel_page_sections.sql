-- Funnel Page Sections Migration
-- Adds configurable design system sections to funnel pages

CREATE TABLE funnel_page_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  funnel_page_id UUID NOT NULL REFERENCES funnel_pages(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL CHECK (section_type IN (
    'logo_bar', 'steps', 'testimonial', 'marketing_block', 'section_bridge'
  )),
  page_location TEXT NOT NULL CHECK (page_location IN ('optin', 'thankyou', 'content')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_funnel_page_sections_page
  ON funnel_page_sections(funnel_page_id, page_location, sort_order);
