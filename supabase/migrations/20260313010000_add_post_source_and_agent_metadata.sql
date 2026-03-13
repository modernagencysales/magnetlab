-- Add source and agent_metadata columns to cp_pipeline_posts
-- Supports MCP v2 agent-authored posts (source = 'agent')
-- agent_metadata stores pillar, content_type, title provided by the agent

ALTER TABLE cp_pipeline_posts
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS agent_metadata JSONB;

COMMENT ON COLUMN cp_pipeline_posts.source IS 'Origin of the post: agent (MCP v2), autopilot, imported, or NULL for AI-generated via write-post.';
COMMENT ON COLUMN cp_pipeline_posts.agent_metadata IS 'Agent-provided metadata: {title, pillar, content_type}. Only populated when source = ''agent''.';
