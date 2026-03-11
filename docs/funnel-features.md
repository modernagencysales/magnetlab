# Funnel Features

## A/B Testing (Thank-You Page)

Test one field: headline, subline, video, layout. AI suggests variants. Deterministic bucketing (IP + UA hash). Auto-winner via two-proportion z-test (6h cron).

**Tables:** `ab_experiments`, `funnel_pages.experiment_id`, `is_variant`

## Thank-You Layouts

`survey_first` (default) | `video_first` | `side_by_side` — controlled by `thankyou_layout`

## External Redirect

`redirect_trigger`: `none` | `immediate` | `after_qualification`. URLs get `?leadId=&email=` appended.

## Resource Delivery

`send_resource_email` toggle. If no active sequence: ON → system email; OFF → show on thank-you page.
