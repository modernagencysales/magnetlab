# MagnetLab UI Audit — Complete Inventory

> Generated: 2026-02-25 | Branch: `cyrus1/mod-315-audit-map-all-routes-pages-and-navigation`

---

## Section 1: Routes

### 1.1 Dashboard Routes (Authenticated)

All routes under `(dashboard)` route group require authentication via `middleware.ts` session cookie check. Wrapped by `src/app/(dashboard)/layout.tsx` which renders `DashboardNav` sidebar.

| Route Path | Component File | Type | Nav Link? | Notes |
|---|---|---|---|---|
| `/` | `src/app/(dashboard)/page.tsx` | Top-level page | Yes — "Home" | Dashboard home/overview |
| `/magnets` | `src/app/(dashboard)/magnets/page.tsx` | Top-level page | Yes — "Lead Magnets" | Lead magnet library list |
| `/magnets/[id]` | `src/app/(dashboard)/magnets/[id]/page.tsx` | Sub-page | No | Individual lead magnet detail/edit |
| `/pages` | `src/app/(dashboard)/pages/page.tsx` | Top-level page | Yes — "Pages" | Funnel page management |
| `/pages/new` | `src/app/(dashboard)/pages/new/page.tsx` | Sub-page | Via "Create New" dropdown | New landing page creation |
| `/pages/import` | `src/app/(dashboard)/pages/import/page.tsx` | Sub-page | No | Import landing page |
| `/knowledge` | `src/app/(dashboard)/knowledge/page.tsx` | Top-level page | Yes — "Knowledge" | Knowledge dashboard (AI Brain) |
| `/posts` | `src/app/(dashboard)/posts/page.tsx` | Top-level page | Yes — "Posts" | Content pipeline posts |
| `/automations` | `src/app/(dashboard)/automations/page.tsx` | Top-level page | Yes — "Automations" | LinkedIn automations |
| `/leads` | `src/app/(dashboard)/leads/page.tsx` | Top-level page | Yes — "Leads" | Lead management table |
| `/email/flows` | `src/app/(dashboard)/email/flows/page.tsx` | Top-level page | Yes — "Email" | Email flows list (tabbed layout) |
| `/email/flows/[id]` | `src/app/(dashboard)/email/flows/[id]/page.tsx` | Sub-page | No | Individual flow editor |
| `/email/broadcasts` | `src/app/(dashboard)/email/broadcasts/page.tsx` | Tab page | Via Email tab nav | Broadcast email list |
| `/email/broadcasts/[id]` | `src/app/(dashboard)/email/broadcasts/[id]/page.tsx` | Sub-page | No | Individual broadcast editor |
| `/email/subscribers` | `src/app/(dashboard)/email/subscribers/page.tsx` | Tab page | Via Email tab nav | Subscriber management |
| `/team` | `src/app/(dashboard)/team/page.tsx` | Top-level page | Yes — "Team" | Team management |
| `/team-select` | `src/app/(dashboard)/team-select/page.tsx` | Top-level page | Via team banner | Team switching |
| `/docs` | `src/app/(dashboard)/docs/page.tsx` | Top-level page | Yes — "Docs" (bottom nav) | Docs home (has own sidebar) |
| `/docs/[slug]` | `src/app/(dashboard)/docs/[slug]/page.tsx` | Sub-page | Via docs sidebar | Individual doc page |
| `/help` | `src/app/(dashboard)/help/page.tsx` | Top-level page | Yes — "Help" (bottom nav) | CEO guide / troubleshooting |
| `/settings` | `src/app/(dashboard)/settings/page.tsx` | Top-level page | Yes — "Settings" (bottom nav) | Account settings, billing, integrations |
| `/create` | `src/app/(dashboard)/create/page.tsx` | Top-level page | Via "Create New" dropdown | Lead magnet creation wizard (6 steps) |
| `/create/page-quick` | `src/app/(dashboard)/create/page-quick/page.tsx` | Sub-page | No | Quick landing page generator |
| `/content` | `src/app/(dashboard)/content/page.tsx` | Top-level page | No | Content pipeline (may be legacy) |
| `/catalog` | `src/app/(dashboard)/catalog/page.tsx` | Top-level page | No | Lead magnet catalog |
| `/swipe-file` | `src/app/(dashboard)/swipe-file/page.tsx` | Top-level page | No | Community post inspiration |
| `/analytics` | `src/app/(dashboard)/analytics/page.tsx` | Top-level page | No | Analytics overview |
| `/analytics/funnel/[id]` | `src/app/(dashboard)/analytics/funnel/[id]/page.tsx` | Sub-page | No | Individual funnel analytics |
| `/analytics/email` | `src/app/(dashboard)/analytics/email/page.tsx` | Sub-page | No | Email analytics |
| `/analytics/engagement` | `src/app/(dashboard)/analytics/engagement/page.tsx` | Sub-page | No | Engagement analytics |
| `/library` | `src/app/(dashboard)/library/page.tsx` | Top-level page | No | Legacy lead magnet library |
| `/library/[id]` | `src/app/(dashboard)/library/[id]/page.tsx` | Sub-page | No | Legacy individual lead magnet |
| `/library/[id]/funnel` | `src/app/(dashboard)/library/[id]/funnel/page.tsx` | Sub-page | No | Legacy funnel builder |
| `/assets` | `src/app/(dashboard)/assets/page.tsx` | Top-level page | No | Asset management hub |
| `/assets/libraries/new` | `src/app/(dashboard)/assets/libraries/new/page.tsx` | Sub-page | Via "Create New" dropdown | New library creation |
| `/assets/libraries/[id]` | `src/app/(dashboard)/assets/libraries/[id]/page.tsx` | Sub-page | No | Individual library detail |
| `/assets/libraries/[id]/funnel` | `src/app/(dashboard)/assets/libraries/[id]/funnel/page.tsx` | Sub-page | No | Library funnel builder |
| `/assets/external/new` | `src/app/(dashboard)/assets/external/new/page.tsx` | Sub-page | Via "Create New" dropdown | New external resource |
| `/assets/external/[id]/funnel` | `src/app/(dashboard)/assets/external/[id]/funnel/page.tsx` | Sub-page | No | External resource funnel builder |
| `/assets/import` | `src/app/(dashboard)/assets/import/page.tsx` | Sub-page | No | Import assets |

