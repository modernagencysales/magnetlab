-- Fix: All cp_ tables had FK referencing auth.users(id) instead of public.users(id)
-- MagnetLab uses NextAuth with a custom public.users table, not Supabase Auth.
-- This caused FK violations on every insert (e.g. "Failed to save transcript").

ALTER TABLE cp_call_transcripts DROP CONSTRAINT cp_call_transcripts_user_id_fkey;
ALTER TABLE cp_call_transcripts ADD CONSTRAINT cp_call_transcripts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE cp_content_ideas DROP CONSTRAINT cp_content_ideas_user_id_fkey;
ALTER TABLE cp_content_ideas ADD CONSTRAINT cp_content_ideas_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE cp_knowledge_entries DROP CONSTRAINT cp_knowledge_entries_user_id_fkey;
ALTER TABLE cp_knowledge_entries ADD CONSTRAINT cp_knowledge_entries_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE cp_knowledge_tags DROP CONSTRAINT cp_knowledge_tags_user_id_fkey;
ALTER TABLE cp_knowledge_tags ADD CONSTRAINT cp_knowledge_tags_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE cp_pipeline_posts DROP CONSTRAINT cp_pipeline_posts_user_id_fkey;
ALTER TABLE cp_pipeline_posts ADD CONSTRAINT cp_pipeline_posts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE cp_post_templates DROP CONSTRAINT cp_post_templates_user_id_fkey;
ALTER TABLE cp_post_templates ADD CONSTRAINT cp_post_templates_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE cp_posting_slots DROP CONSTRAINT cp_posting_slots_user_id_fkey;
ALTER TABLE cp_posting_slots ADD CONSTRAINT cp_posting_slots_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE cp_tag_clusters DROP CONSTRAINT cp_tag_clusters_user_id_fkey;
ALTER TABLE cp_tag_clusters ADD CONSTRAINT cp_tag_clusters_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE cp_writing_styles DROP CONSTRAINT cp_writing_styles_user_id_fkey;
ALTER TABLE cp_writing_styles ADD CONSTRAINT cp_writing_styles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
