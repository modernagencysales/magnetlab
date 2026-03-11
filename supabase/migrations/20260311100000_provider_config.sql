-- Provider configuration per user per capability
CREATE TABLE IF NOT EXISTS provider_configs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  capability text NOT NULL,
  provider_id text NOT NULL,
  integration_tier text NOT NULL DEFAULT 'guided',
  api_key_encrypted text,
  config jsonb DEFAULT '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT uq_provider_config_user_capability UNIQUE (user_id, capability)
);

CREATE INDEX IF NOT EXISTS idx_provider_configs_user_id ON provider_configs(user_id);

ALTER TABLE provider_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to provider_configs"
  ON provider_configs FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users read own provider_configs"
  ON provider_configs FOR SELECT
  USING (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_provider_configs
  BEFORE UPDATE ON provider_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
