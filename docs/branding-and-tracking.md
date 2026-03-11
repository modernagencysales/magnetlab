# Branding & Conversion Tracking

Settings > Branding & Defaults. `brand_kits`: logos, testimonial, steps, theme, primary_color, font.

## Flow

Funnel creation merges brand kit into template sections. Font snapshotted on `funnel_pages` at creation.

## Conversion Tracking

`page_views.page_type` (optin | thankyou). Thank-you views via `POST /api/public/view`. Analytics: `thankyouViews`, `responded`, `responseRate`.
