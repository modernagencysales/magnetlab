-- LinkedIn Action Queue
-- Shared queue for all LinkedIn actions (post campaigns + outreach sequences).
-- Single executor drains per account with priority ordering.

CREATE TABLE linkedin_action_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  unipile_account_id text NOT NULL,
  action_type text NOT NULL CHECK (action_type IN (
    'view_profile', 'connect', 'message', 'follow_up_message',
    'withdraw', 'accept_invitation', 'react', 'comment'
  )),
  target_provider_id text,
  target_linkedin_url text,
  payload jsonb NOT NULL DEFAULT '{}',
  priority integer NOT NULL DEFAULT 10,
  source_type text NOT NULL CHECK (source_type IN ('post_campaign', 'outreach_campaign')),
  source_campaign_id uuid NOT NULL,
  source_lead_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'executing', 'completed', 'failed', 'cancelled'
  )),
  processed boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  error text,
  result jsonb DEFAULT '{}',
  executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_action_queue_drain
  ON linkedin_action_queue (unipile_account_id, status, priority, created_at)
  WHERE status = 'queued';

CREATE INDEX idx_action_queue_results
  ON linkedin_action_queue (source_lead_id, status, processed)
  WHERE status IN ('completed', 'failed') AND processed = false;

ALTER TABLE linkedin_action_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own actions" ON linkedin_action_queue FOR ALL USING (user_id = auth.uid());

-- LinkedIn Activity Log
-- Permanent record of every LinkedIn action executed, regardless of source.

CREATE TABLE linkedin_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  unipile_account_id text NOT NULL,
  action_type text NOT NULL,
  target_provider_id text,
  target_linkedin_url text,
  source_type text NOT NULL,
  source_campaign_id uuid NOT NULL,
  source_lead_id uuid NOT NULL,
  payload jsonb DEFAULT '{}',
  result jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_account
  ON linkedin_activity_log (unipile_account_id, created_at DESC);

ALTER TABLE linkedin_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own activity" ON linkedin_activity_log FOR SELECT USING (user_id = auth.uid());

-- Safety settings: add profile view limit
ALTER TABLE account_safety_settings ADD COLUMN
  max_profile_views_per_day integer NOT NULL DEFAULT 80;

-- Daily limits: add profile views counter
ALTER TABLE linkedin_daily_limits ADD COLUMN
  profile_views integer NOT NULL DEFAULT 0;
