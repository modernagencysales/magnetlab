<!-- Extracted from CLAUDE.md — see main file for architecture overview -->

## Branding & Conversion Tracking

Team-level branding settings that apply across all funnels. Configured in Settings > Branding & Defaults.

### Brand Kit Fields (on `brand_kits` table)

- `logos` (jsonb array) -- client logos for logo bar sections
- `default_testimonial` (jsonb) -- `{quote, author, role}` for testimonial sections
- `default_steps` (jsonb) -- `{steps: [{icon, title, description}]}` for next-steps sections
- `default_theme` -- `dark` or `light`
- `default_primary_color` -- hex color (default `#8b5cf6`)
- `default_background_style` -- `solid`, `gradient`, or `pattern`
- `logo_url` -- uploaded logo (Supabase Storage `public-assets` bucket)
- `font_family` -- Google Font name or custom font name
- `font_url` -- custom .woff2 font URL (Supabase Storage)

### How Branding Flows

1. User configures branding in Settings (`BrandingSettings` component)
2. On funnel creation (`POST /api/funnel`), brand kit values are fetched and merged into template sections (logo_bar, testimonial, steps) + theme/color/font defaults
3. Font is snapshotted on `funnel_pages.font_family` / `font_url` at creation time -- changes to brand kit don't retroactively affect existing funnels
4. `FontLoader` component handles both Google Fonts (CDN link) and custom .woff2 fonts (`@font-face` injection with XSS sanitization)

### Conversion Tracking

- `page_views` table has `page_type` column (`optin` or `thankyou`) with unique constraint on `(funnel_page_id, viewer_hash, page_type)`
- Thank-you page tracks views via `POST /api/public/view` with `pageType: 'thankyou'`
- Analytics API (`/api/analytics/funnel/[id]`) returns `thankyouViews`, `responded` (leads with qualification answers), and `responseRate`
- Magnets page shows conversion rate badges (views → leads)

### Key Files

- `src/components/settings/BrandingSettings.tsx` -- 5-card settings UI (logo, theme, font, testimonial, steps)
- `src/app/api/brand-kit/upload/route.ts` -- logo/font upload to Supabase Storage
- `src/components/funnel/public/FontLoader.tsx` -- font loading + XSS sanitization, exports `GOOGLE_FONTS`
- `src/app/api/public/view/route.ts` -- page view tracking with `pageType` validation
