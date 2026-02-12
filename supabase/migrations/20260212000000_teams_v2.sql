-- Teams V2: Rich team profiles for content pipeline collaboration
-- Replaces simple team_members with full team + profile model

-- ============================================
-- NEW TABLES
-- ============================================

-- Teams table (1:1 with account owner)
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  industry TEXT,
  target_audience TEXT,
  shared_goal TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id)
);

CREATE INDEX idx_teams_owner_id ON teams(owner_id);

-- Team profiles (each person who posts on LinkedIn)
CREATE TABLE team_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email TEXT,
  full_name TEXT NOT NULL,
  title TEXT,
  linkedin_url TEXT,
  bio TEXT,
  expertise_areas JSONB DEFAULT '[]',
  voice_profile JSONB DEFAULT '{}',
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'removed')),
  is_default BOOLEAN DEFAULT FALSE,
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, email)
);

CREATE INDEX idx_team_profiles_team_id ON team_profiles(team_id);
CREATE INDEX idx_team_profiles_user_id ON team_profiles(user_id);
CREATE INDEX idx_team_profiles_email ON team_profiles(email);

-- Only one default profile per team
CREATE UNIQUE INDEX idx_team_profiles_default ON team_profiles(team_id) WHERE is_default = TRUE;

-- ============================================
-- ALTER EXISTING TABLES: Add team columns
-- ============================================

-- cp_call_transcripts: track which team and speaker
ALTER TABLE cp_call_transcripts ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE cp_call_transcripts ADD COLUMN speaker_profile_id UUID REFERENCES team_profiles(id) ON DELETE SET NULL;

-- cp_knowledge_entries: track team and source profile
ALTER TABLE cp_knowledge_entries ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE cp_knowledge_entries ADD COLUMN source_profile_id UUID REFERENCES team_profiles(id) ON DELETE SET NULL;

-- cp_content_ideas: track assigned profile
ALTER TABLE cp_content_ideas ADD COLUMN team_profile_id UUID REFERENCES team_profiles(id) ON DELETE SET NULL;

-- cp_pipeline_posts: track which profile the post is written for
ALTER TABLE cp_pipeline_posts ADD COLUMN team_profile_id UUID REFERENCES team_profiles(id) ON DELETE SET NULL;

-- cp_posting_slots: per-profile scheduling
ALTER TABLE cp_posting_slots ADD COLUMN team_profile_id UUID REFERENCES team_profiles(id) ON DELETE SET NULL;

-- cp_writing_styles: per-profile styles
ALTER TABLE cp_writing_styles ADD COLUMN team_profile_id UUID REFERENCES team_profiles(id) ON DELETE SET NULL;

-- cp_knowledge_tags: team-level tags
ALTER TABLE cp_knowledge_tags ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- ============================================
-- INDEXES for new columns
-- ============================================

CREATE INDEX idx_cp_transcripts_team_id ON cp_call_transcripts(team_id);
CREATE INDEX idx_cp_transcripts_speaker ON cp_call_transcripts(speaker_profile_id);
CREATE INDEX idx_cp_knowledge_team_id ON cp_knowledge_entries(team_id);
CREATE INDEX idx_cp_knowledge_source_profile ON cp_knowledge_entries(source_profile_id);
CREATE INDEX idx_cp_ideas_profile ON cp_content_ideas(team_profile_id);
CREATE INDEX idx_cp_posts_profile ON cp_pipeline_posts(team_profile_id);
CREATE INDEX idx_cp_slots_profile ON cp_posting_slots(team_profile_id);
CREATE INDEX idx_cp_styles_profile ON cp_writing_styles(team_profile_id);
CREATE INDEX idx_cp_tags_team_id ON cp_knowledge_tags(team_id);

-- ============================================
-- TEAM KNOWLEDGE SEARCH RPC
-- ============================================