### 1.2 Admin Routes (Super-admin only)

Gated by `src/app/(dashboard)/admin/layout.tsx` — checks `is_super_admin` column on `users` table. Redirects non-admins to `/`.

| Route Path | Component File | Type | Nav Link? | Notes |
|---|---|---|---|---|
| `/admin` | `src/app/(dashboard)/admin/page.tsx` | Top-level page | Yes — "Admin" (conditional) | Admin hub, visible only if `isSuperAdmin` |
| `/admin/prompts` | `src/app/(dashboard)/admin/prompts/page.tsx` | Sub-page | No | AI prompt template management |
| `/admin/prompts/[slug]` | `src/app/(dashboard)/admin/prompts/[slug]/page.tsx` | Sub-page | No | Individual prompt editor |
| `/admin/learning` | `src/app/(dashboard)/admin/learning/page.tsx` | Sub-page | No | Learning observability dashboard |

### 1.3 Auth Routes

Route group: `(auth)`. Layout: `src/app/(auth)/layout.tsx`.

| Route Path | Component File | Type | Nav Link? | Notes |
|---|---|---|---|---|
| `/login` | `src/app/(auth)/login/page.tsx` | Top-level page | No | Google OAuth login page |

### 1.4 Marketing Routes

Route group: `(marketing)`. Layout: `src/app/(marketing)/layout.tsx`.

| Route Path | Component File | Type | Nav Link? | Notes |
|---|---|---|---|---|
| `/home` | `src/app/(marketing)/home/page.tsx` | Top-level page | No | Marketing landing page |

### 1.5 Public Routes (Unauthenticated)

Served at `/p/[username]/[slug]`. No auth required. Custom domain routing in `middleware.ts` rewrites `clientdomain.com/slug` → `/p/username/slug`.

| Route Path | Component File | Type | Notes |
|---|---|---|---|
| `/p/[username]/[slug]` | `src/app/p/[username]/[slug]/page.tsx` | Public page | Opt-in / landing page |
| `/p/[username]/[slug]/thankyou` | `src/app/p/[username]/[slug]/thankyou/page.tsx` | Public page | Post-opt-in thank you page (with A/B test bucketing) |
| `/p/[username]/[slug]/content` | `src/app/p/[username]/[slug]/content/page.tsx` | Public page | Hosted lead magnet content viewer |
| `/p/[username]/[slug]/library` | `src/app/p/[username]/[slug]/library/page.tsx` | Public page | Public library page |

### 1.6 Layouts

| Layout File | Wraps | Purpose |
|---|---|---|
| `src/app/layout.tsx` | All routes | Root layout (HTML, body, providers) |
| `src/app/(auth)/layout.tsx` | `/login` | Auth page layout |
| `src/app/(marketing)/layout.tsx` | `/home` | Marketing page layout |
| `src/app/(dashboard)/layout.tsx` | All dashboard routes | Sidebar nav, auth check, team context |
| `src/app/(dashboard)/admin/layout.tsx` | `/admin/**` | Super-admin gate |
| `src/app/(dashboard)/docs/layout.tsx` | `/docs/**` | Docs sidebar layout |
| `src/app/(dashboard)/email/layout.tsx` | `/email/**` | Email tabs (Flows, Broadcasts, Subscribers) |

