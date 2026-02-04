-- Add user-level theme defaults
-- New funnel pages inherit these values when no theme is specified
ALTER TABLE users
  ADD COLUMN default_theme TEXT DEFAULT 'dark'
    CHECK (default_theme IN ('dark', 'light', 'custom')),
  ADD COLUMN default_primary_color TEXT DEFAULT '#8b5cf6',
  ADD COLUMN default_background_style TEXT DEFAULT 'solid'
    CHECK (default_background_style IN ('solid', 'gradient', 'pattern')),
  ADD COLUMN default_logo_url TEXT;
