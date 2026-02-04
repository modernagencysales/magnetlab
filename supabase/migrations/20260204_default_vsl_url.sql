-- Add default video URL for thank you pages
-- New funnel pages inherit this value when no video URL is specified
ALTER TABLE users
  ADD COLUMN default_vsl_url TEXT;
