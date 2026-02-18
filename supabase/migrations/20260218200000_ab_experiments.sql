-- A/B experiment tracking for thank-you page optimization
CREATE TABLE ab_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_page_id UUID NOT NULL REFERENCES funnel_pages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'completed', 'paused')),
  test_field TEXT NOT NULL CHECK (test_field IN ('headline', 'subline', 'vsl_url', 'pass_message')),
  winner_id UUID REFERENCES funnel_pages(id),
  significance FLOAT,
  min_sample_size INT NOT NULL DEFAULT 50,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Variant columns on funnel_pages
ALTER TABLE funnel_pages
  ADD COLUMN experiment_id UUID REFERENCES ab_experiments(id) ON DELETE SET NULL,
  ADD COLUMN is_variant BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN variant_label TEXT;

-- Indexes
CREATE INDEX idx_ab_experiments_funnel ON ab_experiments(funnel_page_id);
CREATE INDEX idx_ab_experiments_user ON ab_experiments(user_id);
CREATE INDEX idx_ab_experiments_status ON ab_experiments(status);
CREATE INDEX idx_funnel_pages_experiment ON funnel_pages(experiment_id) WHERE experiment_id IS NOT NULL;
CREATE INDEX idx_funnel_pages_variant ON funnel_pages(is_variant) WHERE is_variant = true;

-- RLS
ALTER TABLE ab_experiments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own experiments"
  ON ab_experiments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own experiments"
  ON ab_experiments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own experiments"
  ON ab_experiments FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own experiments"
  ON ab_experiments FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Service role full access"
  ON ab_experiments FOR ALL
  USING (auth.role() = 'service_role');
