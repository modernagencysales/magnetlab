-- Add review_data JSONB column to cp_pipeline_posts
-- Stores AI content review results for the DFY onboarding pipeline

ALTER TABLE cp_pipeline_posts
  ADD COLUMN review_data jsonb DEFAULT NULL;

COMMENT ON COLUMN cp_pipeline_posts.review_data IS
  'AI content review results. Schema: {
    "review_score": number (0-10),
    "review_category": "excellent" | "good_with_edits" | "needs_rewrite" | "delete",
    "review_notes": string[] (edit suggestions),
    "consistency_flags": string[] (cross-post issues),
    "reviewed_at": ISO 8601 timestamp
  }';

-- Partial GIN index on review_category for filtering reviewed posts by category.
-- Only indexes rows that have been reviewed (review_data IS NOT NULL).
CREATE INDEX idx_cp_pipeline_posts_review_category
  ON cp_pipeline_posts USING btree ((review_data->>'review_category'))
  WHERE review_data IS NOT NULL;
