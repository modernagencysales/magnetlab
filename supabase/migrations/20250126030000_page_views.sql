-- Page Views tracking for funnel analytics
-- Track unique page views per funnel

CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  funnel_page_id UUID REFERENCES funnel_pages(id) ON DELETE CASCADE NOT NULL,
  visitor_hash TEXT NOT NULL, -- Hash of IP + User Agent for unique visitor tracking
  view_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Only count one view per visitor per day
  UNIQUE(funnel_page_id, visitor_hash, view_date)
);

-- Index for efficient queries
CREATE INDEX idx_page_views_funnel ON page_views(funnel_page_id);
CREATE INDEX idx_page_views_date ON page_views(view_date);

-- RLS
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- Users can view their own funnel page views
CREATE POLICY "Users can view own page views" ON page_views FOR SELECT
  USING (funnel_page_id IN (SELECT id FROM funnel_pages WHERE user_id = auth.uid()));

-- Public can insert (for tracking)
CREATE POLICY "Anyone can insert page views" ON page_views FOR INSERT
  WITH CHECK (true);
