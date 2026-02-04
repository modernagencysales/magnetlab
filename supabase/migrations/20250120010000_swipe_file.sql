-- Swipe File Tables
-- Community-sourced inspiration for posts and lead magnets

-- Swipe file posts (LinkedIn post examples)
CREATE TABLE swipe_file_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Content
  content TEXT NOT NULL,
  hook TEXT, -- First line / attention grabber
  post_type TEXT, -- 'story', 'listicle', 'hot-take', 'educational', 'case-study', 'carousel'

  -- Categorization
  niche TEXT, -- 'coaching', 'saas', 'agency', 'creator', 'b2b', 'other'
  topic_tags TEXT[] DEFAULT '{}',

  -- Performance metrics (optional, for community submissions)
  likes_count INTEGER,
  comments_count INTEGER,
  leads_generated INTEGER,

  -- Source
  source_url TEXT, -- Original LinkedIn post URL if public
  author_name TEXT,
  author_headline TEXT,

  -- Submission info
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'featured'
  is_curated BOOLEAN DEFAULT FALSE, -- Admin-added examples

  -- Metadata
  notes TEXT, -- Why this post works
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Swipe file lead magnets (lead magnet examples)
CREATE TABLE swipe_file_lead_magnets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Content
  title TEXT NOT NULL,
  description TEXT,
  content TEXT, -- The actual lead magnet content
  format TEXT, -- 'checklist', 'template', 'guide', 'swipe-file', 'calculator', 'quiz', 'cheatsheet'

  -- Categorization
  niche TEXT,
  topic_tags TEXT[] DEFAULT '{}',

  -- Performance (optional)
  downloads_count INTEGER,
  conversion_rate DECIMAL(5,2), -- e.g., 45.50 for 45.5%
  leads_generated INTEGER,

  -- Visual
  thumbnail_url TEXT,
  preview_image_url TEXT,

  -- Submission info
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  is_curated BOOLEAN DEFAULT FALSE,

  -- Related post (if submitted with a LinkedIn post)
  related_post_id UUID REFERENCES swipe_file_posts(id) ON DELETE SET NULL,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE swipe_file_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE swipe_file_lead_magnets ENABLE ROW LEVEL SECURITY;

-- Policies: Anyone can read approved items, users can manage their own submissions
CREATE POLICY "Anyone can read approved posts" ON swipe_file_posts
  FOR SELECT USING (status IN ('approved', 'featured'));

CREATE POLICY "Users can manage own submissions" ON swipe_file_posts
  FOR ALL USING (submitted_by = auth.uid());

CREATE POLICY "Anyone can read approved lead magnets" ON swipe_file_lead_magnets
  FOR SELECT USING (status IN ('approved', 'featured'));

CREATE POLICY "Users can manage own lead magnet submissions" ON swipe_file_lead_magnets
  FOR ALL USING (submitted_by = auth.uid());

-- Indexes
CREATE INDEX idx_swipe_posts_status ON swipe_file_posts(status);
CREATE INDEX idx_swipe_posts_niche ON swipe_file_posts(niche);
CREATE INDEX idx_swipe_posts_type ON swipe_file_posts(post_type);
CREATE INDEX idx_swipe_posts_featured ON swipe_file_posts(status) WHERE status = 'featured';

CREATE INDEX idx_swipe_lm_status ON swipe_file_lead_magnets(status);
CREATE INDEX idx_swipe_lm_niche ON swipe_file_lead_magnets(niche);
CREATE INDEX idx_swipe_lm_format ON swipe_file_lead_magnets(format);

-- Triggers for updated_at
CREATE TRIGGER update_swipe_file_posts_updated_at
  BEFORE UPDATE ON swipe_file_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_swipe_file_lead_magnets_updated_at
  BEFORE UPDATE ON swipe_file_lead_magnets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
