# MagnetLab Feature Overlap & Duplication Audit

> Generated: 2026-03-04 | Phase 1 — Codebase UI Audit (no changes)
> Companion to: `/docs/ui-audit.md`

---

## Summary Table

| # | Overlap | Severity | Recommendation | Section |
|---|---------|----------|----------------|---------|
| 1 | "Lead Magnets" vs "Pages" vs "Funnels" — three names for tightly coupled concepts | **Critical** | Merge into unified "Assets" or "Lead Magnets" view | §1 |
| 2 | Post creation exists in 7+ separate surfaces with 2 different data models | **High** | Consolidate wizard posts into content pipeline; unify creation entry points | §2 |
| 3 | "Leads" and "Email > Subscribers" show overlapping contact data | **High** | Merge into single "Contacts" section with filtered views | §3 |
| 4 | `/knowledge` and `/posts` split the content pipeline across two nav items | **High** | Reunify as single "Content" hub with sub-tabs | §4 |
| 5 | Brand kit config split between wizard ContextStep and Settings > Branding | **Medium** | Consolidate into single brand settings page | §5 |
| 6 | Team member management in both `/settings/account#team` and `/team` | **Medium** | Remove settings duplicate; `/team` is the canonical location | §6 |
| 7 | Integration config split between account-level Settings and per-funnel toggles | **Low** | Keep both but improve discoverability with cross-links | §7 |
| 8 | Dead-end and legacy routes still accessible | **Medium** | Remove redirects, clean up unreachable pages | §8 |
| 9 | `/assets` hub exists but is invisible (not in nav) | **Medium** | Surface or fold into Lead Magnets | §9 |
| 10 | Signals, Leads, Email — three nav items all about "people" | **High** | Group under single "People" or "Audience" section | §10 |
| 11 | "Automations" is LinkedIn-only but name suggests broader scope | **Low** | Rename to "LinkedIn Automations" or fold into Signals | §11 |
| 12 | Analytics scattered across multiple surfaces | **Medium** | Consolidate into single Analytics hub | §12 |
| 13 | "Create New" dropdown offers paths that duplicate existing nav items | **Low** | Streamline to avoid confusion | §13 |

---

## Detailed Findings

---

### §1 — "Lead Magnets" vs "Pages" vs "Funnels" (CRITICAL)

#### What the duplication is

MagnetLab uses three different terms for what users experience as a single workflow: create content → build an opt-in page → capture leads. The mental model is one thing ("my lead magnet"), but the UI presents it as two or three:

| Nav Item | Route | What it shows | Underlying table |
|----------|-------|---------------|-----------------|
| **Lead Magnets** | `/magnets` | List of lead magnet content (title, archetype, status, has-funnel badge) | `lead_magnets` |
| **Pages** | `/pages` | List of funnel/opt-in pages (title, slug, published status, views, leads) | `funnel_pages` |
| *(No nav item)* | `/magnets/[id]?tab=funnel` | Funnel builder embedded inside lead magnet detail | `funnel_pages` |

The relationship is: **one lead magnet → zero or one funnel page**. They are tightly coupled — deleting a lead magnet cascades to its funnel page. A funnel page cannot exist without a target (lead magnet, library, or external resource).

#### Why this is confusing

1. **A user creating a lead magnet must visit TWO different nav sections** — first `/magnets` (or `/create` wizard) to build the content, then either navigate to `/magnets/[id]?tab=funnel` or find the same page listed under `/pages` to configure the opt-in page.

2. **The `/pages` list shows the same lead magnets from a different angle** — the "Pages" title on each row IS the lead magnet title. A user looking at `/pages` is looking at a subset of what's on `/magnets` (those that have funnels), plus library funnels and external resource funnels.

3. **The word "Funnel" appears nowhere in the top-level nav** — but the builder is called `FunnelBuilder`, the API routes are `/api/funnel/`, the database table is `funnel_pages`, and the tab inside lead magnet detail is labeled "Funnel." Users must discover that "Pages" = "Funnels."

