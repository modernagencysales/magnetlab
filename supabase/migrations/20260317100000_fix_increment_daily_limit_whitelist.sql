-- Fix C2: Replace dynamic SQL with CASE statement in SECURITY DEFINER RPC.
-- The original increment_daily_limit used format('%I') which accepts arbitrary
-- column names — a SQL injection vector since this is SECURITY DEFINER.

CREATE OR REPLACE FUNCTION increment_daily_limit(
  p_account_id text,
  p_date date,
  p_field text
) RETURNS void AS $$
BEGIN
  IF p_field NOT IN ('dms_sent', 'connections_accepted', 'connection_requests_sent') THEN
    RAISE EXCEPTION 'Invalid field: %', p_field;
  END IF;
  UPDATE linkedin_daily_limits
  SET dms_sent = CASE WHEN p_field = 'dms_sent' THEN dms_sent + 1 ELSE dms_sent END,
      connections_accepted = CASE WHEN p_field = 'connections_accepted' THEN connections_accepted + 1 ELSE connections_accepted END,
      connection_requests_sent = CASE WHEN p_field = 'connection_requests_sent' THEN connection_requests_sent + 1 ELSE connection_requests_sent END
  WHERE unipile_account_id = p_account_id AND date = p_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