-- Search team-wide knowledge with profile boosting (2x for own entries)
CREATE OR REPLACE FUNCTION cp_match_team_knowledge_entries(
  query_embedding TEXT,
  p_team_id UUID,
  p_profile_id UUID DEFAULT NULL,
  threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10
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
  team_id UUID,
  source_profile_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
DECLARE
  parsed_embedding vector(1536);
BEGIN
  parsed_embedding := query_embedding::vector(1536);

  RETURN QUERY
  SELECT
    ke.id,
    ke.user_id,
    ke.transcript_id,
    ke.category::TEXT,
    ke.speaker::TEXT,
    ke.content,
    ke.context,
    ke.tags,
    ke.transcript_type::TEXT,
    ke.team_id,
    ke.source_profile_id,
    ke.created_at,
    ke.updated_at,
    -- Boost similarity for entries from the target profile (2x)
    CASE
      WHEN p_profile_id IS NOT NULL AND ke.source_profile_id = p_profile_id
      THEN LEAST(1.0, (1 - (ke.embedding <=> parsed_embedding)) * 2.0)
      ELSE (1 - (ke.embedding <=> parsed_embedding))
    END AS similarity
  FROM cp_knowledge_entries ke
  WHERE ke.team_id = p_team_id
    AND ke.embedding IS NOT NULL
    AND (1 - (ke.embedding <=> parsed_embedding)) > threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- ============================================
-- DATA MIGRATION
-- ============================================

-- 1. Auto-create teams for users who have cp_* data
INSERT INTO teams (owner_id, name)
SELECT DISTINCT u.id, COALESCE(u.name, u.email, 'My Team')
FROM users u
WHERE EXISTS (SELECT 1 FROM cp_call_transcripts ct WHERE ct.user_id = u.id)
   OR EXISTS (SELECT 1 FROM cp_content_ideas ci WHERE ci.user_id = u.id)
   OR EXISTS (SELECT 1 FROM cp_pipeline_posts pp WHERE pp.user_id = u.id)
ON CONFLICT (owner_id) DO NOTHING;

-- 2. Auto-create default team_profiles (role='owner', is_default=TRUE) for each team
INSERT INTO team_profiles (team_id, user_id, email, full_name, role, status, is_default, accepted_at)
SELECT t.id, t.owner_id, u.email, COALESCE(u.name, u.email, 'Owner'), 'owner', 'active', TRUE, now()
FROM teams t
JOIN users u ON u.id = t.owner_id;

-- 3. Backfill team_id on all existing cp_* rows
UPDATE cp_call_transcripts ct
SET team_id = t.id
FROM teams t
WHERE ct.user_id = t.owner_id AND ct.team_id IS NULL;

UPDATE cp_knowledge_entries ke
SET team_id = t.id
FROM teams t
WHERE ke.user_id = t.owner_id AND ke.team_id IS NULL;

UPDATE cp_knowledge_tags kt
SET team_id = t.id
FROM teams t
WHERE kt.user_id = t.owner_id AND kt.team_id IS NULL;

-- 4. Backfill speaker_profile_id / source_profile_id to default profile
UPDATE cp_call_transcripts ct
SET speaker_profile_id = tp.id
FROM team_profiles tp
WHERE ct.team_id = tp.team_id AND tp.is_default = TRUE AND ct.speaker_profile_id IS NULL;

UPDATE cp_knowledge_entries ke
SET source_profile_id = tp.id
FROM team_profiles tp
WHERE ke.team_id = tp.team_id AND tp.is_default = TRUE AND ke.source_profile_id IS NULL;

UPDATE cp_content_ideas ci
SET team_profile_id = tp.id
FROM teams t
JOIN team_profiles tp ON tp.team_id = t.id AND tp.is_default = TRUE
WHERE ci.user_id = t.owner_id AND ci.team_profile_id IS NULL;

UPDATE cp_pipeline_posts pp
SET team_profile_id = tp.id
FROM teams t
JOIN team_profiles tp ON tp.team_id = t.id AND tp.is_default = TRUE
WHERE pp.user_id = t.owner_id AND pp.team_profile_id IS NULL;

-- 5. Migrate existing team_members into team_profiles (role='member')
INSERT INTO team_profiles (team_id, user_id, email, full_name, role, status, invited_at, accepted_at)
SELECT
  t.id,
  tm.member_id,
  tm.email,
  COALESCE(u.name, tm.email),
  'member',
  tm.status,
  tm.invited_at,
  tm.accepted_at
FROM team_members tm
JOIN teams t ON t.owner_id = tm.owner_id
LEFT JOIN users u ON u.id = tm.member_id
ON CONFLICT (team_id, email) DO NOTHING;
