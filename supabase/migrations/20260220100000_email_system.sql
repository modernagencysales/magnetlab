-- Email System: flows, steps, subscribers, contacts, broadcasts
-- Provides the foundation for email automation and broadcast sending

-- ============================================
-- TABLE: email_flows
-- ============================================

CREATE TABLE IF NOT EXISTS email_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('lead_magnet', 'manual')),
  trigger_lead_magnet_id UUID REFERENCES lead_magnets(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_flows_team_id ON email_flows(team_id);
CREATE INDEX idx_email_flows_trigger ON email_flows(trigger_type, trigger_lead_magnet_id)
  WHERE trigger_type = 'lead_magnet';

-- ============================================
-- TABLE: email_flow_steps
-- ============================================

CREATE TABLE IF NOT EXISTS email_flow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id UUID NOT NULL REFERENCES email_flows(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  delay_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(flow_id, step_number)
);

CREATE INDEX idx_email_flow_steps_flow_id ON email_flow_steps(flow_id);

-- ============================================
-- TABLE: email_subscribers
-- ============================================

CREATE TABLE IF NOT EXISTS email_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('lead_magnet', 'manual', 'import')),
  source_id UUID,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  UNIQUE(team_id, email)
);

CREATE INDEX idx_email_subscribers_team_id ON email_subscribers(team_id);
CREATE INDEX idx_email_subscribers_team_status ON email_subscribers(team_id, status);

-- ============================================
-- TABLE: email_flow_contacts
-- ============================================

CREATE TABLE IF NOT EXISTS email_flow_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  flow_id UUID NOT NULL REFERENCES email_flows(id) ON DELETE CASCADE,
  subscriber_id UUID NOT NULL REFERENCES email_subscribers(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'unsubscribed')),
  entered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sent_at TIMESTAMPTZ,
  trigger_task_id TEXT,
  UNIQUE(flow_id, subscriber_id)
);

CREATE INDEX idx_email_flow_contacts_flow_id ON email_flow_contacts(flow_id);
CREATE INDEX idx_email_flow_contacts_subscriber_id ON email_flow_contacts(subscriber_id);

-- ============================================
-- TABLE: email_broadcasts
-- ============================================

CREATE TABLE IF NOT EXISTS email_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'failed')),
  audience_filter JSONB,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_broadcasts_team_id ON email_broadcasts(team_id);

-- ============================================
-- TRIGGERS: auto-update updated_at
-- ============================================

-- update_updated_at_column() already exists from initial_schema migration
CREATE TRIGGER update_email_flows_updated_at BEFORE UPDATE ON email_flows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_flow_steps_updated_at BEFORE UPDATE ON email_flow_steps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_broadcasts_updated_at BEFORE UPDATE ON email_broadcasts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE email_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_flow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_flow_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_broadcasts ENABLE ROW LEVEL SECURITY;

-- Helper: team ownership check via auth.uid()
-- Pattern: team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())

-- ----- email_flows -----

CREATE POLICY "Team owners can view email flows"
  ON email_flows FOR SELECT
  USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

CREATE POLICY "Team owners can insert email flows"
  ON email_flows FOR INSERT
  WITH CHECK (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

CREATE POLICY "Team owners can update email flows"
  ON email_flows FOR UPDATE
  USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

CREATE POLICY "Team owners can delete email flows"
  ON email_flows FOR DELETE
  USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

CREATE POLICY "Service role full access on email_flows"
  ON email_flows FOR ALL
  USING (auth.role() = 'service_role');

-- ----- email_flow_steps -----

CREATE POLICY "Team owners can view flow steps"
  ON email_flow_steps FOR SELECT
  USING (flow_id IN (
    SELECT id FROM email_flows
    WHERE team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
  ));

CREATE POLICY "Team owners can insert flow steps"
  ON email_flow_steps FOR INSERT
  WITH CHECK (flow_id IN (
    SELECT id FROM email_flows
    WHERE team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
  ));

CREATE POLICY "Team owners can update flow steps"
  ON email_flow_steps FOR UPDATE
  USING (flow_id IN (
    SELECT id FROM email_flows
    WHERE team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
  ));

CREATE POLICY "Team owners can delete flow steps"
  ON email_flow_steps FOR DELETE
  USING (flow_id IN (
    SELECT id FROM email_flows
    WHERE team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid())
  ));