4. **The `/pages/new` route creates a funnel page, not a "Page"** — it's a landing page creation flow, but naming collision with the nav item "Pages" implies it creates something different from what the `/pages` list shows.

#### Files involved

| File | Role |
|------|------|
| `src/components/dashboard/DashboardNav.tsx` | Nav items: "Lead Magnets" → `/magnets`, "Pages" → `/pages` |
| `src/app/(dashboard)/magnets/page.tsx` | Lead magnet list |
| `src/components/magnets/MagnetsListClient.tsx` | Lead magnet list component (shows "has funnel" badge) |
| `src/app/(dashboard)/magnets/[id]/page.tsx` | Lead magnet detail (5 tabs: Overview, Funnel, Post, Leads, Analytics) |
| `src/components/magnets/MagnetDetail.tsx` | Detail view — embeds `FunnelBuilder` in Funnel tab |
| `src/app/(dashboard)/pages/page.tsx` | Funnel pages list |
| `src/components/pages/PagesListClient.tsx` | Pages list component |
| `src/components/funnel/FunnelBuilder.tsx` | Shared funnel editor (8 tabs: optin, thankyou, questions, theme, sections, content, email, integrations) |

#### Recommendation: **MERGE** — Eliminate "Pages" as a top-level nav item

The `/pages` view adds no information that isn't already on `/magnets`. Specifically:

- Every lead magnet with a funnel already shows a "has funnel" badge on the `/magnets` list
- The lead magnet detail page at `/magnets/[id]` already has a Funnel tab with the full `FunnelBuilder`
- The only things on `/pages` that aren't on `/magnets` are library funnels and external resource funnels — these should live under a unified "Assets" section instead

**Proposed new structure:**
```
Lead Magnets (nav item) → /magnets
  ├── List view (shows all lead magnets with funnel status + conversion rate inline)
  ├── /magnets/[id] → Detail with tabs: Content, Funnel, Post, Leads, Analytics
  └── Libraries and External Resources → accessible via sub-tab or "Assets" section

Remove "Pages" from nav entirely.
```

---

### §2 — Post Creation in 7+ Surfaces (HIGH)

#### What the duplication is

Users can create LinkedIn posts from at least 7 different places, using two completely separate data models:

| Surface | Entry Point | Saves to | AI Module | Component |
|---------|------------|----------|-----------|-----------|
| **Wizard Step 5** | `/create` → Step 5 | `lead_magnets.linkedin_post` + `post_variations` | `write-posts` Trigger task | `PostStep.tsx` |
| **Quick Write (manual)** | `/posts` → "New Post" FAB | `cp_pipeline_posts` | None | `QuickWriteModal.tsx` |
| **Quick Write (AI)** | `/posts` → "New Post" → AI Draft | `cp_pipeline_posts` | `quickWrite()` | `QuickWriteModal.tsx` |
| **Ideas → Write** | `/posts?tab=ideas` → Write button | `cp_pipeline_posts` | `write-post-from-idea` Trigger task | `IdeasTab.tsx` |
| **Autopilot** | `/posts?tab=autopilot` → Run | `cp_pipeline_posts` (buffer) | `runNightlyBatch()` | `AutopilotTab.tsx` |
| **AI Co-pilot** | Copilot sidebar → "write a post about X" | `cp_pipeline_posts` | `writePost()` action | `CopilotSidebar.tsx` |
| **Team Broadcast** | `/posts?tab=pipeline` → right-click → Broadcast | `cp_pipeline_posts` (per-profile voice) | `broadcast-post-variations` Trigger task | `BroadcastModal.tsx` |
| **Promotion Posts** | Background cron (Monday 8 AM) | `cp_pipeline_posts` | `generatePromotionPosts()` | None (background) |

#### The core problem

**The wizard creates posts in `lead_magnets` table, while everything else uses `cp_pipeline_posts`.** These are completely disconnected data models:

