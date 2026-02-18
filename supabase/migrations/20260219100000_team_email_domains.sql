-- Team email domain verification for whitelabel email sending
-- Allows teams to verify their own domain via Resend API
-- so transactional emails send from their domain instead of sends.magnetlab.app

-- ============================================
-- 1. Create team_email_domains table
-- ============================================

CREATE TABLE IF NOT EXISTS team_email_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  resend_domain_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  dns_records JSONB,
  region TEXT NOT NULL DEFAULT 'us-east-1',
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_team_email_domains_team_id UNIQUE (team_id),
  CONSTRAINT uq_team_email_domains_domain UNIQUE (domain)
);

-- 2. Status check constraint
ALTER TABLE team_email_domains
  ADD CONSTRAINT chk_team_email_domains_status
  CHECK (status IN ('pending', 'verified', 'failed'));

-- 3. Index for domain uniqueness lookups
CREATE INDEX idx_team_email_domains_domain ON team_email_domains(domain);

-- ============================================
-- 4. Add custom_from_email to teams
-- ============================================

ALTER TABLE teams ADD COLUMN IF NOT EXISTS custom_from_email TEXT;

-- ============================================
-- 5. RLS policies for team_email_domains
-- ============================================

ALTER TABLE team_email_domains ENABLE ROW LEVEL SECURITY;

-- Owner CRUD: team owner can manage their email domain
CREATE POLICY team_email_domains_owner_crud ON team_email_domains
  FOR ALL
  USING (
    team_id IN (
      SELECT id FROM teams WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    team_id IN (
      SELECT id FROM teams WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- 6. updated_at trigger
-- ============================================

-- Reuses update_updated_at_column() from initial schema migration
CREATE TRIGGER update_team_email_domains_updated_at
  BEFORE UPDATE ON team_email_domains
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