CREATE POLICY "Service role full access on email_flow_steps"
  ON email_flow_steps FOR ALL
  USING (auth.role() = 'service_role');

-- ----- email_subscribers -----

CREATE POLICY "Team owners can view subscribers"
  ON email_subscribers FOR SELECT
  USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

CREATE POLICY "Team owners can insert subscribers"
  ON email_subscribers FOR INSERT
  WITH CHECK (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

CREATE POLICY "Team owners can update subscribers"
  ON email_subscribers FOR UPDATE
  USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

CREATE POLICY "Team owners can delete subscribers"
  ON email_subscribers FOR DELETE
  USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

CREATE POLICY "Service role full access on email_subscribers"
  ON email_subscribers FOR ALL
  USING (auth.role() = 'service_role');

-- ----- email_flow_contacts -----

CREATE POLICY "Team owners can view flow contacts"
  ON email_flow_contacts FOR SELECT
  USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

CREATE POLICY "Team owners can insert flow contacts"
  ON email_flow_contacts FOR INSERT
  WITH CHECK (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

CREATE POLICY "Team owners can update flow contacts"
  ON email_flow_contacts FOR UPDATE
  USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

CREATE POLICY "Team owners can delete flow contacts"
  ON email_flow_contacts FOR DELETE
  USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

CREATE POLICY "Service role full access on email_flow_contacts"
  ON email_flow_contacts FOR ALL
  USING (auth.role() = 'service_role');

-- ----- email_broadcasts -----

CREATE POLICY "Team owners can view broadcasts"
  ON email_broadcasts FOR SELECT
  USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

CREATE POLICY "Team owners can insert broadcasts"
  ON email_broadcasts FOR INSERT
  WITH CHECK (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

CREATE POLICY "Team owners can update broadcasts"
  ON email_broadcasts FOR UPDATE
  USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

CREATE POLICY "Team owners can delete broadcasts"
  ON email_broadcasts FOR DELETE
  USING (team_id IN (SELECT id FROM teams WHERE owner_id = auth.uid()));

CREATE POLICY "Service role full access on email_broadcasts"
  ON email_broadcasts FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- RPC: get_filtered_subscriber_count
-- ============================================

CREATE OR REPLACE FUNCTION get_filtered_subscriber_count(
  p_team_id UUID,
  p_filter JSONB DEFAULT '{}'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
  v_engagement TEXT;
  v_source TEXT;
  v_days INTEGER;
BEGIN
  v_engagement := p_filter->>'engagement';
  v_source := p_filter->>'source';

  -- Base: active subscribers for this team
  IF v_engagement IS NULL AND v_source IS NULL THEN
    SELECT count(*)::INTEGER INTO v_count
    FROM email_subscribers
    WHERE team_id = p_team_id AND status = 'active';
    RETURN v_count;
  END IF;

  -- Build filtered count
  SELECT count(DISTINCT s.id)::INTEGER INTO v_count
  FROM email_subscribers s
  WHERE s.team_id = p_team_id
    AND s.status = 'active'
    -- Source filter
    AND (
      v_source IS NULL
      OR (v_source = 'manual' AND s.source = 'manual')
      OR (v_source = 'import' AND s.source = 'import')
      OR (v_source = 'lead_magnet' AND s.source = 'lead_magnet')
      OR (
        v_source LIKE 'lead_magnet:%'
        AND s.source = 'lead_magnet'
        AND s.source_id = (substring(v_source from 13))::UUID
      )
    )
    -- Engagement filter
    AND (
      v_engagement IS NULL
      OR (
        v_engagement = 'never_opened'
        AND NOT EXISTS (
          SELECT 1 FROM email_events ee
          WHERE ee.recipient_email = s.email
            AND ee.event_type = 'opened'
        )
      )
      OR (
        v_engagement IN ('opened_30d', 'opened_60d', 'opened_90d')
        AND EXISTS (
          SELECT 1 FROM email_events ee
          WHERE ee.recipient_email = s.email
            AND ee.event_type = 'opened'
            AND ee.created_at >= now() - make_interval(days =>
              CASE v_engagement
                WHEN 'opened_30d' THEN 30
                WHEN 'opened_60d' THEN 60
                WHEN 'opened_90d' THEN 90
              END
            )
        )
      )
      OR (
        v_engagement IN ('clicked_30d', 'clicked_60d', 'clicked_90d')
        AND EXISTS (
          SELECT 1 FROM email_events ee
          WHERE ee.recipient_email = s.email
            AND ee.event_type = 'clicked'
            AND ee.created_at >= now() - make_interval(days =>
              CASE v_engagement
                WHEN 'clicked_30d' THEN 30
                WHEN 'clicked_60d' THEN 60
                WHEN 'clicked_90d' THEN 90
              END
            )
        )
      )
    );

  RETURN v_count;
END;
$$;

-- ============================================
-- RPC: get_filtered_subscribers
-- ============================================

CREATE OR REPLACE FUNCTION get_filtered_subscribers(
  p_team_id UUID,
  p_filter JSONB DEFAULT '{}'
)
RETURNS TABLE(subscriber_id UUID, email TEXT, first_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_engagement TEXT;
  v_source TEXT;
BEGIN
  v_engagement := p_filter->>'engagement';
  v_source := p_filter->>'source';

  RETURN QUERY
  SELECT DISTINCT s.id AS subscriber_id, s.email, s.first_name
  FROM email_subscribers s
  WHERE s.team_id = p_team_id
    AND s.status = 'active'
    -- Source filter
    AND (
      v_source IS NULL
      OR (v_source = 'manual' AND s.source = 'manual')
      OR (v_source = 'import' AND s.source = 'import')
      OR (v_source = 'lead_magnet' AND s.source = 'lead_magnet')
      OR (
        v_source LIKE 'lead_magnet:%'
        AND s.source = 'lead_magnet'
        AND s.source_id = (substring(v_source from 13))::UUID
      )
    )
    -- Engagement filter
    AND (
      v_engagement IS NULL
      OR (
        v_engagement = 'never_opened'
        AND NOT EXISTS (
          SELECT 1 FROM email_events ee
          WHERE ee.recipient_email = s.email
            AND ee.event_type = 'opened'
        )
      )
      OR (
        v_engagement IN ('opened_30d', 'opened_60d', 'opened_90d')
        AND EXISTS (
          SELECT 1 FROM email_events ee
          WHERE ee.recipient_email = s.email
            AND ee.event_type = 'opened'
            AND ee.created_at >= now() - make_interval(days =>
              CASE v_engagement
                WHEN 'opened_30d' THEN 30
                WHEN 'opened_60d' THEN 60
                WHEN 'opened_90d' THEN 90
              END
            )
        )
      )
      OR (
        v_engagement IN ('clicked_30d', 'clicked_60d', 'clicked_90d')
        AND EXISTS (
          SELECT 1 FROM email_events ee
          WHERE ee.recipient_email = s.email
            AND ee.event_type = 'clicked'
            AND ee.created_at >= now() - make_interval(days =>
              CASE v_engagement
                WHEN 'clicked_30d' THEN 30
                WHEN 'clicked_60d' THEN 60
                WHEN 'clicked_90d' THEN 90
              END
            )
        )
      )
    );
END;
$$;
