-- Edit history for style learning
-- Captures every meaningful content edit across posts, emails, lead magnets, sequences

CREATE TABLE IF NOT EXISTS cp_edit_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES team_profiles(id) ON DELETE SET NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'email', 'lead_magnet', 'sequence')),
  content_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  original_text TEXT NOT NULL,
  edited_text TEXT NOT NULL,
  edit_diff JSONB DEFAULT '{}',
  edit_tags TEXT[] DEFAULT '{}',
  ceo_note TEXT,
  auto_classified_changes JSONB DEFAULT '{}',
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cp_edit_history_team_id ON cp_edit_history(team_id);
CREATE INDEX idx_cp_edit_history_profile_id ON cp_edit_history(profile_id);
CREATE INDEX idx_cp_edit_history_content_type ON cp_edit_history(content_type);
CREATE INDEX idx_cp_edit_history_created_at ON cp_edit_history(created_at DESC);
CREATE INDEX idx_cp_edit_history_unprocessed ON cp_edit_history(profile_id, processed) WHERE processed = FALSE;

ALTER TABLE cp_edit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own team edit history"
  ON cp_edit_history FOR SELECT
  USING (team_id IN (
    SELECT tp.team_id FROM team_profiles tp WHERE tp.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own team edit history"
  ON cp_edit_history FOR INSERT
  WITH CHECK (team_id IN (
    SELECT tp.team_id FROM team_profiles tp WHERE tp.user_id = auth.uid()
  ));

CREATE POLICY "Service role full access on cp_edit_history"
  ON cp_edit_history FOR ALL
  USING (auth.role() = 'service_role');