### 1.7 API Routes (175 handlers)

#### A/B Experiments
| Route | Methods |
|---|---|
| `/api/ab-experiments` | GET, POST |
| `/api/ab-experiments/[id]` | GET, PATCH, DELETE |
| `/api/ab-experiments/suggest` | POST |

#### Admin
| Route | Methods |
|---|---|
| `/api/admin/import-subscribers` | POST |
| `/api/admin/learning` | GET |
| `/api/admin/prompts` | GET, POST |
| `/api/admin/prompts/[slug]` | GET, PUT, DELETE |
| `/api/admin/prompts/[slug]/restore` | POST |
| `/api/admin/prompts/[slug]/test` | POST |

#### Analytics
| Route | Methods |
|---|---|
| `/api/analytics/email` | GET |
| `/api/analytics/engagement` | GET |
| `/api/analytics/funnel/[id]` | GET |
| `/api/analytics/overview` | GET |

#### Auth
| Route | Methods |
|---|---|
| `/api/auth/[...nextauth]` | GET, POST |

#### Brand Kit
| Route | Methods |
|---|---|
| `/api/brand-kit` | GET, POST |
| `/api/brand-kit/extract` | POST |
| `/api/brand-kit/upload` | POST |

#### Catalog
| Route | Methods |
|---|---|
| `/api/catalog` | GET |

#### Competitors
| Route | Methods |
|---|---|
| `/api/competitors` | GET, POST |
| `/api/competitors/[id]` | DELETE |

#### Content Pipeline
| Route | Methods |
|---|---|
| `/api/content-pipeline/business-context` | GET, POST |
| `/api/content-pipeline/creators` | GET, POST |
| `/api/content-pipeline/creators/[id]` | GET, PUT, DELETE |
| `/api/content-pipeline/edit-feedback` | POST |
| `/api/content-pipeline/ideas` | GET, POST |
| `/api/content-pipeline/ideas/[id]` | PATCH, DELETE |
| `/api/content-pipeline/ideas/[id]/write` | POST |
| `/api/content-pipeline/inspiration` | GET |
| `/api/content-pipeline/inspiration/sources` | GET, POST |
| `/api/content-pipeline/knowledge` | GET |
| `/api/content-pipeline/knowledge/[id]` | GET, PATCH, DELETE |
| `/api/content-pipeline/knowledge/ask` | POST |
| `/api/content-pipeline/knowledge/clusters` | GET |
| `/api/content-pipeline/knowledge/export` | GET |
| `/api/content-pipeline/knowledge/gaps` | GET |
| `/api/content-pipeline/knowledge/readiness` | GET |
| `/api/content-pipeline/knowledge/recent` | GET |
| `/api/content-pipeline/knowledge/topics` | GET |
| `/api/content-pipeline/knowledge/topics/[slug]` | GET |
| `/api/content-pipeline/knowledge/topics/[slug]/summary` | POST |
| `/api/content-pipeline/performance` | GET |
| `/api/content-pipeline/performance/patterns` | GET |
| `/api/content-pipeline/planner` | GET, POST |
| `/api/content-pipeline/planner/[id]` | GET, PUT, DELETE |
| `/api/content-pipeline/planner/approve` | POST |
| `/api/content-pipeline/planner/generate` | POST |
| `/api/content-pipeline/posts` | GET, POST |
| `/api/content-pipeline/posts/[id]` | GET, PATCH, DELETE |
| `/api/content-pipeline/posts/[id]/engagement` | GET, POST |
| `/api/content-pipeline/posts/[id]/polish` | POST |
| `/api/content-pipeline/posts/[id]/publish` | POST |
| `/api/content-pipeline/posts/[id]/retry` | POST |
| `/api/content-pipeline/posts/by-date-range` | GET |
| `/api/content-pipeline/posts/schedule` | POST |
| `/api/content-pipeline/quick-write` | POST |
| `/api/content-pipeline/schedule/autopilot` | GET, POST |
| `/api/content-pipeline/schedule/buffer` | GET, PATCH |
| `/api/content-pipeline/schedule/slots` | GET, POST |
| `/api/content-pipeline/schedule/slots/[id]` | DELETE |
| `/api/content-pipeline/scraper` | POST |
| `/api/content-pipeline/scraper/extract-template` | POST |
| `/api/content-pipeline/scrape-searches` | GET, POST |
| `/api/content-pipeline/scrape-searches/[id]` | DELETE |
| `/api/content-pipeline/styles` | GET, POST |
| `/api/content-pipeline/styles/[id]` | GET, PUT, DELETE |
| `/api/content-pipeline/styles/extract` | POST |
| `/api/content-pipeline/styles/extract-from-url` | POST |
| `/api/content-pipeline/templates` | GET, POST |
| `/api/content-pipeline/templates/[id]` | GET, PUT, DELETE |
| `/api/content-pipeline/templates/bulk-import` | POST |
| `/api/content-pipeline/templates/match` | POST |
| `/api/content-pipeline/templates/seed` | POST |
| `/api/content-pipeline/templates/seed-csv` | POST |
| `/api/content-pipeline/transcripts` | GET, POST |
| `/api/content-pipeline/transcripts/[id]` | GET, DELETE |
| `/api/content-pipeline/transcripts/[id]/reprocess` | POST |
| `/api/content-pipeline/transcripts/upload` | POST |
| `/api/content-pipeline/transcripts/webhook-config` | GET |

