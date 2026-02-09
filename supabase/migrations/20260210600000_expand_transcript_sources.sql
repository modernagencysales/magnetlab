-- Allow any source value for transcripts (not just grain/fireflies/paste)
-- Enables universal webhook for Fathom, Otter, Granola, Clarify, etc.
ALTER TABLE cp_call_transcripts DROP CONSTRAINT IF EXISTS cp_call_transcripts_source_check;
