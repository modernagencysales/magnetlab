-- Allow funnel leads without a lead magnet (e.g. library/external-resource pages)
ALTER TABLE funnel_leads ALTER COLUMN lead_magnet_id DROP NOT NULL;
