-- Fix email system tables: add columns expected by magnetlab API routes
-- These tables were originally created by gtm-system with tenant_id
-- The magnetlab migration (20260220100000) used CREATE TABLE IF NOT EXISTS
-- which was a no-op since the tables already existed with different columns.

-- email_flows: add team_id, user_id, trigger_lead_magnet_id
ALTER TABLE email_flows ADD COLUMN IF NOT EXISTS team_id UUID;
ALTER TABLE email_flows ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE email_flows ADD COLUMN IF NOT EXISTS trigger_lead_magnet_id UUID;
CREATE INDEX IF NOT EXISTS idx_email_flows_team_id ON email_flows(team_id);

-- email_broadcasts: add team_id, user_id, audience_filter
ALTER TABLE email_broadcasts ADD COLUMN IF NOT EXISTS team_id UUID;
ALTER TABLE email_broadcasts ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE email_broadcasts ADD COLUMN IF NOT EXISTS audience_filter JSONB;
CREATE INDEX IF NOT EXISTS idx_email_broadcasts_team_id ON email_broadcasts(team_id);

-- email_subscribers: add team_id, first_name, last_name, status, source_id, subscribed_at, unsubscribed_at
ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS team_id UUID;
ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS source_id UUID;
ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS subscribed_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;

UPDATE email_subscribers SET status = 'active' WHERE status IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_subscribers_team_email
  ON email_subscribers(team_id, email) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_subscribers_team_status
  ON email_subscribers(team_id, status);

-- email_flow_contacts: add team_id, subscriber_id
ALTER TABLE email_flow_contacts ADD COLUMN IF NOT EXISTS team_id UUID;
ALTER TABLE email_flow_contacts ADD COLUMN IF NOT EXISTS subscriber_id UUID;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
