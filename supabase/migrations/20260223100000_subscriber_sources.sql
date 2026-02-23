-- Expand email_subscribers for content production system sources
-- Add new source values and metadata column

-- Drop old constraint and add expanded one
ALTER TABLE email_subscribers DROP CONSTRAINT IF EXISTS email_subscribers_source_check;
ALTER TABLE email_subscribers ADD CONSTRAINT email_subscribers_source_check
  CHECK (source IN ('lead_magnet', 'manual', 'import', 'csv_import', 'resend_import', 'positive_reply', 'purchaser', 'meeting', 'heyreach', 'plusvibe', 'gtm_sync', 'organic', 'claude-code-training'));

-- Add metadata column for extra context
ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add company column for enrichment
ALTER TABLE email_subscribers ADD COLUMN IF NOT EXISTS company TEXT;
