-- Simplify pricing: remove pro tier, keep free + unlimited ($100/mo)
-- Add missing plan and status columns to subscriptions table

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- Migrate any existing 'pro' users to 'unlimited'
UPDATE subscriptions SET plan = 'unlimited' WHERE plan = 'pro';

-- Recreate check_usage_limit without enum dependency, with simplified tiers
DROP FUNCTION IF EXISTS check_usage_limit(UUID, TEXT);
CREATE OR REPLACE FUNCTION check_usage_limit(p_user_id UUID, p_limit_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_plan TEXT;
  v_current_usage INTEGER;
  v_limit INTEGER;
  v_month_year TEXT;
BEGIN
  SELECT plan INTO v_plan FROM subscriptions WHERE user_id = p_user_id;
  IF v_plan IS NULL THEN v_plan := 'free'; END IF;

  v_month_year := TO_CHAR(NOW(), 'YYYY-MM');

  SELECT
    CASE p_limit_type
      WHEN 'lead_magnets' THEN lead_magnets_created
      WHEN 'posts' THEN posts_scheduled
    END
  INTO v_current_usage
  FROM usage_tracking
  WHERE user_id = p_user_id AND month_year = v_month_year;

  IF v_current_usage IS NULL THEN v_current_usage := 0; END IF;

  IF v_plan = 'free' THEN
    v_limit := CASE p_limit_type WHEN 'lead_magnets' THEN 2 WHEN 'posts' THEN 0 END;
  ELSE
    v_limit := 999999;
  END IF;

  RETURN v_current_usage < v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