- Wizard posts live as JSON fields (`linkedin_post`, `post_variations`) on the lead magnet row
- Pipeline posts are first-class rows in `cp_pipeline_posts` with their own lifecycle (draft → reviewing → approved → scheduled → published)
- A wizard-generated post does NOT appear on the `/posts` page unless manually re-created there
- There is no automated bridge between the two systems

This means: **after completing the wizard, the user's generated post is invisible to the content pipeline.** They must manually copy it to the pipeline or create it again.

#### Files involved

| File | Role |
|------|------|
| `src/components/wizard/steps/PostStep.tsx` | Wizard post selection (writes to `lead_magnets`) |
| `src/components/posts/PostsContent.tsx` | Posts hub (reads from `cp_pipeline_posts`) |
| `src/components/posts/QuickWriteModal.tsx` | Quick write dialog |
| `src/lib/ai/content-pipeline/post-writer.ts` | Shared AI post writer (used by pipeline, NOT by wizard) |
| `src/trigger/write-posts.ts` | Wizard post generation task |
| `src/trigger/write-post-from-idea.ts` | Pipeline post from idea |
| `src/trigger/broadcast-post-variations.ts` | Team broadcast |
| `src/lib/ai/content-pipeline/promotion-post-writer.ts` | Promotion post writer |
| `src/lib/actions/content.ts` | Co-pilot `write_post` action |

#### Recommendation: **MERGE** the wizard post output into `cp_pipeline_posts`

1. When the wizard generates posts at Step 5, also insert them into `cp_pipeline_posts` with `content_type: 'lead_magnet'` and a reference to `lead_magnet_id`
2. Keep the wizard's PostStep UI unchanged — user still picks their favorite variation
3. After wizard completion, the chosen post appears in the pipeline as `status: 'draft'` ready for scheduling
4. Remove the standalone `linkedin_post` / `post_variations` fields from `lead_magnets` over time (or keep for backward compat)

For the 7 creation surfaces: this is actually fine as long as they all feed the same pipeline. The variety of entry points serves different workflows. The problem is only the wizard being disconnected.

---

### §3 — "Leads" vs "Email > Subscribers" (HIGH)

#### What the duplication is

Two nav items show contact-like data that substantially overlaps:

| Nav Item | Route | Table | What it shows |
|----------|-------|-------|---------------|
| **Leads** | `/leads` | `funnel_leads` | Email, name, funnel, qualification status, UTM, date |
| **Email > Subscribers** | `/email/subscribers` | `email_subscribers` | Email, name, status (active/unsubscribed/bounced), source, date |

Every lead captured through a funnel is **automatically synced** to `email_subscribers` via `upsertSubscriberFromLead()`. So every person on the Leads page also appears on the Subscribers page — but with different metadata and a different data model.

Additionally, **Signal Leads** at `/signals` shows a third population (LinkedIn profiles discovered through monitoring), which may overlap with both if the same person is enriched.

#### Why this is confusing

1. **Same person, three places** — A LinkedIn contact who engages with a lead magnet post, gets discovered by the signal engine, opts in through the funnel, and gets auto-subscribed to the email list appears in: Signals (signal_leads), Leads (funnel_leads), and Subscribers (email_subscribers). No unified view exists.

2. **"Leads" implies active prospects but shows historical opt-ins** — the Leads page is read-only with no actions beyond CSV export. It's an audit trail, not a lead management tool.

3. **Subscribers come from multiple sources** — not just funnel leads. Sources include: `positive_reply`, `meeting`, `heyreach`, `plusvibe`, `gtm_sync`, `csv_import`, `manual`. These subscribers have NO corresponding row in `funnel_leads`, so the Leads page misses them entirely.

4. **No cross-linking** — clicking a lead doesn't show their subscriber status. Clicking a subscriber doesn't show which funnel they came from (only `source_id` = lead magnet ID).

#### Files involved

