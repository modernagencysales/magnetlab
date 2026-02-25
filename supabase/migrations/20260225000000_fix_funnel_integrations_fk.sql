-- Fix: funnel_integrations and 8 other tables reference auth.users(id) instead
-- of public.users(id). MagnetLab uses NextAuth — user IDs live in public.users.
-- This causes FK violations on insert (e.g. "Failed to save funnel integration").
-- Same class of bug fixed in 20260210400000_fix_cp_fk_to_public_users.sql.

-- funnel_integrations (MOD-309: the reported bug)
ALTER TABLE funnel_integrations DROP CONSTRAINT funnel_integrations_user_id_fkey;
ALTER TABLE funnel_integrations ADD CONSTRAINT funnel_integrations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- cp_post_performance
ALTER TABLE cp_post_performance DROP CONSTRAINT cp_post_performance_user_id_fkey;
ALTER TABLE cp_post_performance ADD CONSTRAINT cp_post_performance_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- cp_performance_patterns
ALTER TABLE cp_performance_patterns DROP CONSTRAINT cp_performance_patterns_user_id_fkey;
ALTER TABLE cp_performance_patterns ADD CONSTRAINT cp_performance_patterns_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- cp_inspiration_sources
ALTER TABLE cp_inspiration_sources DROP CONSTRAINT cp_inspiration_sources_user_id_fkey;
ALTER TABLE cp_inspiration_sources ADD CONSTRAINT cp_inspiration_sources_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- cp_inspiration_pulls
ALTER TABLE cp_inspiration_pulls DROP CONSTRAINT cp_inspiration_pulls_user_id_fkey;
ALTER TABLE cp_inspiration_pulls ADD CONSTRAINT cp_inspiration_pulls_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- cp_post_engagements
ALTER TABLE cp_post_engagements DROP CONSTRAINT cp_post_engagements_user_id_fkey;
ALTER TABLE cp_post_engagements ADD CONSTRAINT cp_post_engagements_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- linkedin_automations
ALTER TABLE linkedin_automations DROP CONSTRAINT linkedin_automations_user_id_fkey;
ALTER TABLE linkedin_automations ADD CONSTRAINT linkedin_automations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- cp_monitored_competitors
ALTER TABLE cp_monitored_competitors DROP CONSTRAINT cp_monitored_competitors_user_id_fkey;
ALTER TABLE cp_monitored_competitors ADD CONSTRAINT cp_monitored_competitors_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- cp_knowledge_topics
ALTER TABLE cp_knowledge_topics DROP CONSTRAINT cp_knowledge_topics_user_id_fkey;
ALTER TABLE cp_knowledge_topics ADD CONSTRAINT cp_knowledge_topics_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
