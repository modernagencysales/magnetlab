-- Content Pipeline Migration
-- Moves content pipeline from gtm-system to magnetlab with cp_ prefix.
-- Uses user_id (auth.uid()) instead of tenant_id for single-user SaaS auth.
-- Coexists with gtm-system's existing tenant-scoped tables.

-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- CP_CALL_TRANSCRIPTS
-- Raw transcripts from Grain, Fireflies, or paste
-- ============================================
CREATE TABLE cp_call_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('grain', 'fireflies', 'paste')),
  external_id TEXT,
  title TEXT,
  call_date TIMESTAMPTZ,
  duration_minutes INTEGER,
  participants TEXT[],
  raw_transcript TEXT NOT NULL,
  summary TEXT,
  extracted_topics TEXT[],
  transcript_type TEXT CHECK (transcript_type IN ('coaching', 'sales')),
  ideas_extracted_at TIMESTAMPTZ,
  knowledge_extracted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cp_transcripts_user ON cp_call_transcripts(user_id);
CREATE UNIQUE INDEX idx_cp_transcripts_external ON cp_call_transcripts(user_id, external_id)
  WHERE external_id IS NOT NULL;

-- ============================================
-- CP_KNOWLEDGE_ENTRIES
-- Extracted insights, questions, and product intel
-- ============================================
CREATE TABLE cp_knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transcript_id UUID NOT NULL REFERENCES cp_call_transcripts(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('insight', 'question', 'product_intel')),
  speaker TEXT NOT NULL CHECK (speaker IN ('host', 'participant', 'unknown')),
  content TEXT NOT NULL,
  context TEXT,
  tags TEXT[] DEFAULT '{}',
  transcript_type TEXT CHECK (transcript_type IN ('coaching', 'sales')),
  embedding vector(1536),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cp_knowledge_user ON cp_knowledge_entries(user_id);
CREATE INDEX idx_cp_knowledge_category ON cp_knowledge_entries(user_id, category);
CREATE INDEX idx_cp_knowledge_transcript_type ON cp_knowledge_entries(user_id, transcript_type);
CREATE INDEX idx_cp_knowledge_tags ON cp_knowledge_entries USING GIN (tags);
CREATE INDEX idx_cp_knowledge_transcript ON cp_knowledge_entries(transcript_id);
CREATE INDEX idx_cp_knowledge_embedding ON cp_knowledge_entries USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- CP_KNOWLEDGE_TAGS
-- Tag usage tracking for browsing/filtering
-- ============================================
CREATE TABLE cp_knowledge_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag_name TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tag_name)
);

CREATE INDEX idx_cp_knowledge_tags_user ON cp_knowledge_tags(user_id);
CREATE INDEX idx_cp_knowledge_tags_usage ON cp_knowledge_tags(user_id, usage_count DESC);

-- ============================================
-- CP_CONTENT_IDEAS
-- Post-worthy ideas extracted from transcripts
-- ============================================
CREATE TABLE cp_content_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transcript_id UUID REFERENCES cp_call_transcripts(id) ON DELETE CASCADE,

  -- Idea content
  title TEXT NOT NULL,
  core_insight TEXT,
  full_context TEXT,
  why_post_worthy TEXT,
  post_ready BOOLEAN DEFAULT FALSE,

  -- Legacy fields
  hook TEXT,
  key_points TEXT[],
  target_audience TEXT,

  -- Classification
  content_type TEXT CHECK (content_type IN ('story', 'insight', 'tip', 'framework', 'case_study', 'question', 'listicle', 'contrarian')),
  content_pillar TEXT CHECK (content_pillar IN ('moments_that_matter', 'teaching_promotion', 'human_personal', 'collaboration_social_proof')),
  relevance_score INTEGER CHECK (relevance_score BETWEEN 1 AND 10),
  source_quote TEXT,

  -- Pipeline status
  status TEXT DEFAULT 'extracted' CHECK (status IN ('extracted', 'selected', 'writing', 'written', 'scheduled', 'published', 'archived')),

  -- Scoring (autopilot)
  composite_score DECIMAL(5,2),
  last_surfaced_at TIMESTAMPTZ,
  similarity_hash TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cp_ideas_user ON cp_content_ideas(user_id);
CREATE INDEX idx_cp_ideas_status ON cp_content_ideas(user_id, status);
CREATE INDEX idx_cp_ideas_transcript ON cp_content_ideas(transcript_id);
CREATE INDEX idx_cp_ideas_composite_score ON cp_content_ideas(user_id, composite_score DESC NULLS LAST)
  WHERE status = 'extracted';

-- ============================================
-- CP_PIPELINE_POSTS
-- Posts moving through the content pipeline
-- ============================================
CREATE TABLE cp_pipeline_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Source references
  idea_id UUID REFERENCES cp_content_ideas(id) ON DELETE SET NULL,

  -- Content
  draft_content TEXT,
  final_content TEXT,
  dm_template TEXT,
  cta_word TEXT,
  variations JSONB,

  -- Pipeline status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'reviewing', 'approved', 'scheduled', 'published', 'failed')),

  -- Scheduling
  scheduled_time TIMESTAMPTZ,
  leadshark_post_id TEXT,

  -- Polish tracking
  hook_score INTEGER CHECK (hook_score BETWEEN 1 AND 10),
  polish_status TEXT DEFAULT 'pending' CHECK (polish_status IN ('pending', 'polished', 'flagged', 'skipped')),
  polish_notes TEXT,

  -- Buffer management
  is_buffer BOOLEAN DEFAULT FALSE,
  buffer_position INTEGER,
  auto_publish_after TIMESTAMPTZ,

  -- Tracking
  published_at TIMESTAMPTZ,
  engagement_stats JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cp_posts_user ON cp_pipeline_posts(user_id);