| File | Role |
|------|------|
| `src/app/(dashboard)/leads/page.tsx` | Leads list page |
| `src/components/leads/LeadsTable.tsx` | Leads table component |
| `src/app/(dashboard)/email/subscribers/page.tsx` | Subscribers list page |
| `src/components/email/SubscriberTable.tsx` | Subscribers table component |
| `src/app/(dashboard)/signals/page.tsx` | Signal leads page |
| `src/components/signals/SignalLeadsTable.tsx` | Signal leads table |
| `src/lib/services/email-sequence-trigger.ts` | `upsertSubscriberFromLead()` — auto-sync bridge |
| `src/app/api/leads/route.ts` | Leads API (reads `funnel_leads`) |
| `src/app/api/email/subscribers/route.ts` | Subscribers API (reads `email_subscribers`) |

#### Recommendation: **MERGE** into unified "People" / "Contacts" section

Create a single "People" nav item with tabs that provide filtered views:

```
People (nav item) → /people
  ├── All Contacts (deduplicated by email, merged from all sources)
  ├── Funnel Leads (current /leads view — conversion attribution)
  ├── Email List (current /email/subscribers view — email delivery status)
  └── Signal Leads (current /signals — LinkedIn discovery)
```

Each tab queries its own table but shares a common contact detail drawer that shows the full picture for any person: funnel history, email status, signal events, qualification data.

The `/email` section should become **Email Campaigns** (flows + broadcasts only), without a contacts/subscribers tab.

---

### §4 — Knowledge and Posts Split Across Two Nav Items (HIGH)

#### What the duplication is

The content pipeline is artificially split into two top-level nav items:

| Nav Item | Route | Tabs |
|----------|-------|------|
| **Knowledge** | `/knowledge` | AI Brain (dashboard), Transcripts |
| **Posts** | `/posts` | Pipeline (Kanban), Calendar, Ideas, Library, Autopilot |

These are two halves of the same system. The data flow is: **Transcripts → Knowledge → Ideas → Posts → Schedule → Publish**. Splitting them means users must context-switch between two pages to manage what is fundamentally one pipeline.

Additionally, there was historically a **ContentPipelineContent** component with 8 tabs (Transcripts, Knowledge, Ideas, Posts, Pipeline, Templates, Autopilot, Command Center) that represented the complete pipeline in one view. The current split broke this into Knowledge (2 tabs) and Posts (5 tabs), losing the unified mental model.

#### Why this is confusing

1. **Ideas originate from Knowledge but live under Posts** — when a transcript is processed, ideas are extracted and appear in the Ideas tab under `/posts`. But the user added the transcript under `/knowledge`. The connection is invisible.

2. **The Team Command Center** (weekly grid for multi-profile scheduling) is a critical daily tool buried inside the Posts page. It deserves more prominence but gets lost among 5 tabs.

3. **Templates and Writing Styles** appear under Posts > Library tab, but they're used across the entire pipeline (including Knowledge extraction and Autopilot). Their placement under "Posts" is misleading.

#### Files involved

| File | Role |
|------|------|
| `src/app/(dashboard)/knowledge/page.tsx` | Knowledge page |
| `src/components/knowledge/KnowledgeContent.tsx` | Knowledge tabs (Brain, Transcripts) |
| `src/app/(dashboard)/posts/page.tsx` | Posts page |
| `src/components/posts/PostsContent.tsx` | Posts tabs (Pipeline, Calendar, Ideas, Library, Autopilot) |
| `src/components/content-pipeline/TeamCommandCenter.tsx` | Team weekly grid (inside Posts) |
| `src/components/content-pipeline/KnowledgeDashboard.tsx` | Knowledge dashboard (4 subtabs: Overview, Topics, Gaps, Search) |

#### Recommendation: **MERGE** into single "Content" hub

Reunify the pipeline under one nav item:

```
Content (nav item) → /content
  ├── Command Center (weekly calendar — the daily driver, deserves top billing)
  ├── Pipeline (Kanban board — current Posts > Pipeline)
  ├── Ideas (current Posts > Ideas)
  ├── Knowledge (current Knowledge > AI Brain dashboard)
  ├── Transcripts (current Knowledge > Transcripts)
  ├── Autopilot (current Posts > Autopilot)
  └── Library (templates + styles)
```

