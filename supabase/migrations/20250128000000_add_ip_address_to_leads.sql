-- Add IP address column to funnel_leads for rate limiting
-- This enables serverless-compatible rate limiting using database queries

ALTER TABLE funnel_leads ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Index for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_funnel_leads_ip_created
ON funnel_leads(ip_address, created_at DESC);

-- Comment explaining purpose
COMMENT ON COLUMN funnel_leads.ip_address IS 'Client IP address for rate limiting and fraud detection';
