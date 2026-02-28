-- Add LinkedIn URL and HeyReach delivery status to funnel_leads
ALTER TABLE funnel_leads
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS heyreach_delivery_status TEXT;

-- Update funnel_integrations provider constraint to include heyreach
DO $$
BEGIN
  BEGIN
    ALTER TABLE funnel_integrations DROP CONSTRAINT IF EXISTS funnel_integrations_provider_check;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END $$;

ALTER TABLE funnel_integrations
  ADD CONSTRAINT funnel_integrations_provider_check
  CHECK (provider IN ('kit', 'mailerlite', 'mailchimp', 'activecampaign', 'gohighlevel', 'heyreach'));

-- Index for delivery status queries
CREATE INDEX IF NOT EXISTS idx_funnel_leads_heyreach_status
  ON funnel_leads (heyreach_delivery_status)
  WHERE heyreach_delivery_status IS NOT NULL;
