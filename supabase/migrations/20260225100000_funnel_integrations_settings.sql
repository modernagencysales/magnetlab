-- Add settings JSONB column to funnel_integrations for CRM integration config
ALTER TABLE funnel_integrations ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT NULL;

-- Expand provider CHECK constraint to include gohighlevel
ALTER TABLE funnel_integrations DROP CONSTRAINT IF EXISTS funnel_integrations_provider_check;
ALTER TABLE funnel_integrations ADD CONSTRAINT funnel_integrations_provider_check
  CHECK (provider IN ('kit', 'mailerlite', 'mailchimp', 'activecampaign', 'gohighlevel'));
