-- Team custom domains and white-label support
-- Allows teams to map custom domains to their funnel pages
-- and configure white-label branding (hide MagnetLab branding, custom favicon, etc.)

-- ============================================
-- 1. Create team_domains table
-- ============================================

CREATE TABLE IF NOT EXISTS team_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  vercel_domain_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending_dns',
  dns_config JSONB,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_team_domains_team_id UNIQUE (team_id),
  CONSTRAINT uq_team_domains_domain UNIQUE (domain)
);

-- 2. Status check constraint
ALTER TABLE team_domains
  ADD CONSTRAINT chk_team_domains_status
  CHECK (status IN ('pending_dns', 'verified', 'active', 'error'));

-- 3. Index for fast middleware domain lookup
CREATE INDEX idx_team_domains_domain ON team_domains(domain);

-- ============================================
-- 4. White-label columns on teams table
-- ============================================

ALTER TABLE teams ADD COLUMN IF NOT EXISTS hide_branding BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS custom_favicon_url TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS custom_site_name TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS custom_email_sender_name TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS whitelabel_enabled BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- 5. RLS policies for team_domains
-- ============================================

ALTER TABLE team_domains ENABLE ROW LEVEL SECURITY;

-- Public read: middleware needs unauthenticated access for domain lookup
CREATE POLICY team_domains_public_read ON team_domains
  FOR SELECT
  USING (true);

-- Owner CRUD: team owner can insert, update, delete their own domain
CREATE POLICY team_domains_owner_crud ON team_domains
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
-- 6. updated_at trigger for team_domains
-- ============================================

-- Reuses update_updated_at_column() from initial schema migration
CREATE TRIGGER update_team_domains_updated_at
  BEFORE UPDATE ON team_domains
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
