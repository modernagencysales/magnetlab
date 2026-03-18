-- Add image_storage_path column to cp_pipeline_posts
-- Stores the Supabase Storage path for uploaded post images
-- (e.g., 'post-images/{user_id}/{post_id}/image.png')
ALTER TABLE cp_pipeline_posts
  ADD COLUMN IF NOT EXISTS image_storage_path text;

-- SETUP REQUIREMENT: Create "post-images" Supabase Storage bucket via dashboard
-- Bucket config:
--   Name: post-images
--   Public: true (images need to be viewable in published posts)
--   File size limit: 10MB
--   Allowed MIME types: image/png, image/jpeg, image/jpg, image/webp, image/gif
-- RLS policies:
--   INSERT: authenticated users only (auth.role() = 'authenticated')
--   SELECT: public (anon + authenticated)
--   UPDATE: authenticated users, own files only
--   DELETE: authenticated users, own files only