#### Email
| Route | Methods |
|---|---|
| `/api/email/broadcasts` | GET, POST |
| `/api/email/broadcasts/[id]` | GET, PUT, DELETE |
| `/api/email/broadcasts/[id]/preview-count` | GET |
| `/api/email/broadcasts/[id]/send` | POST |
| `/api/email/flows` | GET, POST |
| `/api/email/flows/[id]` | GET, PUT, DELETE |
| `/api/email/flows/[id]/contacts` | GET |
| `/api/email/flows/[id]/generate` | POST |
| `/api/email/flows/[id]/steps` | GET, POST |
| `/api/email/flows/[id]/steps/[stepId]` | PUT, DELETE |
| `/api/email/generate-daily` | POST |
| `/api/email/subscribers` | GET, POST |
| `/api/email/subscribers/[id]` | GET, PATCH, DELETE |
| `/api/email/subscribers/import` | POST |
| `/api/email/unsubscribe` | GET, POST |

#### Email Sequence (Legacy)
| Route | Methods |
|---|---|
| `/api/email-sequence/generate` | POST |
| `/api/email-sequence/[leadMagnetId]` | GET, PUT |
| `/api/email-sequence/[leadMagnetId]/activate` | PATCH |

#### External API (Third-party integrations)
| Route | Methods |
|---|---|
| `/api/external/create-account` | POST |
| `/api/external/create-lead-magnet` | POST |
| `/api/external/funnels` | GET |
| `/api/external/funnels/[id]/publish` | POST |
| `/api/external/import-posts` | POST |
| `/api/external/lead-magnets` | GET |
| `/api/external/lead-magnets/ideate` | POST |
| `/api/external/lead-magnets/[id]` | GET, PATCH |
| `/api/external/lead-magnets/[id]/extract` | POST |
| `/api/external/lead-magnets/[id]/generate` | POST |
| `/api/external/lead-magnets/[id]/stats` | GET |
| `/api/external/lead-magnets/[id]/write-posts` | POST |

#### External Resources
| Route | Methods |
|---|---|
| `/api/external-resources` | GET, POST |
| `/api/external-resources/[id]` | GET, PUT, DELETE |

#### Feedback
| Route | Methods |
|---|---|
| `/api/feedback` | POST |

#### Funnel
| Route | Methods |
|---|---|
| `/api/funnel` | GET, POST |
| `/api/funnel/all` | GET |
| `/api/funnel/bulk` | POST |
| `/api/funnel/bulk/template` | POST |
| `/api/funnel/generate-content` | POST |
| `/api/funnel/stats` | GET |
| `/api/funnel/[id]` | GET, PUT, DELETE |
| `/api/funnel/[id]/publish` | POST |
| `/api/funnel/[id]/questions` | GET, POST |
| `/api/funnel/[id]/questions/[qid]` | PUT, DELETE |
| `/api/funnel/[id]/sections` | GET, PUT |
| `/api/funnel/[id]/sections/[sid]` | PUT, DELETE |
| `/api/funnel/[id]/sections/reset` | POST |
| `/api/funnels/[id]/integrations` | GET, POST |
| `/api/funnels/[id]/integrations/[provider]` | DELETE |

#### Integrations
| Route | Methods |
|---|---|
| `/api/integrations` | GET |
| `/api/integrations/verify` | POST |
| `/api/integrations/email-marketing/connect` | POST |
| `/api/integrations/email-marketing/connected` | GET |
| `/api/integrations/email-marketing/disconnect` | POST |
| `/api/integrations/email-marketing/lists` | GET |
| `/api/integrations/email-marketing/tags` | GET |
| `/api/integrations/email-marketing/verify` | POST |
| `/api/integrations/fathom/webhook-url` | GET, POST, DELETE |
| `/api/integrations/gohighlevel/connect` | POST |
| `/api/integrations/gohighlevel/disconnect` | POST |
| `/api/integrations/gohighlevel/status` | GET |
| `/api/integrations/gohighlevel/verify` | POST |
| `/api/integrations/mailchimp/authorize` | GET |
| `/api/integrations/mailchimp/callback` | GET |
| `/api/integrations/resend/settings` | GET, PATCH |

