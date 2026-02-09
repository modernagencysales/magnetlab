-- Add wizard auto-save columns to extraction_sessions
-- wizard_state: full WizardState JSONB for restoring the wizard
-- draft_title: display name derived from selected concept

ALTER TABLE extraction_sessions ADD COLUMN IF NOT EXISTS wizard_state JSONB DEFAULT '{}';
ALTER TABLE extraction_sessions ADD COLUMN IF NOT EXISTS draft_title TEXT;
