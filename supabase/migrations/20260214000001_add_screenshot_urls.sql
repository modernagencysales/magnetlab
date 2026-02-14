-- Add screenshot URLs column for LinkedIn post images
ALTER TABLE public.lead_magnets
  ADD COLUMN IF NOT EXISTS screenshot_urls JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.lead_magnets.screenshot_urls IS
  'Array of screenshot objects: [{type, sectionIndex?, sectionName?, url1200x627, url1080x1080}]';
