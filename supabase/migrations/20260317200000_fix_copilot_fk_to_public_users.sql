-- Fix: copilot tables reference auth.users(id) instead of public.users(id)
-- NextAuth user IDs are in public.users, not auth.users

ALTER TABLE copilot_conversations DROP CONSTRAINT copilot_conversations_user_id_fkey;
ALTER TABLE copilot_conversations ADD CONSTRAINT copilot_conversations_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE copilot_memories DROP CONSTRAINT copilot_memories_user_id_fkey;
ALTER TABLE copilot_memories ADD CONSTRAINT copilot_memories_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
