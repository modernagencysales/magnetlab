-- Thank-you page conversion redesign: VSL framing, CTA bridge, booking pre-fill

-- 4 new columns on funnel_pages for video framing and CTA bridge
ALTER TABLE funnel_pages ADD COLUMN IF NOT EXISTS vsl_headline text;
ALTER TABLE funnel_pages ADD COLUMN IF NOT EXISTS vsl_subline text;
ALTER TABLE funnel_pages ADD COLUMN IF NOT EXISTS cta_headline text;
ALTER TABLE funnel_pages ADD COLUMN IF NOT EXISTS cta_button_text text;

-- 1 new column on qualification_questions for booking pre-fill mapping
ALTER TABLE qualification_questions ADD COLUMN IF NOT EXISTS booking_prefill_key text;

COMMENT ON COLUMN funnel_pages.vsl_headline IS 'Bold label above video embed (e.g. THE MODERN AGENCY SALES METHOD)';
COMMENT ON COLUMN funnel_pages.vsl_subline IS 'Descriptive text below vsl_headline';
COMMENT ON COLUMN funnel_pages.cta_headline IS 'Text above CTA button between video and survey';
COMMENT ON COLUMN funnel_pages.cta_button_text IS 'CTA button text (e.g. BOOK YOUR CALL NOW)';
COMMENT ON COLUMN qualification_questions.booking_prefill_key IS 'iClosed/booking field identifier to map this answer to (e.g. monthlyrevenue, businesstype)';
