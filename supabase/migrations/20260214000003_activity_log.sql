-- Team activity log for audit trail
CREATE TABLE IF NOT EXISTS team_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_team ON team_activity_log(team_id);
CREATE INDEX idx_activity_log_created ON team_activity_log(created_at DESC);

-- Enable RLS
ALTER TABLE team_activity_log ENABLE ROW LEVEL SECURITY;

-- Service role (admin client) has full access for API route writes
CREATE POLICY "Service role full access on team_activity_log"
  ON team_activity_log
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Team members can read their team's activity log
CREATE POLICY "Team members can read own team activity"
  ON team_activity_log
  FOR SELECT
  TO authenticated
  USING (
    team_id IN (
      SELECT id FROM teams WHERE owner_id = auth.uid()
      UNION
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  );
