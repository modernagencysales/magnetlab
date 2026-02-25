-- Remove restrictive transcript_type CHECK constraints on cp_knowledge_entries and cp_call_transcripts
-- to support external knowledge ingestion (DFY pipeline, Blueprint analysis, posts, etc.)
-- The column is used for flexible source labeling — runtime validation is in the API code.

-- Drop the old restrictive constraints
ALTER TABLE cp_knowledge_entries
  DROP CONSTRAINT IF EXISTS cp_knowledge_entries_transcript_type_check;

ALTER TABLE cp_call_transcripts
  DROP CONSTRAINT IF EXISTS cp_call_transcripts_transcript_type_check;

-- Allow knowledge entries without a transcript (e.g., Blueprint analysis, external push)
ALTER TABLE cp_knowledge_entries ALTER COLUMN transcript_id DROP NOT NULL;