#### Jobs
| Route | Methods |
|---|---|
| `/api/jobs/[id]` | GET |

#### API Keys
| Route | Methods |
|---|---|
| `/api/keys` | GET, POST |
| `/api/keys/[id]` | DELETE |

#### Landing Page
| Route | Methods |
|---|---|
| `/api/landing-page/quick-create` | POST |

#### Lead Magnet
| Route | Methods |
|---|---|
| `/api/lead-magnet` | GET, POST |
| `/api/lead-magnet/analyze-competitor` | POST |
| `/api/lead-magnet/analyze-transcript` | POST |
| `/api/lead-magnet/extract` | POST |
| `/api/lead-magnet/generate` | POST |
| `/api/lead-magnet/ideate` | POST |
| `/api/lead-magnet/import` | POST |
| `/api/lead-magnet/write-post` | POST |
| `/api/lead-magnet/[id]` | GET, PUT, DELETE |
| `/api/lead-magnet/[id]/catalog` | POST |
| `/api/lead-magnet/[id]/content` | PUT |
| `/api/lead-magnet/[id]/polish` | POST |
| `/api/lead-magnet/[id]/screenshots` | POST |

#### Leads
| Route | Methods |
|---|---|
| `/api/leads` | GET |
| `/api/leads/export` | GET |

#### Libraries
| Route | Methods |
|---|---|
| `/api/libraries` | GET, POST |
| `/api/libraries/[id]` | GET, PUT, DELETE |
| `/api/libraries/[id]/items` | GET, POST |
| `/api/libraries/[id]/items/[itemId]` | PUT, DELETE |
| `/api/libraries/[id]/items/reorder` | PUT |

#### LinkedIn
| Route | Methods |
|---|---|
| `/api/linkedin/automations` | GET, POST |
| `/api/linkedin/automations/[id]` | PATCH, DELETE |
| `/api/linkedin/connect` | POST |
| `/api/linkedin/disconnect` | POST |
| `/api/linkedin/schedule` | POST |

#### Public (Unauthenticated)
| Route | Methods |
|---|---|
| `/api/public/chat` | POST |
| `/api/public/lead` | POST |
| `/api/public/page/[username]/[slug]` | GET |
| `/api/public/questions/[id]` | GET |
| `/api/public/resource-click` | POST |
| `/api/public/view` | POST |

#### Qualification Forms
| Route | Methods |
|---|---|
| `/api/qualification-forms` | GET, POST |
| `/api/qualification-forms/[formId]` | GET, PUT, DELETE |
| `/api/qualification-forms/[formId]/questions` | GET, POST |
| `/api/qualification-forms/[formId]/questions/[qid]` | PUT, DELETE |

#### Settings
| Route | Methods |
|---|---|
| `/api/settings/custom-domain` | GET, POST, DELETE |
| `/api/settings/team-domain` | GET, POST, DELETE |
| `/api/settings/team-domain/verify` | POST |
| `/api/settings/team-email-domain` | GET, POST, DELETE |
| `/api/settings/team-email-domain/from-email` | GET, PUT |
| `/api/settings/team-email-domain/verify` | POST |
| `/api/settings/whitelabel` | GET, PATCH |

#### Stripe
| Route | Methods |
|---|---|
| `/api/stripe/checkout` | POST |
| `/api/stripe/webhook` | POST |

#### Swipe File
| Route | Methods |
|---|---|
| `/api/swipe-file/lead-magnets` | GET |
| `/api/swipe-file/posts` | GET |
| `/api/swipe-file/submit` | POST |

#### Team
| Route | Methods |
|---|---|
| `/api/team` | GET, POST |
| `/api/team/[id]` | PUT, DELETE |
| `/api/team/[id]/activity` | GET |
| `/api/team/memberships` | GET |
| `/api/teams` | GET |
| `/api/teams/profiles` | GET, POST |
| `/api/teams/profiles/[id]` | GET, PUT, DELETE |

#### Thumbnails
| Route | Methods |
|---|---|
| `/api/thumbnail/generate` | POST |

#### User
| Route | Methods |
|---|---|
| `/api/user/defaults` | GET, POST |
| `/api/user/username` | GET, POST |

