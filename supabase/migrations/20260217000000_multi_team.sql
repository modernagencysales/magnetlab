-- Multi-team agency model: allow multiple teams per owner,
-- add team_id to core resource tables, backfill existing data.

-- 1. Allow multiple teams per owner (was 1:1)
ALTER TABLE teams DROP CONSTRAINT teams_owner_id_key;
-- idx_teams_owner_id already exists from teams_v2 migration

-- 2. Add team_id to core tables (nullable for backward compat)
ALTER TABLE lead_magnets ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE funnel_pages ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE funnel_leads ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE brand_kits ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- 3. Add indexes for team_id lookups
CREATE INDEX idx_lead_magnets_team_id ON lead_magnets(team_id);
CREATE INDEX idx_funnel_pages_team_id ON funnel_pages(team_id);
CREATE INDEX idx_funnel_leads_team_id ON funnel_leads(team_id);
CREATE INDEX idx_brand_kits_team_id ON brand_kits(team_id);

-- 4. Backfill: assign existing resources to owner's team.
--    Safe because UNIQUE(owner_id) existed until step 1, so each user
--    had at most 1 team at the time this migration runs.
UPDATE lead_magnets lm SET team_id = t.id FROM teams t WHERE lm.user_id = t.owner_id AND lm.team_id IS NULL;
UPDATE funnel_pages fp SET team_id = t.id FROM teams t WHERE fp.user_id = t.owner_id AND fp.team_id IS NULL;
UPDATE funnel_leads fl SET team_id = t.id FROM teams t WHERE fl.user_id = t.owner_id AND fl.team_id IS NULL;
UPDATE brand_kits bk SET team_id = t.id FROM teams t WHERE bk.user_id = t.owner_id AND bk.team_id IS NULL;
