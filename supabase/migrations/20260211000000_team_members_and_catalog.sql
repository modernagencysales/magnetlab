-- Team Members and Catalog Metadata
-- Enables team collaboration: owners invite setters who get read-only catalog access

-- Team members table
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL until accepted
  email TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'removed')),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(owner_id, email)
);

CREATE INDEX idx_team_members_owner_id ON team_members(owner_id);
CREATE INDEX idx_team_members_member_id ON team_members(member_id);
CREATE INDEX idx_team_members_email ON team_members(email);

-- Catalog metadata columns on lead_magnets
ALTER TABLE lead_magnets ADD COLUMN pain_point TEXT;
ALTER TABLE lead_magnets ADD COLUMN target_audience TEXT;
ALTER TABLE lead_magnets ADD COLUMN short_description TEXT;
