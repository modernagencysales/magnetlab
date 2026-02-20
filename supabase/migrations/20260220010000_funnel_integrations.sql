-- funnel_integrations: per-funnel email marketing provider mappings
-- Stores which ESP list/tag a funnel sends leads to

CREATE TABLE IF NOT EXISTS funnel_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_page_id UUID NOT NULL REFERENCES funnel_pages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('kit', 'mailerlite', 'mailchimp', 'activecampaign')),
  list_id TEXT NOT NULL,
  list_name TEXT,
  tag_id TEXT,
  tag_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(funnel_page_id, provider)
);

-- Row Level Security
ALTER TABLE funnel_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own funnel integrations"
  ON funnel_integrations FOR ALL
  USING (user_id = auth.uid());

-- Partial index: only active integrations per funnel page
CREATE INDEX idx_funnel_integrations_page_active
  ON funnel_integrations(funnel_page_id)
  WHERE is_active = true;

-- Auto-update updated_at timestamp
-- Reuses update_updated_at_column() from initial schema migration
CREATE TRIGGER update_funnel_integrations_updated_at
  BEFORE UPDATE ON funnel_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
