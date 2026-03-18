-- Lead Magnet Post Automation — Schema Extensions
-- Adds account_safety_settings table and extends post_campaigns, post_campaign_leads,
-- linkedin_daily_limits, signal_events, signal_leads, and cp_pipeline_posts.

-- ─── account_safety_settings ───────────────────────────────────────────────

CREATE TABLE account_safety_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unipile_account_id text NOT NULL,
  operating_hours_start time NOT NULL DEFAULT '08:00',
  operating_hours_end time NOT NULL DEFAULT '19:00',
  timezone text NOT NULL DEFAULT 'America/New_York',
  max_dms_per_day integer NOT NULL DEFAULT 50,
  max_connection_requests_per_day integer NOT NULL DEFAULT 10,
  max_connection_accepts_per_day integer NOT NULL DEFAULT 80,
  max_comments_per_day integer NOT NULL DEFAULT 30,
  max_likes_per_day integer NOT NULL DEFAULT 60,
  min_action_delay_ms integer NOT NULL DEFAULT 45000,
  max_action_delay_ms integer NOT NULL DEFAULT 210000,
  account_connected_at timestamptz,
  circuit_breaker_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, unipile_account_id)
);

ALTER TABLE account_safety_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own account settings"
  ON account_safety_settings FOR ALL USING (user_id = auth.uid());

-- ─── post_campaigns extensions ─────────────────────────────────────────────

ALTER TABLE post_campaigns
  ADD COLUMN IF NOT EXISTS reply_template text,
  ADD COLUMN IF NOT EXISTS poster_account_id text,
  ADD COLUMN IF NOT EXISTS target_locations text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS lead_expiry_days integer NOT NULL DEFAULT 7;

-- ─── post_campaign_leads extensions ────────────────────────────────────────

ALTER TABLE post_campaign_leads
  ADD COLUMN IF NOT EXISTS match_type text DEFAULT 'keyword' CHECK (match_type IN ('keyword', 'intent')),
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS liked_at timestamptz,
  ADD COLUMN IF NOT EXISTS replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS connection_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz;

-- Drop and recreate status constraint to include 'expired'
ALTER TABLE post_campaign_leads
  DROP CONSTRAINT IF EXISTS post_campaign_leads_status_check;

ALTER TABLE post_campaign_leads
  ADD CONSTRAINT post_campaign_leads_status_check
    CHECK (status IN ('detected', 'connection_pending', 'connection_accepted',
                      'dm_queued', 'dm_sent', 'dm_failed', 'skipped', 'expired'));

-- ─── linkedin_daily_limits extensions ──────────────────────────────────────

ALTER TABLE linkedin_daily_limits
  ADD COLUMN IF NOT EXISTS comments_sent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS likes_sent integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS connection_requests_sent integer NOT NULL DEFAULT 0;

-- Update increment_daily_limit to support the new fields
CREATE OR REPLACE FUNCTION increment_daily_limit(
  p_account_id text,
  p_date date,
  p_field text
) RETURNS void AS $$
BEGIN
  IF p_field NOT IN ('dms_sent', 'connections_accepted', 'connection_requests_sent', 'comments_sent', 'likes_sent') THEN
    RAISE EXCEPTION 'Invalid field: %', p_field;
  END IF;
  UPDATE linkedin_daily_limits
  SET dms_sent = CASE WHEN p_field = 'dms_sent' THEN dms_sent + 1 ELSE dms_sent END,
      connections_accepted = CASE WHEN p_field = 'connections_accepted' THEN connections_accepted + 1 ELSE connections_accepted END,
      connection_requests_sent = CASE WHEN p_field = 'connection_requests_sent' THEN connection_requests_sent + 1 ELSE connection_requests_sent END,
      comments_sent = CASE WHEN p_field = 'comments_sent' THEN comments_sent + 1 ELSE comments_sent END,
      likes_sent = CASE WHEN p_field = 'likes_sent' THEN likes_sent + 1 ELSE likes_sent END
  WHERE unipile_account_id = p_account_id AND date = p_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── signal_events extensions ──────────────────────────────────────────────

ALTER TABLE signal_events
  ADD COLUMN IF NOT EXISTS comment_social_id text;

-- ─── signal_leads extensions ───────────────────────────────────────────────

ALTER TABLE signal_leads
  ADD COLUMN IF NOT EXISTS provider_id text;

-- ─── cp_pipeline_posts extensions ──────────────────────────────────────────

ALTER TABLE cp_pipeline_posts
  ADD COLUMN IF NOT EXISTS is_lead_magnet_post boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS image_storage_path text;
