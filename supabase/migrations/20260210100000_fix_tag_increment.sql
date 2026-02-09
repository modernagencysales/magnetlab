-- Fix: tag usage_count was being OVERWRITTEN by upsert instead of incremented
-- This RPC atomically increments the count, avoiding race conditions

CREATE OR REPLACE FUNCTION cp_increment_tag_count(
  p_user_id UUID,
  p_tag_name TEXT,
  p_count INTEGER DEFAULT 1
)
RETURNS void AS $$
BEGIN
  INSERT INTO cp_knowledge_tags (user_id, tag_name, usage_count)
  VALUES (p_user_id, p_tag_name, p_count)
  ON CONFLICT (user_id, tag_name)
  DO UPDATE SET usage_count = cp_knowledge_tags.usage_count + EXCLUDED.usage_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
