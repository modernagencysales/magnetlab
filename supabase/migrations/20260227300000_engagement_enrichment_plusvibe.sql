-- Add PlusVibe and opt-in URL columns to linkedin_automations
ALTER TABLE linkedin_automations
  ADD COLUMN IF NOT EXISTS plusvibe_campaign_id text,
  ADD COLUMN IF NOT EXISTS opt_in_url text;

-- Create engagement_enrichments table
CREATE TABLE IF NOT EXISTS engagement_enrichments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  automation_id uuid NOT NULL REFERENCES linkedin_automations(id) ON DELETE CASCADE,
  linkedin_url text NOT NULL,
  first_name text,
  last_name text,
  headline text,
  company text,
  email text,
  email_provider text,
  email_validation_status text,
  plusvibe_campaign_id text,
  plusvibe_pushed_at timestamptz,
  plusvibe_error text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, automation_id, linkedin_url)
);

-- RLS
ALTER TABLE engagement_enrichments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_enrichments" ON engagement_enrichments
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "service_role_bypass_enrichments" ON engagement_enrichments
  FOR ALL USING (current_setting('role') = 'service_role');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_engagement_enrichments_automation ON engagement_enrichments(automation_id);
CREATE INDEX IF NOT EXISTS idx_engagement_enrichments_status ON engagement_enrichments(status);
CREATE INDEX IF NOT EXISTS idx_engagement_enrichments_user ON engagement_enrichments(user_id);
