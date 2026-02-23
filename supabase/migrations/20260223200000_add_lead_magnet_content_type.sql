-- Add 'lead_magnet' to cp_content_ideas.content_type check constraint
-- Required for Phase 7: Weekly Lead Magnet Pipeline

-- Drop the existing check constraint and re-create with 'lead_magnet' included
ALTER TABLE cp_content_ideas DROP CONSTRAINT IF EXISTS cp_content_ideas_content_type_check;
ALTER TABLE cp_content_ideas ADD CONSTRAINT cp_content_ideas_content_type_check
  CHECK (content_type IN ('story', 'insight', 'tip', 'framework', 'case_study', 'question', 'listicle', 'contrarian', 'lead_magnet'));
