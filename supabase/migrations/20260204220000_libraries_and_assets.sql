-- Libraries & Assets Schema
-- Adds libraries (collections), external resources (tracked links), and funnel target flexibility

-- Enable uuid-ossp extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- EXTERNAL RESOURCES
-- ============================================

CREATE TABLE external_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT DEFAULT '🔗',
  click_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_external_resources_user ON external_resources(user_id);

-- ============================================
-- LIBRARIES
-- ============================================

CREATE TABLE libraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📚',
  slug TEXT NOT NULL,
  auto_feature_days INTEGER DEFAULT 14,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

CREATE INDEX idx_libraries_user ON libraries(user_id);
CREATE INDEX idx_libraries_slug ON libraries(user_id, slug);

-- ============================================
-- LIBRARY ITEMS (Junction Table)
-- ============================================

CREATE TABLE library_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id UUID REFERENCES libraries(id) ON DELETE CASCADE NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('lead_magnet', 'external_resource')),
  lead_magnet_id UUID REFERENCES lead_magnets(id) ON DELETE CASCADE,
  external_resource_id UUID REFERENCES external_resources(id) ON DELETE CASCADE,
  icon_override TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_featured BOOLEAN DEFAULT FALSE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(library_id, lead_magnet_id),
  UNIQUE(library_id, external_resource_id),
  CHECK (
    (asset_type = 'lead_magnet' AND lead_magnet_id IS NOT NULL AND external_resource_id IS NULL) OR
    (asset_type = 'external_resource' AND external_resource_id IS NOT NULL AND lead_magnet_id IS NULL)
  )
);

CREATE INDEX idx_library_items_library ON library_items(library_id);
CREATE INDEX idx_library_items_lead_magnet ON library_items(lead_magnet_id);
CREATE INDEX idx_library_items_external_resource ON library_items(external_resource_id);
CREATE INDEX idx_library_items_sort ON library_items(library_id, sort_order);

-- ============================================
-- EXTERNAL RESOURCE CLICKS (Analytics)
-- ============================================

CREATE TABLE external_resource_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_resource_id UUID REFERENCES external_resources(id) ON DELETE CASCADE NOT NULL,
  funnel_page_id UUID REFERENCES funnel_pages(id) ON DELETE SET NULL,
  library_id UUID REFERENCES libraries(id) ON DELETE SET NULL,
  clicked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_external_resource_clicks_resource ON external_resource_clicks(external_resource_id);
CREATE INDEX idx_external_resource_clicks_funnel ON external_resource_clicks(funnel_page_id);

-- ============================================
-- MODIFY FUNNEL PAGES
-- ============================================

-- Add target type flexibility
ALTER TABLE funnel_pages
  ADD COLUMN target_type TEXT DEFAULT 'lead_magnet' CHECK (target_type IN ('lead_magnet', 'library', 'external_resource')),
  ADD COLUMN library_id UUID REFERENCES libraries(id) ON DELETE SET NULL,
  ADD COLUMN external_resource_id UUID REFERENCES external_resources(id) ON DELETE SET NULL;

-- Remove NOT NULL constraint from lead_magnet_id (libraries and external resources don't need it)
ALTER TABLE funnel_pages ALTER COLUMN lead_magnet_id DROP NOT NULL;

-- Remove UNIQUE constraint on lead_magnet_id (libraries can be used by multiple funnels)
ALTER TABLE funnel_pages DROP CONSTRAINT IF EXISTS funnel_pages_lead_magnet_id_key;

-- Add check constraint for target consistency
ALTER TABLE funnel_pages ADD CONSTRAINT check_funnel_target CHECK (
  (target_type = 'lead_magnet' AND lead_magnet_id IS NOT NULL) OR
  (target_type = 'library' AND library_id IS NOT NULL) OR
  (target_type = 'external_resource' AND external_resource_id IS NOT NULL)
);

-- Index for library lookups
CREATE INDEX idx_funnel_pages_library ON funnel_pages(library_id) WHERE library_id IS NOT NULL;
CREATE INDEX idx_funnel_pages_external_resource ON funnel_pages(external_resource_id) WHERE external_resource_id IS NOT NULL;

-- Backfill existing funnel pages
UPDATE funnel_pages SET target_type = 'lead_magnet' WHERE target_type IS NULL;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE external_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE libraries ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_resource_clicks ENABLE ROW LEVEL SECURITY;

-- External resources: users can manage their own
CREATE POLICY "Users can manage own external resources" ON external_resources
  FOR ALL USING (auth.uid() = user_id);

-- Libraries: users can manage their own
CREATE POLICY "Users can manage own libraries" ON libraries
  FOR ALL USING (auth.uid() = user_id);

-- Library items: users can manage through library ownership
CREATE POLICY "Users can manage own library items" ON library_items
  FOR ALL USING (library_id IN (SELECT id FROM libraries WHERE user_id = auth.uid()));

-- Anyone can view library items for published funnels (for public library pages)
CREATE POLICY "Anyone can view library items for published funnels" ON library_items
  FOR SELECT USING (library_id IN (
    SELECT library_id FROM funnel_pages WHERE is_published = TRUE AND library_id IS NOT NULL
  ));

-- Anyone can view libraries for published funnels
CREATE POLICY "Anyone can view published libraries" ON libraries
  FOR SELECT USING (id IN (
    SELECT library_id FROM funnel_pages WHERE is_published = TRUE AND library_id IS NOT NULL
  ));

-- External resource clicks: anyone can insert (for tracking), only owner can view
CREATE POLICY "Anyone can insert clicks" ON external_resource_clicks
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Users can view own clicks" ON external_resource_clicks
  FOR SELECT USING (external_resource_id IN (SELECT id FROM external_resources WHERE user_id = auth.uid()));

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_external_resources_updated_at BEFORE UPDATE ON external_resources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_libraries_updated_at BEFORE UPDATE ON libraries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
