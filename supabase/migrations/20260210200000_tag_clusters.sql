-- Tag clusters: higher-level grouping for related knowledge tags
-- Automatically created by AI analysis of tag relationships

CREATE TABLE cp_tag_clusters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX idx_cp_tag_clusters_user ON cp_tag_clusters(user_id);

ALTER TABLE cp_knowledge_tags ADD COLUMN cluster_id UUID REFERENCES cp_tag_clusters(id) ON DELETE SET NULL;
CREATE INDEX idx_cp_knowledge_tags_cluster ON cp_knowledge_tags(cluster_id);
