-- Outreach Campaigns
CREATE TABLE outreach_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id uuid,
  name text NOT NULL,
  preset text NOT NULL CHECK (preset IN ('warm_connect', 'direct_connect', 'nurture')),
  unipile_account_id text NOT NULL,
  connect_message text,
  first_message_template text NOT NULL,
  follow_up_template text,
  follow_up_delay_days integer NOT NULL DEFAULT 3,
  withdraw_delay_days integer NOT NULL DEFAULT 7,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE outreach_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own campaigns" ON outreach_campaigns FOR ALL USING (user_id = auth.uid());

-- Outreach Campaign Steps
CREATE TABLE outreach_campaign_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  step_order integer NOT NULL,
  action_type text NOT NULL CHECK (action_type IN (
    'view_profile', 'connect', 'message', 'follow_up_message', 'withdraw'
  )),
  delay_days integer NOT NULL DEFAULT 0,
  delay_hours integer NOT NULL DEFAULT 0,
  trigger text NOT NULL DEFAULT 'previous_completed' CHECK (trigger IN (
    'previous_completed', 'connection_accepted', 'no_reply'
  )),
  config jsonb NOT NULL DEFAULT '{}',
  UNIQUE(campaign_id, step_order)
);

ALTER TABLE outreach_campaign_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own steps" ON outreach_campaign_steps FOR ALL
  USING (campaign_id IN (SELECT id FROM outreach_campaigns WHERE user_id = auth.uid()));

-- Outreach Campaign Leads
CREATE TABLE outreach_campaign_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  campaign_id uuid NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  linkedin_url text NOT NULL,
  linkedin_username text,
  unipile_provider_id text,
  name text,
  company text,
  current_step_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'active', 'completed', 'replied', 'withdrawn', 'failed', 'skipped'
  )),
  step_completed_at timestamptz,
  viewed_at timestamptz,
  connect_sent_at timestamptz,
  connected_at timestamptz,
  messaged_at timestamptz,
  follow_up_sent_at timestamptz,
  withdrawn_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE outreach_campaign_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own leads" ON outreach_campaign_leads FOR ALL USING (user_id = auth.uid());
