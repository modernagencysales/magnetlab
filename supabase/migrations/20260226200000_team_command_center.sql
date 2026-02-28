-- ============================================
-- Team Command Center: Foundation Migration
-- ============================================
-- 1. team_profile_integrations table (Unipile/LinkedIn connections per team profile)
-- 2. broadcast_group_id column on cp_pipeline_posts
-- ============================================

-- ============================================
-- 1. team_profile_integrations table
-- ============================================

CREATE TABLE IF NOT EXISTS team_profile_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_profile_id UUID NOT NULL REFERENCES team_profiles(id) ON DELETE CASCADE,
  service TEXT NOT NULL DEFAULT 'unipile',
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  connected_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_profile_id, service)
);

CREATE INDEX idx_team_profile_integrations_profile ON team_profile_integrations(team_profile_id);
CREATE INDEX idx_team_profile_integrations_service ON team_profile_integrations(service) WHERE is_active = true;

-- ============================================
-- 2. RLS policies for team_profile_integrations
-- ============================================

ALTER TABLE team_profile_integrations ENABLE ROW LEVEL SECURITY;

-- SELECT: team owners and members can read their team's integrations
CREATE POLICY "Team members can read integrations"
  ON team_profile_integrations
  FOR SELECT
  USING (
    team_profile_id IN (
      SELECT tp.id FROM team_profiles tp
      WHERE tp.team_id IN (
        SELECT tp2.team_id FROM team_profiles tp2
        WHERE tp2.user_id = auth.uid()
          AND tp2.status = 'active'
      )
    )
  );

-- INSERT: only the connecting user (connected_by = auth.uid())
CREATE POLICY "Users can create integrations they connect"
  ON team_profile_integrations
  FOR INSERT
  WITH CHECK (connected_by = auth.uid());

-- UPDATE: only the user who connected it
CREATE POLICY "Users can update integrations they connected"
  ON team_profile_integrations
  FOR UPDATE
  USING (connected_by = auth.uid())
  WITH CHECK (connected_by = auth.uid());

-- DELETE: only the user who connected it
CREATE POLICY "Users can delete integrations they connected"
  ON team_profile_integrations
  FOR DELETE
  USING (connected_by = auth.uid());

-- ============================================
-- 3. updated_at trigger for team_profile_integrations
-- ============================================

-- Reuses update_updated_at_column() from initial schema migration
CREATE TRIGGER update_team_profile_integrations_updated_at
  BEFORE UPDATE ON team_profile_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. broadcast_group_id on cp_pipeline_posts
-- ============================================

ALTER TABLE cp_pipeline_posts ADD COLUMN IF NOT EXISTS broadcast_group_id UUID;

CREATE INDEX IF NOT EXISTS idx_pipeline_posts_broadcast_group
  ON cp_pipeline_posts(broadcast_group_id)
  WHERE broadcast_group_id IS NOT NULL;
