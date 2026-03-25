-- Edit capture: move from per-save to approval-time
-- Store AI original so we always have a baseline for diffs.
-- Track who approved the final version.

-- 1. Store original AI-generated content on posts (immutable after creation)
ALTER TABLE cp_pipeline_posts
  ADD COLUMN IF NOT EXISTS ai_original_content TEXT;

-- Backfill: for existing posts that haven't been edited, ai_original_content = draft_content
-- For edited posts, we can't recover the original (it was overwritten), so leave NULL.
UPDATE cp_pipeline_posts
SET ai_original_content = draft_content
WHERE edited_at IS NULL AND ai_original_content IS NULL;

-- 2. Track who approved the edit (the person whose judgment is the training signal)
ALTER TABLE cp_edit_history
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- 3. Index for finding edits by approver (for per-approver style guides)
CREATE INDEX IF NOT EXISTS idx_cp_edit_history_approved_by ON cp_edit_history(approved_by);
