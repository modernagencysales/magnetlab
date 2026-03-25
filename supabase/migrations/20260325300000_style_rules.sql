-- Style rules table for the global style learning pipeline
-- Stores individual rules (proposed/approved/rejected) derived from edit patterns.
-- Approved rules are compiled into ai_prompt_templates row 'global-style-rules'.

CREATE TABLE cp_style_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN ('global', 'team')),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  pattern_name TEXT NOT NULL,
  rule_text TEXT NOT NULL,
  source_edit_ids UUID[] DEFAULT '{}',
  frequency INT NOT NULL DEFAULT 1,
  confidence NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'rejected')),
  proposed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (scope = 'global' AND team_id IS NULL) OR
    (scope = 'team' AND team_id IS NOT NULL)
  )
);

ALTER TABLE cp_style_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on cp_style_rules"
  ON cp_style_rules FOR ALL
  USING (auth.role() = 'service_role');

CREATE INDEX idx_cp_style_rules_scope_status ON cp_style_rules(scope, status);
CREATE INDEX idx_cp_style_rules_pattern ON cp_style_rules(pattern_name);

-- Seed the prompt template row (empty — will be populated when rules are approved)
INSERT INTO ai_prompt_templates (slug, name, category, description, system_prompt, user_prompt, model, temperature, max_tokens, variables, is_active)
VALUES (
  'global-style-rules',
  'Global Style Rules',
  'learning',
  'Compiled global style rules derived from human edit patterns. Auto-populated by the style learning pipeline.',
  '',
  '',
  'claude-haiku-4-5-20251001',
  0,
  0,
  '[]'::jsonb,
  true
)
ON CONFLICT (slug) DO NOTHING;

-- Seed the rule drafter prompt template
INSERT INTO ai_prompt_templates (slug, name, category, description, system_prompt, user_prompt, model, temperature, max_tokens, variables, is_active)
VALUES (
  'style-rule-drafter',
  'Style Rule Drafter',
  'learning',
  'Drafts concrete prompt instructions from classified edit patterns.',
  '',
  'You are analyzing patterns from human edits to AI-generated content. Based on the pattern below, write a single, specific prompt instruction that tells an AI content generator what to do differently.

Pattern name: {{pattern_name}}
Pattern descriptions from multiple edits:
{{pattern_descriptions}}

Example edit (before):
{{example_original}}

Example edit (after):
{{example_edited}}

Rules for your instruction:
- Be SPECIFIC — name exact phrases, formats, or behaviors to use/avoid
- Be ACTIONABLE — tell the AI what to do, not what was observed
- Be CONCISE — 1-3 sentences maximum
- Start with an imperative verb (Use, Avoid, Write, Break, Replace, etc.)

Return ONLY the instruction text, nothing else.',
  'claude-haiku-4-5-20251001',
  0.3,
  256,
  '[{"name":"pattern_name","description":"The classified pattern name","example":"added_specifics"},{"name":"pattern_descriptions","description":"All descriptions for this pattern across edits","example":"Replaced placeholder with real URL"},{"name":"example_original","description":"Original AI-generated text from one source edit","example":"[DOWNLOAD LINK]"},{"name":"example_edited","description":"Human-edited version","example":"https://example.com/checklist.pdf"}]'::jsonb,
  true
)
ON CONFLICT (slug) DO NOTHING;
