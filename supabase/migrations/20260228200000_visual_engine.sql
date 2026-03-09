-- ============================================
-- Visual Engine: Image Generation & Carousel Support
-- ============================================
-- 1. Add image_urls, carousel_data, image_generation_status to cp_pipeline_posts
-- 2. Create cp_image_templates table for carousel slide templates
-- 3. Enable RLS on cp_image_templates
-- ============================================

-- ============================================
-- 1. New columns on cp_pipeline_posts
-- ============================================

ALTER TABLE cp_pipeline_posts
  ADD COLUMN IF NOT EXISTS image_urls JSONB DEFAULT '[]'::jsonb;

ALTER TABLE cp_pipeline_posts
  ADD COLUMN IF NOT EXISTS carousel_data JSONB;

ALTER TABLE cp_pipeline_posts
  ADD COLUMN IF NOT EXISTS image_generation_status TEXT;

COMMENT ON COLUMN cp_pipeline_posts.image_urls IS 'Array of generated image URLs attached to this post';
COMMENT ON COLUMN cp_pipeline_posts.carousel_data IS 'Carousel slides data (array of slide objects with type, content, image_url)';
COMMENT ON COLUMN cp_pipeline_posts.image_generation_status IS 'Image generation pipeline status: null | generating | ready | failed';

-- ============================================
-- 2. cp_image_templates table
-- ============================================

CREATE TABLE IF NOT EXISTS cp_image_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slide_type TEXT NOT NULL CHECK (slide_type IN ('title', 'quote', 'stat', 'list', 'cta')),
  html_template TEXT NOT NULL,
  css_styles TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE cp_image_templates IS 'User-owned carousel slide templates for the visual engine';
COMMENT ON COLUMN cp_image_templates.slide_type IS 'Slide category: title, quote, stat, list, or cta';
COMMENT ON COLUMN cp_image_templates.html_template IS 'HTML template with {{variable}} placeholders for slide rendering';
COMMENT ON COLUMN cp_image_templates.css_styles IS 'Optional CSS styles applied to the slide template';
COMMENT ON COLUMN cp_image_templates.is_default IS 'Whether this is a default/system template for the user';

-- ============================================
-- 3. RLS policies for cp_image_templates
-- ============================================

ALTER TABLE cp_image_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cp_image_templates'
      AND policyname = 'Users manage own templates'
  ) THEN
    CREATE POLICY "Users manage own templates"
      ON cp_image_templates
      FOR ALL
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cp_image_templates'
      AND policyname = 'Service role bypass'
  ) THEN
    CREATE POLICY "Service role bypass"
      ON cp_image_templates
      FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;
