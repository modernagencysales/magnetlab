-- Add topic classification and lead-magnet detection columns to cp_viral_posts
ALTER TABLE cp_viral_posts
  ADD COLUMN IF NOT EXISTS is_lead_magnet BOOLEAN DEFAULT false;
ALTER TABLE cp_viral_posts
  ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT '{}';

-- Partial index for lead magnet queries
CREATE INDEX IF NOT EXISTS idx_cp_viral_posts_lead_magnet
  ON cp_viral_posts(is_lead_magnet) WHERE is_lead_magnet = true;

-- GIN index for topic array containment queries
CREATE INDEX IF NOT EXISTS idx_cp_viral_posts_topics
  ON cp_viral_posts USING GIN (topics);
