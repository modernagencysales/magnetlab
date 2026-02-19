-- Speaker company identification
-- Adds speaker_map jsonb to transcripts for mapping speaker names to roles/companies
-- Adds speaker_company to knowledge entries for attribution

ALTER TABLE cp_call_transcripts ADD COLUMN IF NOT EXISTS speaker_map JSONB DEFAULT NULL;

ALTER TABLE cp_knowledge_entries ADD COLUMN IF NOT EXISTS speaker_company TEXT DEFAULT NULL;
