-- Add UPDATE policy for cp_edit_history
-- Matches the pattern used in SELECT/INSERT policies (team_profiles membership check)
CREATE POLICY "Users can update own team edit history"
  ON cp_edit_history FOR UPDATE
  USING (team_id IN (
    SELECT tp.team_id FROM team_profiles tp WHERE tp.user_id = auth.uid()
  ));