This restores the end-to-end pipeline view and puts the most-used daily tool (Command Center) first.

---

### §5 — Brand Kit Split Between Wizard and Settings (MEDIUM)

#### What the duplication is

Brand/business context is configured in two completely different places:

| Location | What it configures | Table | Fields |
|----------|--------------------|-------|--------|
| **Wizard Step 1** (`ContextStep`) | Business description, type, pain points, processes, tools, FAQs, results, credibility markers | `brand_kits` | `business_description`, `business_type`, `credibility_markers`, `urgent_pains`, `templates`, `processes`, `tools`, `frequent_questions`, `results`, `success_example` |
| **Settings > Branding** | Logo, theme, colors, fonts, testimonials, next steps, homepage URL | `brand_kits` | `logo_url`, `logos`, `default_theme`, `default_primary_color`, `default_background_style`, `font_family`, `font_url`, `default_testimonial`, `default_steps` |

Both write to the same `brand_kits` table but manage completely different columns. A new user's first brand setup happens in the wizard (Step 1), but visual branding lives in Settings. There's no indication in either place that the other exists.

#### Files involved

| File | Role |
|------|------|
| `src/components/wizard/steps/ContextStep.tsx` | Wizard brand/business context |
| `src/components/settings/BrandingSettings.tsx` | Visual branding settings (6 accordion cards) |
| `src/components/settings/FunnelTemplateSettings.tsx` | Default funnel template setting |
| `src/components/settings/WhiteLabelSettings.tsx` | White label settings |
| `src/app/api/brand-kit/route.ts` | Brand kit CRUD (both use this) |

#### Recommendation: **CONSOLIDATE** into Settings > Branding

Move the business context fields (description, type, pain points, etc.) into Settings > Branding as a new section. The wizard should read from this data (pre-populating Step 1) rather than being the primary editor. First-time users get an onboarding flow that saves to Settings; returning users edit in one place.

---

### §6 — Team Members in Two Places (MEDIUM)

#### What the duplication is

| Location | What it shows | Capabilities |
|----------|--------------|-------------|
| **Settings > Account > Team** (`/settings/account#team`) | Team member list (email, role) | Invite, remove |
| **Team page** (`/team`) | Full team management with profiles | Create teams, manage profiles (name, bio, expertise, LinkedIn, voice profile), invite, remove |

The Settings page has a simplified "Team Members" section that duplicates the invite/remove functionality of the full `/team` page. Both manage the same `teams`/`team_memberships` data, but the `/team` page is far more capable (profile editing, voice profiles, LinkedIn URLs, team creation).

#### Files involved

| File | Role |
|------|------|
| `src/components/settings/AccountSettings.tsx` | Contains TeamMembersSettings section |
| `src/app/(dashboard)/team/page.tsx` | Full team management page |

#### Recommendation: **REMOVE** the Settings duplicate

Remove the Team Members section from `/settings/account`. Add a prominent link from Settings to the `/team` page instead. One canonical location for team management.

---

### §7 — Integration Config: Account-Level vs Per-Funnel (LOW)

#### What the duplication is

Integration setup requires TWO separate configuration steps that happen in different parts of the app:

1. **Account-level**: Connect API key/OAuth in Settings > Integrations
2. **Per-funnel**: Enable + configure (list, tags, campaign) in Funnel Builder > Integrations tab

This applies to: Email Marketing (Kit, MailerLite, Mailchimp, ActiveCampaign), GoHighLevel, HeyReach, and Kajabi.

#### Why this matters

A user who connects an integration in Settings might expect it to "just work" on all funnels. Instead, they must navigate to each funnel's builder and explicitly enable it there. There's no indication in Settings that per-funnel setup is needed, and no link from the funnel builder to Settings for initial setup.

#### Recommendation: **KEEP BOTH** but add cross-navigation

This two-level config is architecturally correct (account credentials vs per-funnel mapping). The fix is UX, not structure:

