-- Fix cp_edit_history.auto_classified_changes default
-- Change from '{}' to NULL so we can distinguish:
--   NULL = not yet classified
--   { "patterns": [] } = classified, no patterns found
--   { "patterns": [...] } = classified with patterns

ALTER TABLE cp_edit_history
  ALTER COLUMN auto_classified_changes SET DEFAULT NULL;

-- Mark existing unclassified records (still have the '{}' default) as NULL
-- so they get picked up by the backfill
UPDATE cp_edit_history
SET auto_classified_changes = NULL
WHERE auto_classified_changes = '{}'::jsonb;
