-- Add team_id to email_sequences (missed in multi_team migration)
ALTER TABLE email_sequences ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

CREATE INDEX idx_email_sequences_team_id ON email_sequences(team_id);

-- Backfill: assign existing sequences to owner's team
UPDATE email_sequences es SET team_id = t.id FROM teams t WHERE es.user_id = t.owner_id AND es.team_id IS NULL;