#### Webhooks (Inbound)
| Route | Methods |
|---|---|
| `/api/webhooks` | GET, POST |
| `/api/webhooks/[id]` | PUT, DELETE |
| `/api/webhooks/attio` | POST |
| `/api/webhooks/dfy` | POST |
| `/api/webhooks/fathom/[userId]` | POST |
| `/api/webhooks/fireflies` | POST |
| `/api/webhooks/grain` | POST |
| `/api/webhooks/gtm-callback` | POST |
| `/api/webhooks/resend` | POST |
| `/api/webhooks/subscriber-sync` | POST |
| `/api/webhooks/transcript` | POST |
| `/api/webhooks/unipile` | POST |

#### Wizard Draft
| Route | Methods |
|---|---|
| `/api/wizard-draft` | GET, POST, DELETE |

---

## Section 2: Navigation

### 2.1 Primary Sidebar Navigation

Defined in `src/components/dashboard/DashboardNav.tsx`. Renders in both desktop (fixed left sidebar, 256px) and mobile (overlay drawer).

#### Main Nav Items (in order)

| # | Label | Icon | Route | Active Match | Sub-items | Conditional? |
|---|---|---|---|---|---|---|
| 1 | Home | `Home` | `/` | Exact `/` | No | No |
| 2 | Lead Magnets | `Magnet` | `/magnets` | `/magnets/*` | No | No |
| 3 | Pages | `Globe` | `/pages` | `/pages/*` | No | No |
| 4 | Knowledge | `Brain` | `/knowledge` | `/knowledge/*` | No | No |
| 5 | Posts | `PenTool` | `/posts` | `/posts/*` | No | No |
| 6 | Automations | `Bot` | `/automations` | `/automations/*` | No | No |
| 7 | Leads | `Users` | `/leads` | `/leads/*` | No | No |
| 8 | Email | `Mail` | `/email/flows` | `/email/*` | Tab nav (see 2.3) | No |
| 9 | Team | `UsersRound` | `/team` | `/team/*` | No | No |

#### Bottom Nav Items (below separator)

| # | Label | Icon | Route | Conditional? |
|---|---|---|---|---|
| 1 | Docs | `BookOpen` | `/docs` | No |
| 2 | Help | `HelpCircle` | `/help` | No |
| 3 | Settings | `Settings` | `/settings` | No |

#### Admin Nav (below second separator)

| # | Label | Icon | Route | Conditional? |
|---|---|---|---|---|
| 1 | Admin | `Shield` | `/admin` | Yes — `isSuperAdmin` only |

### 2.2 "Create New" Dropdown

Button at top of sidebar, below logo. Opens a dropdown flyout with 4 creation shortcuts:

| # | Label | Icon | Route | Notes |
|---|---|---|---|---|
| 1 | Lead Magnet | `Magnet` (violet) | `/create` | Opens 6-step wizard |
| 2 | Landing Page | `Globe` (emerald) | `/pages/new` | Quick landing page |
| — | *separator* | | | |
| 3 | Library | 📚 (emoji) | `/assets/libraries/new` | Create resource library |
| 4 | External Resource | 🔗 (emoji) | `/assets/external/new` | Create external resource link |

Active state: highlights when on `/create` or `/create/*`.

### 2.3 Email Sub-Navigation (Tab Bar)

Defined in `src/app/(dashboard)/email/layout.tsx`. Renders as horizontal tab bar within the Email section.

| # | Tab Label | Route |
|---|---|---|
| 1 | Flows | `/email/flows` |
| 2 | Broadcasts | `/email/broadcasts` |
| 3 | Subscribers | `/email/subscribers` |

### 2.4 Docs Sub-Navigation (Sidebar)

Defined in `src/components/docs/DocsSidebar.tsx`. Renders as left sidebar within the Docs section (desktop only, hidden mobile).

| Section | Items |
|---|---|
| **Quick Start** | Create Your Landing Page (`/docs/create-landing-page`), Connect to Your Email List (`/docs/connect-email-list`) |
| **Integrations** | Zapier (`/docs/zapier`), Make (`/docs/make`), n8n (`/docs/n8n`), Direct API / Webhook (`/docs/direct-api`) |
| **Advanced** | Customize Your Funnel (`/docs/customize-funnel`), Email Sequences (`/docs/email-sequences`), Tracking & Attribution (`/docs/tracking`), Troubleshooting (`/docs/troubleshooting`) |
| **AI / MCP** | Create Pages with Claude (`/docs/mcp-setup`), MCP Tool Reference (`/docs/mcp-tools`), Example Workflows (`/docs/mcp-workflows`) |

### 2.5 Team Mode Banner

Shown conditionally when `teamContext.isTeamMode === true`. Displays within sidebar header area.

