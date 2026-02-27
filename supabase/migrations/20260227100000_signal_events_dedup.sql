-- Make signal_events dedup index unique to prevent duplicate events
-- Drop the old non-unique index and create a unique one

DROP INDEX IF EXISTS idx_signal_events_dedup;

CREATE UNIQUE INDEX idx_signal_events_dedup
  ON signal_events(user_id, lead_id, signal_type, source_url);
