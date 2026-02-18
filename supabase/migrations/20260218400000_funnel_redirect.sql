-- Add external redirect support to funnel pages
ALTER TABLE funnel_pages
  ADD COLUMN redirect_trigger TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN redirect_url TEXT,
  ADD COLUMN redirect_fail_url TEXT;

-- Validate redirect_trigger values
ALTER TABLE funnel_pages
  ADD CONSTRAINT funnel_pages_redirect_trigger_check
  CHECK (redirect_trigger IN ('none', 'immediate', 'after_qualification'));

COMMENT ON COLUMN funnel_pages.redirect_trigger IS 'none = use built-in thank-you page, immediate = redirect right after opt-in, after_qualification = redirect after survey';
COMMENT ON COLUMN funnel_pages.redirect_url IS 'External redirect URL (immediate mode or qualified-lead URL in after_qualification mode)';
COMMENT ON COLUMN funnel_pages.redirect_fail_url IS 'Redirect URL for unqualified leads (only used when redirect_trigger = after_qualification)';