CREATE INDEX idx_cp_posts_status ON cp_pipeline_posts(user_id, status);
CREATE INDEX idx_cp_posts_scheduled ON cp_pipeline_posts(user_id, scheduled_time) WHERE scheduled_time IS NOT NULL;
CREATE INDEX idx_cp_posts_buffer ON cp_pipeline_posts(user_id, buffer_position)
  WHERE is_buffer = TRUE AND status = 'approved';
CREATE INDEX idx_cp_posts_auto_publish ON cp_pipeline_posts(auto_publish_after)
  WHERE auto_publish_after IS NOT NULL AND status = 'approved';

-- ============================================
-- CP_POSTING_SLOTS
-- Publishing schedule configuration
-- ============================================
CREATE TABLE cp_posting_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_number INTEGER NOT NULL CHECK (slot_number BETWEEN 1 AND 5),
  time_of_day TIME NOT NULL,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  timezone TEXT DEFAULT 'America/New_York',
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, slot_number)
);

-- ============================================
-- CP_POST_TEMPLATES
-- Reusable post templates with embeddings
-- ============================================
CREATE TABLE cp_post_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  structure TEXT NOT NULL,
  example_posts TEXT[],
  use_cases TEXT[],
  tags TEXT[],
  embedding vector(1536),
  usage_count INTEGER DEFAULT 0,
  avg_engagement_score DECIMAL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cp_templates_user ON cp_post_templates(user_id);
CREATE INDEX idx_cp_templates_embedding ON cp_post_templates USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- CP_WRITING_STYLES
-- Style profiles generated from LinkedIn posts
-- ============================================
CREATE TABLE cp_writing_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  source_linkedin_url TEXT,
  source_posts_analyzed INTEGER DEFAULT 0,
  style_profile JSONB NOT NULL DEFAULT '{}',
  example_posts TEXT[],
  embedding vector(1536),
  is_active BOOLEAN DEFAULT TRUE,
  last_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cp_styles_user ON cp_writing_styles(user_id);
CREATE INDEX idx_cp_styles_embedding ON cp_writing_styles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE cp_call_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cp_knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cp_knowledge_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE cp_content_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cp_pipeline_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cp_posting_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE cp_post_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE cp_writing_styles ENABLE ROW LEVEL SECURITY;

-- User policies (authenticated users can access own data)
CREATE POLICY "Users can access own transcripts" ON cp_call_transcripts
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own knowledge" ON cp_knowledge_entries
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own tags" ON cp_knowledge_tags
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own ideas" ON cp_content_ideas
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own posts" ON cp_pipeline_posts
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own slots" ON cp_posting_slots
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own templates" ON cp_post_templates
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own styles" ON cp_writing_styles
  FOR ALL USING (auth.uid() = user_id);

-- Note: Service role (used by Trigger.dev tasks via createSupabaseAdminClient)
-- bypasses RLS automatically in Supabase. No additional policies needed.

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================

-- Reuse existing function if available, otherwise create
CREATE OR REPLACE FUNCTION cp_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cp_knowledge_entries_updated_at
  BEFORE UPDATE ON cp_knowledge_entries
  FOR EACH ROW EXECUTE FUNCTION cp_update_updated_at();

CREATE TRIGGER cp_content_ideas_updated_at
  BEFORE UPDATE ON cp_content_ideas
  FOR EACH ROW EXECUTE FUNCTION cp_update_updated_at();

CREATE TRIGGER cp_pipeline_posts_updated_at
  BEFORE UPDATE ON cp_pipeline_posts
  FOR EACH ROW EXECUTE FUNCTION cp_update_updated_at();

CREATE TRIGGER cp_posting_slots_updated_at
  BEFORE UPDATE ON cp_posting_slots
  FOR EACH ROW EXECUTE FUNCTION cp_update_updated_at();

CREATE TRIGGER cp_post_templates_updated_at
  BEFORE UPDATE ON cp_post_templates
  FOR EACH ROW EXECUTE FUNCTION cp_update_updated_at();

-- ============================================
-- RPC FUNCTIONS
-- ============================================

-- Buffer reordering: decrement positions after a promoted post
CREATE OR REPLACE FUNCTION cp_decrement_buffer_positions(
  p_user_id UUID,
  p_min_position INTEGER
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE cp_pipeline_posts
  SET buffer_position = buffer_position - 1
  WHERE user_id = p_user_id
    AND is_buffer = TRUE
    AND buffer_position > p_min_position;
$$;

-- Semantic search for knowledge entries
CREATE OR REPLACE FUNCTION cp_match_knowledge_entries(
  query_embedding vector(1536),
  p_user_id UUID,
  threshold FLOAT DEFAULT 0.7,
  match_count INTEGER DEFAULT 10
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
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
    1 - (ke.embedding <=> query_embedding) AS similarity
  FROM cp_knowledge_entries ke
  WHERE ke.user_id = p_user_id
    AND ke.embedding IS NOT NULL
    AND 1 - (ke.embedding <=> query_embedding) > threshold
  ORDER BY ke.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