| Element | Action |
|---|---|
| "Working in: {teamName}" | Informational |
| "Switch team" link | Navigates to `/team-select` |

### 2.6 Footer Nav

Bottom of sidebar with user profile info.

| Element | Action |
|---|---|
| User avatar + name | Display only |
| Theme toggle (Sun/Moon) | Toggles dark/light mode |
| Sign out button | `signOut({ callbackUrl: '/login' })` + PostHog reset |

### 2.7 Mobile Navigation

Mobile top bar (`lg:hidden`): hamburger menu → opens overlay drawer with same `SidebarContent`. Close button + click-outside-to-dismiss. Auto-closes on route change.

---

## Section 3: Lead Magnet Creation Wizard

### 3.1 Overview

- **Entry point**: `/create` → `src/app/(dashboard)/create/page.tsx` → renders `WizardContainer`
- **Container**: `src/components/wizard/WizardContainer.tsx` — manages all state, step transitions, and background job polling
- **Progress bar**: `src/components/wizard/WizardProgress.tsx` — reads `WIZARD_STEPS` from `src/lib/types/lead-magnet.ts`
- **State persistence**: Auto-save via `useWizardAutoSave` hook → `POST /api/wizard-draft`
- **Draft recovery**: `DraftPicker` component shown on mount if previous drafts exist
- **Background jobs**: Uses `useBackgroundJob` hook for long-running AI operations (ideation, extraction, posts)

### 3.2 Wizard Steps

| Step # | Name | Component | Required? | Can Skip? | Exit Points |
|---|---|---|---|---|---|
| 1 | Context | `ContextStep` | Yes | No | "I have my own idea" bypasses to CustomIdeaStep; "Use saved ideas" skips to step 2 |
| 2 | Ideation | `IdeationStep` or `CustomIdeaStep` | Yes | No | Back to step 1 |
| 3 | Extraction | `ExtractionStep` | Yes | No | Back to step 2 |
| 4 | Content | `ContentStep` or `InteractiveContentStep` | Yes | No | Back to step 3 |
| 5 | Post | `PostStep` | Yes | No | Back to step 4 |
| 6 | Publish | `PublishStep` | Yes | No | Back to step 5; "Go to library" after save |

### 3.3 Step Details

#### Step 1: Context (`ContextStep`)

**File**: `src/components/wizard/steps/ContextStep.tsx`

**Data collected**:
| Field | Type | Required? |
|---|---|---|
| `businessDescription` | Text | Yes |
| `businessType` | Select (enum: `BusinessType`) | Yes |
| `credibilityMarkers` | Tag list (strings) | No |
| `urgentPains` | Tag list (strings) | No |
| `templates` | Tag list (strings) | No |
| `processes` | Tag list (strings) | No |
| `tools` | Tag list (strings) | No |
| `frequentQuestions` | Tag list (strings) | No |
| `results` | Tag list (strings) | No |
| `successExample` | Text | No |

**Tabs**: Smart Import (auto-extract from URL/text) | Manual entry

**Ideation Sources** (optional enrichment modals):
- Call transcript insights (modal: paste transcript → `POST /api/lead-magnet/analyze-transcript`)
- Competitor inspiration (modal: paste competitor content → `POST /api/lead-magnet/analyze-competitor`)

**API calls**:
- `GET /api/brand-kit` — loads saved brand kit on mount
- `GET /api/wizard-draft` — loads saved drafts on mount
- `POST /api/lead-magnet/ideate` — triggers ideation background job
- `POST /api/brand-kit` — saves business context (custom idea flow only)
- `POST /api/lead-magnet/analyze-transcript` — transcript analysis
- `POST /api/lead-magnet/analyze-competitor` — competitor analysis

**Alternative flows**:
- "I have my own idea" → saves context, sets `isCustomIdea=true`, goes to step 2 (`CustomIdeaStep`)
- "Use saved ideas" → loads previously generated ideation result, goes to step 2

#### Step 2a: Ideation (`IdeationStep`)

**File**: `src/components/wizard/steps/IdeationStep.tsx`

**Data collected**: User selects one concept from AI-generated options (3 concepts with recommendation badges: "Ship This Week", "Highest Engagement", "Authority Builder")

**Display**: Concept cards showing title, archetype, pain solved, delivery format, viral check score

