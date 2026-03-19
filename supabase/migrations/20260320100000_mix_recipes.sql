-- Mixer feedback loop: track ingredient combinations and their resulting posts.
-- Prerequisite: 20260319100000_exploit_driven_content.sql must be applied first.

CREATE TABLE cp_mix_recipes (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_profile_id   UUID        NOT NULL REFERENCES team_profiles(id) ON DELETE CASCADE,
  exploit_id        UUID        REFERENCES cp_exploits(id) ON DELETE SET NULL,
  knowledge_topic   TEXT,
  knowledge_query   TEXT,
  style_id          UUID        REFERENCES cp_writing_styles(id) ON DELETE SET NULL,
  template_id       UUID        REFERENCES cp_post_templates(id) ON DELETE SET NULL,
  creative_id       UUID        REFERENCES cp_creatives(id) ON DELETE SET NULL,
  trend_topic       TEXT,
  recycled_post_id  UUID        REFERENCES cp_pipeline_posts(id) ON DELETE SET NULL,
  idea_id           UUID        REFERENCES cp_content_ideas(id) ON DELETE SET NULL,
  instructions      TEXT,
  output_type       TEXT        NOT NULL DEFAULT 'drafts' CHECK (output_type IN ('drafts', 'ideas')),
  post_ids          UUID[]      NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE cp_mix_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own mix recipes"
  ON cp_mix_recipes FOR ALL
  USING (team_profile_id IN (
    SELECT id FROM team_profiles WHERE team_id IN (
      SELECT team_id FROM team_members WHERE user_id = auth.uid()
    )
  ));

CREATE INDEX idx_mix_recipes_profile ON cp_mix_recipes(team_profile_id);
CREATE INDEX idx_mix_recipes_created_at ON cp_mix_recipes(team_profile_id, created_at DESC);

CREATE TRIGGER set_mix_recipes_updated_at
  BEFORE UPDATE ON cp_mix_recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
