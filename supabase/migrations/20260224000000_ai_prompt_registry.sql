-- AI Prompt Registry tables + super-admin flag

-- Super-admin flag on users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT false;

-- Prompt templates
CREATE TABLE ai_prompt_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL DEFAULT '',
  user_prompt TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  temperature FLOAT NOT NULL DEFAULT 1.0,
  max_tokens INTEGER NOT NULL DEFAULT 4000,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Version history (snapshot on every save)
CREATE TABLE ai_prompt_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id UUID NOT NULL REFERENCES ai_prompt_templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  system_prompt TEXT NOT NULL DEFAULT '',
  user_prompt TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  temperature FLOAT NOT NULL DEFAULT 1.0,
  max_tokens INTEGER NOT NULL DEFAULT 4000,
  change_note TEXT,
  changed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(prompt_id, version)
);

-- Indexes
CREATE INDEX idx_ai_prompt_templates_slug ON ai_prompt_templates(slug);
CREATE INDEX idx_ai_prompt_templates_category ON ai_prompt_templates(category);
CREATE INDEX idx_ai_prompt_versions_prompt_id ON ai_prompt_versions(prompt_id);
CREATE INDEX idx_ai_prompt_versions_prompt_version ON ai_prompt_versions(prompt_id, version DESC);

-- No RLS — these are admin-only tables, protected at the route level
