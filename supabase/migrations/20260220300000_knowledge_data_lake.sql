-- Knowledge Data Lake
-- Adds structured metadata columns to cp_knowledge_entries for typed knowledge,
-- topic tracking, quality scoring, supersession chains, and corroboration.
-- Creates cp_knowledge_topics and cp_knowledge_corroborations tables.
-- Adds cp_match_knowledge_entries_v2 RPC with advanced filtering.

-- ============================================
-- 1. New columns on cp_knowledge_entries
-- ============================================

ALTER TABLE cp_knowledge_entries ADD COLUMN IF NOT EXISTS knowledge_type TEXT
  CHECK (knowledge_type IN ('how_to', 'insight', 'story', 'question', 'objection', 'mistake', 'decision', 'market_intel'));

ALTER TABLE cp_knowledge_entries ADD COLUMN IF NOT EXISTS topics TEXT[] DEFAULT '{}';

ALTER TABLE cp_knowledge_entries ADD COLUMN IF NOT EXISTS quality_score INTEGER
  CHECK (quality_score BETWEEN 1 AND 5);

ALTER TABLE cp_knowledge_entries ADD COLUMN IF NOT EXISTS specificity BOOLEAN DEFAULT FALSE;

ALTER TABLE cp_knowledge_entries ADD COLUMN IF NOT EXISTS actionability TEXT
  CHECK (actionability IN ('immediately_actionable', 'contextual', 'theoretical'));

ALTER TABLE cp_knowledge_entries ADD COLUMN IF NOT EXISTS superseded_by UUID
  REFERENCES cp_knowledge_entries(id) ON DELETE SET NULL;

ALTER TABLE cp_knowledge_entries ADD COLUMN IF NOT EXISTS source_date DATE;

-- ============================================
-- 2. Indexes for new columns
-- ============================================

CREATE INDEX IF NOT EXISTS idx_cp_knowledge_type
  ON cp_knowledge_entries (user_id, knowledge_type);

CREATE INDEX IF NOT EXISTS idx_cp_knowledge_topics
  ON cp_knowledge_entries USING GIN (topics);

CREATE INDEX IF NOT EXISTS idx_cp_knowledge_quality
  ON cp_knowledge_entries (user_id, quality_score DESC);

CREATE INDEX IF NOT EXISTS idx_cp_knowledge_superseded
  ON cp_knowledge_entries (superseded_by) WHERE superseded_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cp_knowledge_source_date
  ON cp_knowledge_entries (user_id, source_date DESC);

-- ============================================
-- 3. cp_knowledge_topics table
-- ============================================

CREATE TABLE IF NOT EXISTS cp_knowledge_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID,
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  entry_count INTEGER NOT NULL DEFAULT 0,
  avg_quality FLOAT,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  parent_id UUID REFERENCES cp_knowledge_topics(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_cp_knowledge_topics_user
  ON cp_knowledge_topics (user_id);

CREATE INDEX IF NOT EXISTS idx_cp_knowledge_topics_count
  ON cp_knowledge_topics (user_id, entry_count DESC);

ALTER TABLE cp_knowledge_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own topics"
  ON cp_knowledge_topics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own topics"
  ON cp_knowledge_topics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own topics"
  ON cp_knowledge_topics FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own topics"
  ON cp_knowledge_topics FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 4. cp_knowledge_corroborations table
-- ============================================

CREATE TABLE IF NOT EXISTS cp_knowledge_corroborations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES cp_knowledge_entries(id) ON DELETE CASCADE,
  corroborated_by UUID NOT NULL REFERENCES cp_knowledge_entries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entry_id, corroborated_by)
);

CREATE INDEX IF NOT EXISTS idx_cp_corroborations_entry
  ON cp_knowledge_corroborations (entry_id);

ALTER TABLE cp_knowledge_corroborations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own corroborations"
  ON cp_knowledge_corroborations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cp_knowledge_entries
      WHERE cp_knowledge_entries.id = cp_knowledge_corroborations.entry_id
        AND cp_knowledge_entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own corroborations"
  ON cp_knowledge_corroborations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cp_knowledge_entries
      WHERE cp_knowledge_entries.id = cp_knowledge_corroborations.entry_id
        AND cp_knowledge_entries.user_id = auth.uid()
    )
  );

-- ============================================
-- 5. RPC: cp_update_topic_stats
-- ============================================

CREATE OR REPLACE FUNCTION cp_update_topic_stats(
  p_user_id UUID,
  p_topic_slug TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE cp_knowledge_topics
  SET
    entry_count = (
      SELECT COUNT(*)
      FROM cp_knowledge_entries
      WHERE user_id = p_user_id
        AND superseded_by IS NULL
        AND p_topic_slug = ANY(topics)
    ),
    avg_quality = (
      SELECT AVG(quality_score)::FLOAT
      FROM cp_knowledge_entries
      WHERE user_id = p_user_id
        AND superseded_by IS NULL
        AND p_topic_slug = ANY(topics)
        AND quality_score IS NOT NULL
    ),
    last_seen = now()
  WHERE user_id = p_user_id
    AND slug = p_topic_slug;
END;
$$;

-- ============================================
-- 6. RPC: cp_match_knowledge_entries_v2
-- ============================================

CREATE OR REPLACE FUNCTION cp_match_knowledge_entries_v2(
  query_embedding TEXT,
  p_user_id UUID,
  threshold FLOAT DEFAULT 0.6,
  match_count INTEGER DEFAULT 20,
  p_knowledge_type TEXT DEFAULT NULL,
  p_topic_slug TEXT DEFAULT NULL,
  p_min_quality INTEGER DEFAULT NULL,
  p_since DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  transcript_id UUID,
  category TEXT,
  speaker TEXT,
  content TEXT,
  context TEXT,
  tags TEXT[],
  transcript_type TEXT,
  embedding vector(1536),
  team_id UUID,
  source_profile_id UUID,
  speaker_company TEXT,
  knowledge_type TEXT,
  topics TEXT[],
  quality_score INTEGER,
  specificity BOOLEAN,
  actionability TEXT,
  superseded_by UUID,
  source_date DATE,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_embedding vector(1536);
BEGIN
  -- Cast the text input to vector
  v_embedding := query_embedding::vector(1536);

  RETURN QUERY
  SELECT
    ke.id,
    ke.user_id,
    ke.transcript_id,
    ke.category,
    ke.speaker,
    ke.content,
    ke.context,
    ke.tags,
    ke.transcript_type,
    ke.embedding,
    ke.team_id,
    ke.source_profile_id,
    ke.speaker_company,
    ke.knowledge_type,
    ke.topics,
    ke.quality_score,
    ke.specificity,
    ke.actionability,
    ke.superseded_by,
    ke.source_date,
    ke.created_at,
    ke.updated_at,
    (1 - (ke.embedding <=> v_embedding))::FLOAT AS similarity
  FROM cp_knowledge_entries ke
  WHERE ke.user_id = p_user_id
    AND ke.embedding IS NOT NULL
    AND ke.superseded_by IS NULL
    AND (1 - (ke.embedding <=> v_embedding)) > threshold
    AND (p_knowledge_type IS NULL OR ke.knowledge_type = p_knowledge_type)
    AND (p_topic_slug IS NULL OR p_topic_slug = ANY(ke.topics))
    AND (p_min_quality IS NULL OR ke.quality_score >= p_min_quality)
    AND (p_since IS NULL OR ke.source_date >= p_since)
  ORDER BY ke.embedding <=> v_embedding
  LIMIT match_count;
END;
$$;
