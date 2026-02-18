-- Add team_id to extraction_sessions (missed in multi_team migration)
-- Fixes: wizard drafts not scoped to team context

ALTER TABLE extraction_sessions ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

CREATE INDEX idx_extraction_sessions_team_id ON extraction_sessions(team_id);

-- Backfill: assign existing sessions to owner's team
UPDATE extraction_sessions es
SET team_id = t.id
FROM teams t
WHERE es.user_id = t.owner_id AND es.team_id IS NULL;
