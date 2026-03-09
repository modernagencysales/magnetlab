-- Add source column to cp_edit_history for tracking copilot-generated content edits
ALTER TABLE cp_edit_history ADD COLUMN IF NOT EXISTS source TEXT;
