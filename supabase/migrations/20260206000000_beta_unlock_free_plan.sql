-- Beta unlock: remove all plan limits so free users have full access
-- To revert after beta, restore the limits from 20260201020000_simplify_pricing_tiers.sql

CREATE OR REPLACE FUNCTION check_usage_limit(p_user_id UUID, p_limit_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_usage INTEGER;
  v_month_year TEXT;
BEGIN
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

  -- Beta: all plans get unlimited access
  RETURN v_current_usage < 999999;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
