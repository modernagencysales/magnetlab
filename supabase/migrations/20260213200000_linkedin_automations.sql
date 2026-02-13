-- LinkedIn Comment→DM Automation Engine
-- Stores automation configs per post and event logs

-- ============================================
-- linkedin_automations: per-post automation config
-- ============================================

CREATE TABLE IF NOT EXISTS linkedin_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  post_id UUID REFERENCES cp_pipeline_posts(id) ON DELETE SET NULL,
  post_social_id TEXT, -- urn:li:activity:XXX
  keywords TEXT[] DEFAULT '{}',
  dm_template TEXT,
  auto_connect BOOLEAN DEFAULT false,
  auto_like BOOLEAN DEFAULT false,
  comment_reply_template TEXT,
  enable_follow_up BOOLEAN DEFAULT false,
  follow_up_template TEXT,
  follow_up_delay_minutes INTEGER DEFAULT 1440, -- 24 hours
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused')),
  unipile_account_id TEXT, -- which LinkedIn account to act from
  leads_captured INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for finding active automations by post
CREATE INDEX idx_linkedin_automations_post_social_id ON linkedin_automations(post_social_id) WHERE status = 'running';
CREATE INDEX idx_linkedin_automations_user_id ON linkedin_automations(user_id);

-- ============================================
-- linkedin_automation_events: event log
-- ============================================

CREATE TABLE IF NOT EXISTS linkedin_automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES linkedin_automations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'comment_detected', 'keyword_matched', 'dm_sent', 'dm_failed',
    'connection_sent', 'connection_failed', 'like_sent', 'like_failed',
    'reply_sent', 'reply_failed', 'follow_up_scheduled', 'follow_up_sent', 'follow_up_failed'
  )),
  commenter_name TEXT,
  commenter_provider_id TEXT,
  commenter_linkedin_url TEXT,
  comment_text TEXT,
  action_details TEXT, -- what was sent (DM text, etc.)
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_events_automation_id ON linkedin_automation_events(automation_id);
CREATE INDEX idx_automation_events_provider_id ON linkedin_automation_events(commenter_provider_id, automation_id);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE linkedin_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_automation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own automations"
  ON linkedin_automations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own automation events"
  ON linkedin_automation_events
  FOR SELECT
  USING (
    automation_id IN (
      SELECT id FROM linkedin_automations WHERE user_id = auth.uid()
    )
  );

-- Service role can insert events (from Trigger.dev tasks)
CREATE POLICY "Service role manages automation events"
  ON linkedin_automation_events
  FOR ALL
  USING (true)
  WITH CHECK (true);
