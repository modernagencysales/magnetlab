-- Survey Questions Migration
-- Transforms qualification_questions from yes/no-only to multi-type survey system

-- ============================================
-- ADD NEW COLUMNS
-- ============================================

-- Answer type: what kind of input the question uses
ALTER TABLE qualification_questions
ADD COLUMN IF NOT EXISTS answer_type TEXT NOT NULL DEFAULT 'yes_no'
  CHECK (answer_type IN ('yes_no', 'text', 'textarea', 'multiple_choice'));

-- Options for multiple_choice questions (JSON array of strings)
ALTER TABLE qualification_questions
ADD COLUMN IF NOT EXISTS options JSONB DEFAULT NULL;

-- Placeholder text for text/textarea inputs
ALTER TABLE qualification_questions
ADD COLUMN IF NOT EXISTS placeholder TEXT DEFAULT NULL;

-- Whether this question affects qualification (false = data-collection only)
ALTER TABLE qualification_questions
ADD COLUMN IF NOT EXISTS is_qualifying BOOLEAN NOT NULL DEFAULT true;

-- Whether the question must be answered to proceed
ALTER TABLE qualification_questions
ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT true;

-- ============================================
-- CHANGE qualifying_answer FROM TEXT TO JSONB
-- ============================================

-- Drop the old CHECK constraint
ALTER TABLE qualification_questions
DROP CONSTRAINT IF EXISTS qualification_questions_qualifying_answer_check;

-- Convert existing text values to JSONB strings (e.g. 'yes' -> '"yes"')
ALTER TABLE qualification_questions
ALTER COLUMN qualifying_answer TYPE JSONB
USING to_jsonb(qualifying_answer);

-- Allow NULL for non-qualifying questions
ALTER TABLE qualification_questions
ALTER COLUMN qualifying_answer DROP NOT NULL;
