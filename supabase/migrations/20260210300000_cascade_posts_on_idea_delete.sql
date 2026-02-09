-- Fix: orphaned pipeline posts when idea deleted
-- Change from SET NULL to CASCADE so posts are removed with their idea

ALTER TABLE cp_pipeline_posts
  DROP CONSTRAINT IF EXISTS cp_pipeline_posts_idea_id_fkey;

ALTER TABLE cp_pipeline_posts
  ADD CONSTRAINT cp_pipeline_posts_idea_id_fkey
  FOREIGN KEY (idea_id) REFERENCES cp_content_ideas(id)
  ON DELETE CASCADE;
