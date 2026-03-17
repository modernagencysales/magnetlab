# Settings Page Redesign

## Problem

The settings page is a single 6,900-line scrolling page with 10 top-level sections and ~25 settings areas. No navigation, no grouping. Users can't find what they need.

## Design

### Layout

Vertical sidebar nav (left) + content area (right), inside the existing dashboard layout. URL-based routing so sections are bookmarkable and browser back/forward works.

```
┌─────────────────────────────────────────────────────────────┐
│ Dashboard Sidebar │ Settings                                │
│ (existing)        │ ┌────────────┬────────────────────────┐ │
│                   │ │ ACCOUNT    │                        │ │
│                   │ │  Profile   │  [Active Section       │ │
│                   │ │  Billing   │   Content Here]        │ │
│                   │ │  Team      │                        │ │
│                   │ │            │                        │ │
│                   │ │ INTEGRAT.  │                        │ │
│                   │ │  LinkedIn  │                        │ │
│                   │ │  Email     │                        │ │
│                   │ │  ...       │                        │ │
│                   │ │            │                        │ │
│                   │ │ SIGNALS    │                        │ │
│                   │ │ BRANDING   │                        │ │
│                   │ │ DEVELOPER  │                        │ │
│                   │ └────────────┴────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Routes

| Route | Content |
|-------|---------|
| `/settings` | Redirects to `/settings/account` |
| `/settings/account` | Profile, Billing, Team Members |
| `/settings/integrations` | LinkedIn, Resend, Email Marketing, CRM, HeyReach, Fathom, Conductor, Tracking Pixels |
| `/settings/signals` | ICP Config, Keyword Monitors, Company Monitors, Competitor Monitoring |
| `/settings/branding` | Logo/Theme/Fonts (accordion), Page Defaults (video + template), White Label (Pro+ gated) |
| `/settings/developer` | API Keys, Webhooks, Documentation |

### Sidebar Nav

- Group headers: uppercase muted labels ("ACCOUNT", "INTEGRATIONS", etc.)
- Sub-items: clickable text links that scroll to the relevant card within the group page
- Active group: left border accent + highlighted background (violet primary)
- Mobile: collapses to horizontal scrollable pill bar (5 top-level groups)

### Content Per Route

#### `/settings/account`

1. **Profile** — Avatar (read-only), display name + email (read-only), username field, brand kit summary
2. **Subscription & Billing** — Plan badge, usage bars, beta notice, upgrade CTA
3. **Team Members** — Invite form, member list with status badges

#### `/settings/integrations`

Cards with consistent layout: icon + name + status badge in header, expand to show config.

1. LinkedIn (OAuth connect/disconnect)
2. Email Sending — Resend (API key + from config)
3. Email Marketing (Kit, MailerLite, Mailchimp, ActiveCampaign)
4. CRM — GoHighLevel (API key)
5. LinkedIn Delivery — HeyReach (API key + template vars)
6. Analytics — Fathom (webhook URL)
7. Conductor (URL + API key)
8. Tracking Pixels (Meta + LinkedIn sub-cards)

#### `/settings/signals`

1. ICP Configuration (tag inputs, toggles)
2. Keyword Monitors (list CRUD)
3. Company Monitors (list CRUD)
4. Competitor Monitoring (list CRUD)

#### `/settings/branding`

1. Branding — existing 6-card accordion (logo, theme, fonts, testimonial, next steps, website)
2. Page Defaults — default thank you video URL + funnel template selector
3. White Label (Pro+ gated) — custom domain, branding overrides, email domain, from email

#### `/settings/developer`

1. API Keys — create, copy, revoke
2. Webhooks — add, list, test, toggle, delete + payload docs
3. Documentation — link to full docs

### File Structure

```
src/app/(dashboard)/settings/
  layout.tsx              ← shared layout with SettingsNav sidebar
  page.tsx                ← redirect to /settings/account
  account/page.tsx        ← server component, fetches account data
  integrations/page.tsx   ← server component, fetches integration status
  signals/page.tsx        ← server component, fetches signal config
  branding/page.tsx       ← server component, fetches brand data
  developer/page.tsx      ← server component, fetches API keys/webhooks

src/components/settings/
  SettingsNav.tsx          ← NEW: sidebar nav (client component)
  (all 18 existing files unchanged)
```

### Data Fetching Optimization

Each route fetches only what it needs instead of everything:

- `/account` → subscription, usage, username, brand kit, team
- `/integrations` → integration connection statuses
- `/signals` → signal config data
- `/branding` → brand kit, branding settings
- `/developer` → API keys, webhooks

### What Gets Deleted

- `SettingsContent.tsx` (675 lines) — replaced by route-specific pages
- Inline API keys section → extracted to small component
- Inline page defaults section → extracted to small component

### What Stays Unchanged

All 18 existing settings component files. They just get imported into the correct route page instead of all into SettingsContent.tsx.

## Non-Goals

- No new settings or features added
- No redesign of individual settings components
- No changes to settings data models or APIs
