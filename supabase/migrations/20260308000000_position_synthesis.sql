-- Position synthesis cache table
-- Stores structured Position objects per user per topic
-- Positions are the synthesis layer between raw knowledge entries and content generation

CREATE TABLE IF NOT EXISTS cp_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_slug TEXT NOT NULL,
  topic_label TEXT NOT NULL,
  position JSONB NOT NULL,
  entry_ids TEXT[] NOT NULL DEFAULT '{}',
  entry_count INT NOT NULL DEFAULT 0,
  is_stale BOOLEAN NOT NULL DEFAULT false,
  synthesized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, topic_slug)
);

-- Fast lookup for stale positions during nightly cron
CREATE INDEX idx_cp_positions_stale ON cp_positions(user_id) WHERE is_stale = true;

-- Fast lookup by user for listing all positions
CREATE INDEX idx_cp_positions_user ON cp_positions(user_id);

-- RLS policies
ALTER TABLE cp_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own positions"
  ON cp_positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own positions"
  ON cp_positions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own positions"
  ON cp_positions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own positions"
  ON cp_positions FOR DELETE
  USING (auth.uid() = user_id);

-- Service role bypass (for Trigger.dev cron and API routes)
CREATE POLICY "Service role full access"
  ON cp_positions FOR ALL
  USING (auth.role() = 'service_role');

-- Helper function: mark positions stale for given topic slugs
CREATE OR REPLACE FUNCTION cp_mark_positions_stale(
  p_user_id UUID,
  p_topic_slugs TEXT[]
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INT;
BEGIN
  UPDATE cp_positions
  SET is_stale = true, updated_at = now()
  WHERE user_id = p_user_id
    AND topic_slug = ANY(p_topic_slugs)
    AND is_stale = false;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
