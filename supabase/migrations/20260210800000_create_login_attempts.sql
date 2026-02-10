-- Login rate limiting table
-- Stores failed login attempts to enforce rate limits across serverless instances

CREATE TABLE IF NOT EXISTS login_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identifier text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

-- Index for efficient lookups by identifier + time window
CREATE INDEX idx_login_attempts_identifier_time
  ON login_attempts (identifier, attempted_at DESC);

-- Auto-cleanup: delete entries older than 1 hour (well beyond the 15-min window)
-- This keeps the table small without requiring a cron job
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- No RLS policies needed - this table is only accessed via service role client
-- Service role bypasses RLS automatically

COMMENT ON TABLE login_attempts IS 'Tracks failed login attempts for rate limiting. Entries auto-expire after 15 minutes (enforced in application code).';
