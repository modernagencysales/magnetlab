-- Knowledge entry CRUD support: tag decrement function + default browse fix
-- Phase 1 of Tim's Knowledge Section feature requests

-- Decrement tag usage count (matching cp_increment_tag_count pattern)
-- Cleans up zero-count tags automatically
CREATE OR REPLACE FUNCTION cp_decrement_tag_count(
  p_user_id UUID,
  p_tag_name TEXT,
  p_count INTEGER DEFAULT 1
)
RETURNS void AS $$
BEGIN
  UPDATE cp_knowledge_tags
  SET usage_count = GREATEST(0, usage_count - p_count)
  WHERE user_id = p_user_id AND tag_name = p_tag_name;

  -- Clean up zero-count tags
  DELETE FROM cp_knowledge_tags
  WHERE user_id = p_user_id AND tag_name = p_tag_name AND usage_count <= 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
