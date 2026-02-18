-- Playbook sync tables for the living wiki system

-- Cached SOP embeddings for semantic matching
CREATE TABLE IF NOT EXISTS cp_sop_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL UNIQUE,
  content_hash TEXT NOT NULL,
  embedding vector(1536),
  title TEXT,
  module TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cp_sop_embeddings_path ON cp_sop_embeddings(file_path);
CREATE INDEX IF NOT EXISTS idx_cp_sop_embeddings_vec ON cp_sop_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- Run log for each weekly sync
CREATE TABLE IF NOT EXISTS cp_playbook_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  entries_processed INT NOT NULL DEFAULT 0,
  entries_enriched INT NOT NULL DEFAULT 0,
  entries_redundant INT NOT NULL DEFAULT 0,
  entries_orphaned INT NOT NULL DEFAULT 0,
  sops_enriched TEXT[] DEFAULT '{}',
  sops_created TEXT[] DEFAULT '{}',
  commit_sha TEXT,
  commit_message TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed')),
  error_log TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Audit trail: which knowledge entry matched which SOP
CREATE TABLE IF NOT EXISTS cp_knowledge_sop_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_entry_id UUID NOT NULL REFERENCES cp_knowledge_entries(id) ON DELETE CASCADE,
  sop_file_path TEXT,
  similarity_score FLOAT,
  action TEXT NOT NULL CHECK (action IN ('enrich', 'redundant', 'tangential', 'orphaned', 'new_sop')),
  edit_summary TEXT,
  sync_run_id UUID NOT NULL REFERENCES cp_playbook_sync_runs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cp_ksm_sync_run ON cp_knowledge_sop_matches(sync_run_id);
CREATE INDEX IF NOT EXISTS idx_cp_ksm_knowledge ON cp_knowledge_sop_matches(knowledge_entry_id);

-- RPC: match knowledge entries against SOP embeddings
CREATE OR REPLACE FUNCTION cp_match_sop_embeddings(
  query_embedding TEXT,
  threshold FLOAT DEFAULT 0.6,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  file_path TEXT,
  title TEXT,
  module TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  parsed_embedding vector(1536);
BEGIN
  parsed_embedding := query_embedding::vector(1536);
  RETURN QUERY
  SELECT
    se.file_path,
    se.title,
    se.module,
    (1 - (se.embedding <=> parsed_embedding))::FLOAT AS similarity
  FROM cp_sop_embeddings se
  WHERE se.embedding IS NOT NULL
    AND (1 - (se.embedding <=> parsed_embedding)) > threshold
  ORDER BY se.embedding <=> parsed_embedding
  LIMIT match_count;
END;
$$;