**API calls**: None (receives data from step 1's background job)

**Exit**: Select a concept → moves to step 3 with `selectedConceptIndex`

#### Step 2b: Custom Idea (`CustomIdeaStep`)

**File**: `src/components/wizard/steps/CustomIdeaStep.tsx`

**Data collected**:
| Field | Type | Required? |
|---|---|---|
| `archetype` | Select (10 archetype options) | Yes |
| `title` | Text | Yes |
| `painSolved` | Text | Yes |
| `deliveryFormat` | Text | No (defaults per archetype) |

**API calls**: None (builds `LeadMagnetConcept` client-side)

#### Step 3: Extraction (`ExtractionStep`)

**File**: `src/components/wizard/steps/ExtractionStep.tsx`

**Data collected**: Answers to dynamically generated content extraction questions (chat-like interface). Questions are specific to the selected archetype — e.g., for `single-breakdown`: example, walkthrough, psychology, insight, adaptation. Uses transcript insights to pre-populate suggestions.

**API calls**:
- `POST /api/lead-magnet/extract` — triggers extraction background job with answers + concept + archetype

**Output**: `ExtractedContent` or `InteractiveConfig` depending on archetype

#### Step 4a: Content Review (`ContentStep`)

**File**: `src/components/wizard/steps/ContentStep.tsx`

**Shown when**: Non-interactive archetype (standard content)

**Data collected**: User can edit title, sections, content items, proof, common mistakes, and differentiation. Supports section reordering, adding/removing items.

**API calls**: None (editing is client-side; approval triggers post generation)

**Action**: "Approve & Generate Posts" → triggers `POST /api/lead-magnet/write-post` background job

#### Step 4b: Interactive Content (`InteractiveContentStep`)

**File**: `src/components/wizard/steps/InteractiveContentStep.tsx`

**Shown when**: Interactive archetype (`single-calculator`, `assessment`, `workflow`)

**Data collected**: User edits the AI-generated interactive config (calculator inputs/formula, assessment questions/scoring, or GPT system prompt). Two tabs: Preview | Edit.

**Sub-components**:
- `CalculatorPreview` / `CalculatorEditor`
- `AssessmentPreview` / `AssessmentEditor`
- `GPTPreview` / `GPTEditor`

**API calls**:
- "Regenerate" → `POST /api/lead-magnet/extract` (with `action: 'generate-interactive'`)

**Action**: "Approve & Generate Posts" → triggers `POST /api/lead-magnet/write-post`

#### Step 5: Post Selection (`PostStep`)

**File**: `src/components/wizard/steps/PostStep.tsx`

**Data collected**: User selects one LinkedIn post variation from AI-generated options. Each shows hook, body preview, evaluation score, and copy button.

**API calls**: None (receives data from step 4's background job)

**Display**: Post cards with quality evaluation (hook strength, credibility, problem resonance, content specificity, tone match, AI cliche free)

#### Step 6: Publish (`PublishStep`)

**File**: `src/components/wizard/steps/PublishStep.tsx`

**Data collected**:
| Field | Type | Required? |
|---|---|---|
| `saveTitle` | Text (editable) | Yes |

**Displays**: Selected post text (copy), DM template (copy), full lead magnet content (view/copy)

**API calls**:
- `POST /api/lead-magnet` — saves lead magnet to database
- `DELETE /api/wizard-draft` — removes draft after successful save

**Post-save navigation**: Link to `/magnets/[id]` (library detail) and `/library/[id]/funnel` (funnel builder)

### 3.4 Generating Screens

Between steps, `GeneratingScreen` (`src/components/wizard/GeneratingScreen.tsx`) shows a loading animation:

| Trigger | Message | Between Steps |
|---|---|---|
| Ideation job | "Generating ideas..." (default) | 1 → 2 |
| Extraction job | "Extracting your content..." | 3 → 4 |
| Post writing job | "Writing your LinkedIn posts..." | 4 → 5 |

### 3.5 Quick Create Variant

**Entry**: `/create/page-quick` → `src/app/(dashboard)/create/page-quick/page.tsx`

Separate from the 6-step wizard. A simplified landing page creation flow that calls `POST /api/landing-page/quick-create`.

---

## Section 4: Middleware & Routing

### 4.1 Authentication Middleware

**File**: `src/middleware.ts`

**Protected routes** (require auth session):
`/create`, `/magnets`, `/pages`, `/knowledge`, `/posts`, `/leads`, `/settings`, `/automations`, `/admin`, `/library`, `/content`, `/assets`, `/analytics`, `/swipe-file`, `/docs`, `/catalog`, `/team-select`, `/team`

**Auth routes** (redirect to dashboard if already authenticated): `/login`

**Custom domain routing**: Non-app hostnames → `lookupCustomDomain()` → rewrite to `/p/[username]/[slug]`

### 4.2 Route Summary Statistics

| Category | Count |
|---|---|
| Dashboard pages | 37 |
| Admin pages | 4 |
| Auth pages | 1 |
| Marketing pages | 1 |
| Public pages | 4 |
| Layouts | 7 |
| API route files | 175 |
| **Total page routes** | **47** |
