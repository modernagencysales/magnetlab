-- Add thankyou_layout column to funnel_pages for A/B testable thank-you page layouts
ALTER TABLE funnel_pages
  ADD COLUMN thankyou_layout TEXT NOT NULL DEFAULT 'survey_first';

ALTER TABLE funnel_pages
  ADD CONSTRAINT funnel_pages_thankyou_layout_check
  CHECK (thankyou_layout IN ('survey_first', 'video_first', 'side_by_side'));