1. In Settings > Integrations: add "Connected to X funnels" count + link to each funnel's builder
2. In Funnel Builder > Integrations tab: if a provider isn't connected, show "Connect in Settings →" link instead of a disabled toggle
3. After connecting a new integration in Settings, show a prompt: "Enable this on your funnels? [Go to funnels]"

---

### §8 — Dead-End and Legacy Routes (MEDIUM)

#### What exists

| Route | Current behavior | Status |
|-------|-----------------|--------|
| `/library` | Permanent redirect → `/magnets` | **Dead** — legacy route, nav item removed |
| `/library/[id]` | Permanent redirect → `/magnets/[id]` | **Dead** |
| `/library/[id]/funnel` | Permanent redirect → `/magnets/[id]?tab=funnel` | **Dead** |
| `/content` | Permanent redirect → `/knowledge` | **Dead** — legacy content pipeline |
| `/swipe-file` | Permanent redirect → `/posts?tab=inspiration` | **Dead** (and `?tab=inspiration` doesn't match any real tab — the actual tabs are pipeline, calendar, ideas, library, autopilot) |
| `/catalog` | Accessible but not in nav | **Orphaned** — lead magnet catalog browsing |
| `/analytics` | Accessible but not in nav | **Hidden** — full analytics dashboard exists but is unreachable from nav |
| `/analytics/email` | Sub-page | **Hidden** |
| `/analytics/engagement` | Sub-page | **Hidden** |
| `/analytics/funnel/[id]` | Sub-page | **Hidden** |
| `/assets` | Accessible but not in nav | **Hidden** — asset management hub |
| `/settings/account#billing` | Half-implemented | **Stub** — shows plan info + usage but no upgrade button |
| `/settings/developer#docs` | One paragraph + link | **Stub** |

#### Recommendation: **CLEAN UP**

1. Remove redirect routes (`/library`, `/content`, `/swipe-file`) — they've served their migration purpose
2. Fix `/swipe-file` redirect target (currently points to nonexistent tab)
3. Either add Analytics to nav or fold analytics data into relevant pages (funnel analytics → lead magnet detail, email analytics → email section, etc.)
4. Either add `/assets` to nav or fold libraries/external resources into the Lead Magnets section
5. Complete or remove the billing stub in `/settings/account`

---

### §9 — Assets Hub Is Invisible (MEDIUM)

#### What the duplication is

The `/assets` route is a management hub for Libraries and External Resources. These are accessible via:

1. **"Create New" dropdown** → Library (`/assets/libraries/new`) or External Resource (`/assets/external/new`)
2. **Direct URL** → `/assets` (but no nav item points here)
3. **Funnel pages list** → library/external funnels appear on `/pages`

Libraries and external resources are types of "things with funnels" alongside lead magnets. But lead magnets have a prominent nav item while libraries/external resources are discoverable only through the Create New dropdown.

#### Files involved

| File | Role |
|------|------|
| `src/app/(dashboard)/assets/page.tsx` | Assets hub page |
| `src/app/(dashboard)/assets/libraries/new/page.tsx` | New library creation |
| `src/app/(dashboard)/assets/libraries/[id]/page.tsx` | Library detail |
| `src/app/(dashboard)/assets/libraries/[id]/funnel/page.tsx` | Library funnel builder |
| `src/app/(dashboard)/assets/external/new/page.tsx` | New external resource |
| `src/app/(dashboard)/assets/external/[id]/funnel/page.tsx` | External resource funnel |

#### Recommendation: **FOLD** into Lead Magnets section

Since all three types (lead magnets, libraries, external resources) share the same funnel system, present them in a unified view:

```
Lead Magnets (nav item) → /magnets
  ├── Tab: Lead Magnets (current list)
  ├── Tab: Libraries (current /assets/libraries)
  └── Tab: External Resources (current /assets/external)
```

Or add "Libraries" and "External Resources" as filter options on the existing Lead Magnets list. The FunnelBuilder already handles all three `target_type` values seamlessly.

---

### §10 — Three "People" Nav Items (HIGH)

#### What the duplication is

Three separate nav items all deal with people/contacts:

| Nav Item | Route | Population | Primary Use |
|----------|-------|-----------|-------------|
| **Leads** | `/leads` | Funnel opt-ins | "Who converted?" |
| **Signals** | `/signals` | LinkedIn discoveries | "Who shows intent?" |
| **Email** | `/email/*` | Newsletter subscribers + campaigns | "Who am I emailing?" |

These three populations overlap significantly (see §3) and represent different stages of the same person's journey: discovered → engaged → opted in → subscribed.

#### Why this is confusing

A user thinking "show me my contacts" must check three different pages. There's no unified view of "all people who have interacted with my brand." The journey from Signal Lead → Funnel Lead → Email Subscriber is invisible — you'd need to manually search the same email across three different tables.

#### Recommendation: **GROUP** under unified "Audience" section

```
Audience (nav item) → /audience
  ├── Overview (deduplicated contacts, merged view)
  ├── Funnel Leads (current /leads — attribution + qualification)
  ├── Signal Leads (current /signals — LinkedIn discovery)
  └── Email (campaigns: flows + broadcasts, NO subscribers tab)
```

The subscribers list becomes a filtered view of the unified contacts. Email section focuses purely on campaigns (flows + broadcasts).

---

### §11 — "Automations" Naming and Scope (LOW)

#### What the duplication is

"Automations" (`/automations`) exclusively manages LinkedIn comment detection and auto-responses. The name suggests a broader automation platform (Zapier-like workflows, multi-step automations) but it only handles:

- Monitor specific LinkedIn posts for comments
- Keyword matching on comments
- Auto-like, auto-reply, push to HeyReach DM
- Enrich + push to PlusVibe cold email

Meanwhile, the **Signal Engine** (`/signals`) does similar LinkedIn monitoring but at a broader scale (keyword searches, company pages, profile engagement). There's conceptual overlap: both watch LinkedIn for engagement signals and take actions on matching leads.

#### Files involved

| File | Role |
|------|------|
| `src/app/(dashboard)/automations/page.tsx` | LinkedIn automations page |
| `src/app/(dashboard)/signals/page.tsx` | Signal engine page |
| `src/components/automations/` | Automation editor, events drawer |
| `src/components/signals/` | Signal leads table, detail drawer |

#### Recommendation: **MERGE** into Signals

LinkedIn Automations are effectively "post-level signal monitors with auto-actions." Fold them into the Signal Engine as a "Post Monitors" tab:

```
Signals (nav item) → /signals
  ├── Leads (current signal leads table)
  ├── Keywords (current keyword monitors)
  ├── Companies (current company monitors)
  ├── Profiles (current profile monitors)
  └── Post Monitors (current /automations — per-post comment tracking)
```

This unifies all LinkedIn monitoring under one roof.

---

### §12 — Analytics Scattered Across Multiple Surfaces (MEDIUM)

#### What the duplication is

Analytics data appears in at least 4 different places:

| Location | What it shows | Route |
|----------|--------------|-------|
| **Home dashboard** | `/` | Summary stats (total leads, views, conversion rate) |
| **Lead magnet detail** | `/magnets/[id]?tab=analytics` | Per-magnet analytics (views, leads, conversion) |
| **Analytics pages** | `/analytics`, `/analytics/funnel/[id]`, `/analytics/email`, `/analytics/engagement` | Full analytics dashboards — but **not in nav** |
| **Posts pipeline** | `/posts?tab=pipeline` | Post performance stats |
| **Email broadcasts** | `/email/broadcasts/[id]` | Broadcast send/open/click metrics |

The dedicated `/analytics` section is fully built with Recharts dashboards but unreachable from navigation. Meanwhile, analytics fragments appear inline on other pages.

#### Recommendation: **SURFACE** analytics in nav or consolidate inline

Option A: Add "Analytics" to the nav and make it the single analytics destination:
```
Analytics (nav item) → /analytics
  ├── Overview (current home dashboard metrics, expanded)
  ├── Funnels (per-funnel conversion metrics)
  ├── Content (post performance, engagement)
  └── Email (broadcast/flow metrics)
```

Option B: Remove the standalone `/analytics` pages and strengthen inline analytics on each feature page (lead magnet detail, posts pipeline, email section). This avoids another nav item.

---

### §13 — "Create New" Dropdown Duplicates Nav Items (LOW)

#### What the duplication is

The "Create New" dropdown in the sidebar offers:

| Dropdown Option | Route | Also Reachable Via |
|----------------|-------|-------------------|
| Lead Magnet | `/create` | Clicking "Lead Magnets" nav → then "New" button |
| Landing Page | `/pages/new` | Clicking "Pages" nav → then "New" button |
| Post | `/posts?quick_write=1` | Clicking "Posts" nav → then "New Post" FAB |
| Library | `/assets/libraries/new` | Not reachable from nav (assets not in nav) |
| External Resource | `/assets/external/new` | Not reachable from nav (assets not in nav) |

The first three duplicate actions available from their respective nav items. The last two are the ONLY way to create libraries/external resources (since `/assets` isn't in nav).

#### Recommendation: **STREAMLINE**

Keep the Create New dropdown but:
1. If Lead Magnets and Pages merge (§1), the dropdown simplifies to: "Lead Magnet", "Library", "External Resource", "Post"
2. If Libraries/External Resources fold into Lead Magnets (§9), the dropdown simplifies further to: "Lead Magnet", "Post"
3. The dropdown remains useful as a quick-action shortcut — duplication is acceptable here as long as the nav structure is clean

---

## Cross-Cutting Observations

### Navigation Density Problem

The current sidebar has **11 main nav items** (Home, Lead Magnets, Pages, Knowledge, Posts, Automations, Leads, Signals, Email, Team) plus 3 bottom items (Docs, Help, Settings) and Admin. This is too many top-level concepts for what is fundamentally a 3-concern product:

1. **Content** (create lead magnets, write posts, manage knowledge, schedule)
2. **Distribution** (funnels/pages, email campaigns, LinkedIn automations)
3. **Audience** (leads, subscribers, signal leads)

### Proposed Simplified Navigation

Based on all findings above:

```
Main Nav (7 items, down from 11):
  1. Home           → /                    (dashboard overview)
  2. Lead Magnets   → /magnets             (magnets + libraries + external resources)
  3. Content        → /content             (pipeline, calendar, ideas, knowledge, transcripts, autopilot)
  4. Audience       → /audience            (all contacts, funnel leads, signal leads)
  5. Signals        → /signals             (LinkedIn monitoring + post automations)
  6. Email          → /email               (flows + broadcasts, NO subscribers tab)
  7. Team           → /team                (team management + command center)

Bottom Nav (3 items, unchanged):
  Docs, Help, Settings
```

This reduces cognitive load while preserving all functionality. Every page still exists — it's just organized under fewer, clearer top-level categories.

### Data Model Fragmentation

The biggest architectural issue underlying the UI confusion is **4 separate "people" tables** (`funnel_leads`, `email_subscribers`, `signal_leads`, `engagement_enrichments`) with no unified identity layer. Long-term, consider a `contacts` table that serves as a unified identity with foreign keys from each source table. This would enable the "Audience" unified view recommended in §3 and §10.

---

## Implementation Priority

If addressing these in phases:

### Phase A — Quick wins (nav reorganization, no schema changes)
- Remove "Pages" from nav, redirect `/pages` → `/magnets` (§1)
- Reunify Knowledge + Posts into "Content" (§4)
- Remove dead routes (§8)
- Surface Analytics in nav OR remove standalone analytics pages (§12)

### Phase B — Medium effort (component restructuring)
- Consolidate brand settings (§5)
- Remove team members from Settings (§6)
- Add cross-navigation for integrations (§7)
- Fold Assets into Lead Magnets (§9)

### Phase C — Larger effort (schema + data flow changes)
- Merge wizard posts into `cp_pipeline_posts` (§2)
- Build unified Contacts/People view (§3, §10)
- Merge Automations into Signals (§11)
