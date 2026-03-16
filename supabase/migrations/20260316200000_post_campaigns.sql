-- Post Campaign Automation
-- Automates LinkedIn comment → connection acceptance → DM → funnel pipeline.
-- See docs/superpowers/specs/2026-03-16-post-campaign-automation-design.md

-- ─── post_campaigns ──────────────────────────────────────────────────────

CREATE TABLE post_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES teams(id) ON DELETE SET NULL,
  name text NOT NULL,

  post_url text NOT NULL,
  keywords text[] NOT NULL DEFAULT '{}',

  unipile_account_id text NOT NULL,
  sender_name text,

  dm_template text NOT NULL,
  connect_message_template text,
  funnel_page_id uuid REFERENCES funnel_pages(id) ON DELETE RESTRICT,

  auto_accept_connections boolean NOT NULL DEFAULT true,
  auto_like_comments boolean NOT NULL DEFAULT false,
  auto_connect_non_requesters boolean NOT NULL DEFAULT false,

  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'paused', 'completed')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CHECK (array_length(keywords, 1) > 0)
);

CREATE INDEX idx_post_campaigns_user_status ON post_campaigns(user_id, status);

ALTER TABLE post_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own campaigns"
  ON post_campaigns FOR ALL USING (user_id = auth.uid());

-- ─── post_campaign_leads ─────────────────────────────────────────────────

CREATE TABLE post_campaign_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES post_campaigns(id) ON DELETE CASCADE,
  signal_lead_id uuid REFERENCES signal_leads(id) ON DELETE SET NULL,

  linkedin_url text NOT NULL,
  linkedin_username text,
  unipile_provider_id text,
  name text,
  comment_text text,

  status text NOT NULL DEFAULT 'detected'
    CHECK (status IN ('detected', 'connection_pending', 'connection_accepted',
                      'dm_queued', 'dm_sent', 'dm_failed', 'skipped')),

  detected_at timestamptz NOT NULL DEFAULT now(),
  connection_accepted_at timestamptz,
  dm_sent_at timestamptz,
  error text,

  UNIQUE(campaign_id, linkedin_url)
);

CREATE INDEX idx_pcl_campaign_status ON post_campaign_leads(campaign_id, status);
CREATE INDEX idx_pcl_user ON post_campaign_leads(user_id);
CREATE INDEX idx_pcl_linkedin_url ON post_campaign_leads(linkedin_url);

ALTER TABLE post_campaign_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own campaign leads"
  ON post_campaign_leads FOR ALL USING (user_id = auth.uid());

-- ─── linkedin_daily_limits ───────────────────────────────────────────────

CREATE TABLE linkedin_daily_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unipile_account_id text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  dms_sent integer NOT NULL DEFAULT 0,
  connections_accepted integer NOT NULL DEFAULT 0,
  connection_requests_sent integer NOT NULL DEFAULT 0,
  UNIQUE(unipile_account_id, date)
);

CREATE INDEX idx_ldl_account_date ON linkedin_daily_limits(unipile_account_id, date);

ALTER TABLE linkedin_daily_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own limits"
  ON linkedin_daily_limits FOR ALL USING (user_id = auth.uid());

-- ─── Atomic increment for daily limits ───────────────────────────────────

CREATE OR REPLACE FUNCTION increment_daily_limit(
  p_account_id text,
  p_date date,
  p_field text
) RETURNS void AS $$
BEGIN
  EXECUTE format(
    'UPDATE linkedin_daily_limits SET %I = %I + 1 WHERE unipile_account_id = $1 AND date = $2',
    p_field, p_field
  ) USING p_account_id, p_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
