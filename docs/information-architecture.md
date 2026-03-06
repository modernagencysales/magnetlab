# MagnetLab Information Architecture Redesign

> Phase 2 — Information Architecture | No code changes
> Extends: `/docs/ui-audit.md`, `/docs/feature-overlap-audit.md`, `/docs/wizard-redesign.md`

---

## Context: Why This Redesign

MagnetLab has 10 primary nav items and users don't know where to start. The current navigation organizes around **output types** (Lead Magnets, Pages, Knowledge, Posts, Leads, Signals, Email...), but the product's value prop is a pipeline: **ingest expertise → build assets → distribute → capture audience**. The nav doesn't reflect this pipeline. Specific problems:

1. **No starting point** — Knowledge feels like a side feature, not the engine that powers everything else
2. **Brain → Asset relationship invisible** — Users don't see that their transcripts/knowledge directly fuel lead magnet creation and post writing
3. **Distribution mixed with creation** — Posts (distribution) sits between Knowledge (creation input) and Leads (output)
4. **Three "people" sections** — Leads, Signals, and Email > Subscribers are three views of the same audience
5. **Pages is redundant** — Every funnel page belongs to a lead magnet; `/pages` duplicates `/magnets`
6. **Automations is misnamed and orphaned** — It only handles LinkedIn comment monitoring but its name implies broader scope

---

## Design Decision: 6 Primary Nav Items

After evaluating 5-item and 6-item structures, **6 items is the right number**. Here's why:

- **5 items** requires merging Email into Content. Email campaigns (flows with multi-step builders, broadcasts with HTML editors) are operationally distinct from LinkedIn posts. Cramming both into one section creates 7+ tabs with nested sub-tabs — more confusing than a separate nav item.
- **6 items** gives each section a clear, single responsibility. Every section has 2-5 tabs max. No tabs-within-tabs.
- **7+ items** is where cognitive load spikes. Each additional top-level item makes the whole nav feel like a wall of text.

---

## The New Navigation

```
┌─────────────────────────┐
│  [Logo] MagnetLab       │
│                         │
│  + Create New ▾         │
│                         │
│  ● Home                 │
│  🧠 Brain               │
│  🧲 Lead Magnets        │
│  📝 Content             │
│  ✉️ Email               │
│  👥 Audience            │
│                         │
│  ─────────────────────  │
│  👥 Team                │
│  ⚙️ Settings            │
│  📚 Help                │
│                         │
│  [User avatar] Sign out │
└─────────────────────────┘
```

The order follows the user's workflow: **Brain → Build → Distribute → Results**

| # | Label | Route | Mental Model Role | What Lives Here |
|---|-------|-------|-------------------|-----------------|
| 1 | Home | `/` | Dashboard | Overview stats, recent activity, this week's AI suggestions |
| 2 | Brain | `/brain` | **Input** — intelligence center | Transcripts, Knowledge base, Topics, Ideas, Gap analysis |
| 3 | Lead Magnets | `/magnets` | **Assets** — things built from the brain | Magnets, Libraries, External Resources (each with funnels) |
| 4 | Content | `/content` | **Distribution** — LinkedIn publishing | Command Center, Pipeline, Calendar, Autopilot, Templates |
| 5 | Email | `/email` | **Distribution** — email campaigns | Flows (sequences), Broadcasts |
| 6 | Audience | `/audience` | **Results** — who came back | All contacts, Funnel leads, Signals + monitoring |

**Bottom nav:** Team, Settings, Help (+ Admin for super-admins)

---

## Each Nav Item in Detail

### 1. Home (`/`)

**What it is:** Dashboard overview. The first thing you see after login.

**Pages/views:**
- Summary stats cards (total leads, views, conversion rate, active funnels)
- Recent activity feed (new leads, post performance, transcript processing)
- This week's AI suggestions — surfaced from `cp_content_ideas` where `content_type = 'lead_magnet'`
- Quick actions (Create Lead Magnet, Add Transcript, Write Post)

**What maps here from current app:**
- Current `/` dashboard (stays as-is, enhanced with AI suggestions)

**Available actions:**
- View stats
- Click through to any section
- Create lead magnet from AI suggestion

**Rationale:** Home stays. It's the orientation point. The only change is surfacing AI suggestions to connect Brain intelligence to the dashboard.

---

### 2. Brain (`/brain`)

**What it is:** The intelligence center. Where all expertise lives, gets organized, and generates ideas. This is the **heart of the product** — every other section draws from it.

**Pages/views (5 tabs):**

| Tab | Content | Maps From |
|-----|---------|-----------|
| **Overview** | Stats, highlights, active topics, quality scores | `/knowledge` (KnowledgeDashboard > Overview subtab) |
| **Transcripts** | Upload, list, reprocess transcripts | `/knowledge?tab=transcripts` |
| **Knowledge** | Search + browse entries by type/topic, quality stars | `/knowledge` (KnowledgeDashboard > Search subtab) |
| **Topics** | Topic taxonomy, gap analysis, readiness assessment | `/knowledge` (KnowledgeDashboard > Topics + Gaps subtabs) |
| **Ideas** | Content ideas extracted from transcripts, "Write Post" action | `/posts?tab=ideas` |

**Available actions:**
- Upload/paste transcript → triggers `process-transcript` background job
- Search knowledge by keyword, type, topic, quality
- Browse topic taxonomy, view gap analysis
- Generate topic summary
- Click "Write Post" on an idea → navigates to Content > Pipeline with post pre-filled
- Click "Create Lead Magnet" on an idea → opens creation dialog on `/magnets`
- Ask the AI Brain a question (existing "Ask" feature)

**Why Ideas live in Brain, not Content:**
1. Ideas are **generated by the brain** — they're extracted from transcripts during `process-transcript`. They represent intelligence, not content.
2. Seeing ideas appear in Brain makes the section feel **alive and productive** — "your brain is generating things for you."
3. The action of consuming an idea ("Write Post") bridges Brain → Content via a single click. Cross-section navigation is normal.
4. If Ideas were in Content, Brain would become just Transcripts + Knowledge — a passive library instead of an active intelligence engine.
5. The user explicitly asked Brain to feel like the **center** of the product. Ideas flowing from Brain reinforce this.

**What moves here:**
- Everything from `/knowledge` (both tabs: AI Brain dashboard + Transcripts)
- Ideas tab from `/posts?tab=ideas`

**Technical mapping:**
- `/brain` → new route, renders `BrainContent` component
- `BrainContent` reuses: `KnowledgeDashboard` (Overview, Topics, Gaps → merged as Overview + Topics), `KnowledgeSearch` (→ Knowledge tab), transcript list (→ Transcripts tab), `IdeasTab` (→ Ideas tab)
- Default tab: Overview (the brain dashboard is the first thing you see)

---

### 3. Lead Magnets (`/magnets`)

**What it is:** All assets built from your expertise. Lead magnets are the core asset; libraries and external resources are secondary asset types that share the same funnel system.

**Pages/views:**

| View | Content | Maps From |
|------|---------|-----------|
| **List** | All lead magnets with status, conversion rate, funnel badge. Filter/tabs for Libraries and External Resources. | `/magnets` + `/pages` + `/assets` |
| **Workspace** (`/magnets/[id]`) | 5-tab detail view: Content, Posts, Funnel, Leads, Analytics | `/magnets/[id]` (enhanced per wizard-redesign.md) |
| **Creation dialog** | Lightweight modal on list page (per wizard-redesign.md) | `/create` wizard (replaced) |
| **Full-page ideation** | AI concept generation overlay (per wizard-redesign.md) | `/create` wizard Step 2 (refactored) |
| **Library detail** (`/magnets/libraries/[id]`) | Library items + funnel | `/assets/libraries/[id]` |
| **External resource detail** | External resource + funnel | `/assets/external/[id]` |

**Available actions:**
- Create lead magnet (dialog or AI ideation)
- Create library or external resource
- Open workspace (Content, Posts, Funnel, Leads, Analytics tabs)
- Build/edit funnel inline
- Generate posts for a lead magnet
- Send posts to Content pipeline
- View per-magnet leads and analytics

**What merges here:**
- `/pages` — eliminated as a standalone section. Every funnel page is accessed via its parent lead magnet's Funnel tab.
- `/assets` — libraries and external resources surface as filtered views on the Lead Magnets list (or as sub-tabs: "Magnets | Libraries | External")
- `/create` — wizard replaced by creation dialog + workspace (per wizard-redesign.md)

**Key detail:** The list page shows ALL asset types with a filter/tab selector:
```
Lead Magnets (list page)
┌─ All ─┬─ Lead Magnets ─┬─ Libraries ─┬─ External ─┐
│                                                      │
│  [Lead magnet cards with status, conversion, etc.]   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

This replaces three separate routes (`/magnets`, `/pages`, `/assets`) with one unified view.

---

### 4. Content (`/content`)

**What it is:** Daily LinkedIn publishing operations. Where you manage, schedule, and publish posts. The Command Center is the daily driver for teams.

**Pages/views (5 tabs):**

| Tab | Content | Maps From |
|-----|---------|-----------|
| **Command Center** | Weekly team calendar — profile × day grid | `/posts` (buried inside PostsContent, now promoted to first tab) |
| **Pipeline** | Kanban board (draft → reviewing → approved → scheduled → published) | `/posts?tab=pipeline` (was default tab) |
| **Calendar** | Month view of scheduled posts | `/posts?tab=calendar` |
| **Autopilot** | Auto-generation config, buffer status | `/posts?tab=autopilot` |
| **Library** | Post templates + writing styles | `/posts?tab=library` |

**Available actions:**
- Write a post (QuickWriteModal)
- Review/approve/reject posts
- Schedule posts to specific dates/times
- Broadcast a post to team members (AI voice adaptation)
- Run autopilot to fill buffer
- Manage posting slots
- Create/edit templates and writing styles
- Detect content collisions across team

**What moves here:**
- Everything from `/posts` except Ideas (Ideas → Brain)
- Command Center promoted from buried tab to first tab

**What does NOT live here:**
- Ideas tab → moved to Brain
- Email campaigns → separate Email section
- Lead magnet post generation → lives in Lead Magnets workspace Posts tab (bridge via "Send to Content Pipeline" button)

**Why Command Center is the first tab:**
For team accounts, the Command Center (weekly profile × day grid) is the most-used daily interface. It deserves first billing — you open Content and immediately see what's publishing this week across all team members. Solo users still benefit since it shows their own posting calendar.

---

### 5. Email (`/email`)

**What it is:** Email campaign management. Flows (automated sequences) and Broadcasts (one-time sends).

**Pages/views (2 tabs):**

| Tab | Content | Maps From |
|-----|---------|-----------|
| **Flows** | Email sequence builder, list of flows, per-flow editor | `/email/flows` |
| **Broadcasts** | Broadcast list, editor, send/schedule | `/email/broadcasts` |

**Available actions:**
- Create/edit email flows (multi-step sequence builder)
- Generate newsletter email from today's approved post
- Create/send/schedule broadcasts
- View broadcast metrics (opens, clicks, bounces)

**What moves OUT of Email:**
- **Subscribers tab** → eliminated from Email. Subscriber data merges into Audience. Email is about campaigns, not people management.

**Why Email is separate from Content:**
1. Email campaigns have fundamentally different editors (flow builder with conditional steps, broadcast HTML editor) vs. LinkedIn posts (text with optional images)
2. Email has its own lifecycle (flows trigger automatically on lead capture, broadcasts are manually scheduled/sent)
3. Merging Email into Content would create 7+ tabs — more cognitive load than a separate nav item
4. Email and LinkedIn serve different audience segments with different cadences

**Why Email loses its Subscribers tab:**
Subscribers are people, not campaigns. Managing who's on your list is an Audience concern. The Email section focuses purely on what you're sending, not who you're sending to. When creating a broadcast, you select audience segments — but the segment definition lives in Audience.

---

### 6. Audience (`/audience`)

**What it is:** Everyone who has interacted with your brand. The results of your distribution efforts. View-only and management-oriented — you monitor and manage your audience here, you don't create content.

**Pages/views (3 tabs):**

| Tab | Content | Maps From |
|-----|---------|-----------|
| **Contacts** | Deduplicated view of all people across all sources (funnel leads, email subscribers, signal leads). Merged by email. | New unified view |
| **Leads** | Funnel opt-in leads with conversion attribution, UTM data, qualification status | `/leads` |
| **Signals** | LinkedIn signal monitoring dashboard: discovered leads, keyword/company/profile monitors config | `/signals` + `/automations` + `/settings/signals` |

**Available actions:**
- View all contacts with source attribution
- Filter by source (funnel, signal, email, import, reply, etc.)
- Export contacts to CSV
- View individual contact detail (cross-source: funnel history + email status + signal events)
- Configure signal monitors (keywords, companies, profiles) inline
- View signal lead detail with event timeline
- Bulk actions on signal leads (exclude, push to HeyReach)

**What merges here:**
- `/leads` → Audience > Leads tab
- `/signals` → Audience > Signals tab (includes signal leads table + monitor configuration)
- `/automations` → Audience > Signals tab (LinkedIn post comment automations merge into signal monitoring per feature-overlap-audit.md §11)
- `/email/subscribers` → Audience > Contacts tab (subscribers are contacts, not an email concept)
- `/settings/signals` → Audience > Signals tab (monitor config accessible inline, not buried in Settings)

**Why Automations merge into Signals:**
LinkedIn Automations are effectively "post-level signal monitors with auto-actions." Both monitor LinkedIn engagement, both discover leads, both can push to HeyReach. The only difference is scope: Automations watch specific posts, Signals watch keywords/companies/profiles. They belong together under one "LinkedIn monitoring" umbrella.

**Why Signal config moves out of Settings:**
When reviewing signal leads, the natural next action is "let me adjust my monitors." Having to navigate to Settings > Signals breaks this flow. Inline configuration (or a prominent "Configure Monitors" button opening a panel) keeps the user in context.

**What about Analytics?**
Analytics does NOT get its own section. Instead:
- **Home dashboard**: Overview stats (total leads, views, conversion rate)
- **Lead Magnet workspace > Analytics tab**: Per-magnet analytics
- **Content > Pipeline**: Post performance inline
- **Email > Broadcasts**: Broadcast metrics inline
- The standalone `/analytics` pages (currently hidden from nav) are deprecated — their data surfaces inline on relevant pages

---

## Bottom Navigation

### Team (`/team`)

Team management moves to bottom nav. It's important for team accounts but not a daily-use section for most users.

**Contains:** Team creation, member invites, profile management (name, bio, expertise, LinkedIn, voice profile). Team LinkedIn connection management.

**What moves here:** The Team Members section currently duplicated in Settings > Account is removed (per feature-overlap-audit.md §6). `/team` is the single canonical location.

### Settings (`/settings`)

**Contains:**
- Account (profile, username, subscription/billing)
- Branding (logo, theme, fonts, testimonials, next steps + business context fields consolidated from wizard)
- Integrations (LinkedIn, Resend, email marketing providers, CRM, HeyReach, Fathom, tracking pixels, webhooks)
- Co-pilot (AI memory/preferences management)
- Developer (API keys, webhooks, docs)

**What changes:**
- Brand kit business context fields (description, type, pain points, etc.) consolidated into Settings > Branding (from wizard ContextStep — per feature-overlap-audit.md §5)
- Signal config (ICP, monitors) moves OUT of Settings → into Audience > Signals
- Team Members section removed from Settings > Account (canonical location is `/team`)

### Help (`/help`)

**Contains:** CEO guide, troubleshooting, docs. Unchanged.

### Admin (`/admin`) — Super-admin only

**Contains:** Prompt management, learning dashboard. Unchanged.

---

## "Create New" Dropdown

Simplified from 5 items to 4:

| Item | Route | Notes |
|------|-------|-------|
| Lead Magnet | Opens creation dialog on `/magnets` | Per wizard-redesign.md |
| Quick Landing Page | `/create/page-quick` | Simplified funnel creation without full lead magnet |
| Post | Opens QuickWriteModal on `/content` | Fast post creation |
| Library | Opens creation flow on `/magnets` (libraries sub-tab) | Secondary asset type |

"External Resource" drops from the dropdown — it's a niche feature accessible from the Lead Magnets list page via a secondary action.

---

## Old → New Mapping

Every current nav item gets a definitive disposition:

| Current Nav Item | Disposition | New Location | Rationale |
|------------------|-------------|-------------|-----------|
| **Home** | **Stays** | Home | Dashboard overview is universal |
| **Lead Magnets** | **Stays + Expands** | Lead Magnets | Absorbs Pages, Assets, and the creation wizard |
| **Pages** | **Eliminated** | Lead Magnets > Funnel tab | Every page belongs to a lead magnet/library/resource. No standalone page management needed. `/pages` redirects to `/magnets`. |
| **Knowledge** | **Promoted + Renamed** | Brain | Promoted from "Knowledge" (sounds passive) to "Brain" (sounds active, central). Gains Ideas tab from Posts. |
| **Posts** | **Renamed + Reorganized** | Content | Renamed from "Posts" (output-type thinking) to "Content" (workflow thinking). Loses Ideas to Brain. Command Center promoted to first tab. |
| **Automations** | **Merged** | Audience > Signals | LinkedIn comment automations are a subset of signal monitoring. Merging reduces nav clutter and unifies all LinkedIn monitoring. |
| **Leads** | **Merged** | Audience > Leads | Leads are one view of your audience. Unified Audience section with tabs. |
| **Signals** | **Merged** | Audience > Signals | Combined with Automations. Gains inline monitor config from Settings > Signals. |
| **Email** | **Stays − Subscribers** | Email | Keeps Flows and Broadcasts. Loses Subscribers tab (subscribers → Audience > Contacts). |
| **Team** | **Demoted** | Bottom nav | Important but not daily-use for most users. Canonical team management location. |
| **Settings** | **Stays** | Bottom nav | Unchanged position. Internal reorganization (brand kit consolidation, signal config removal). |
| **Help/Docs** | **Stays** | Bottom nav | Unchanged. |
| **Admin** | **Stays** | Bottom nav (conditional) | Super-admin only. Unchanged. |

---

## Route Mapping

| Current Route | New Route | Redirect? |
|---------------|-----------|-----------|
| `/` | `/` | No change |
| `/magnets` | `/magnets` | No change |
| `/magnets/[id]` | `/magnets/[id]` | No change (enhanced workspace) |
| `/pages` | `/magnets` | Permanent redirect |
| `/pages/new` | `/magnets?create=quick` | Permanent redirect |
| `/knowledge` | `/brain` | Permanent redirect |
| `/posts` | `/content` | Permanent redirect |
| `/posts?tab=ideas` | `/brain?tab=ideas` | Permanent redirect |
| `/posts?tab=pipeline` | `/content?tab=pipeline` | Permanent redirect |
| `/posts?tab=calendar` | `/content?tab=calendar` | Permanent redirect |
| `/posts?tab=autopilot` | `/content?tab=autopilot` | Permanent redirect |
| `/posts?tab=library` | `/content?tab=library` | Permanent redirect |
| `/automations` | `/audience?tab=signals` | Permanent redirect |
| `/leads` | `/audience?tab=leads` | Permanent redirect |
| `/signals` | `/audience?tab=signals` | Permanent redirect |
| `/email/flows` | `/email/flows` | No change |
| `/email/broadcasts` | `/email/broadcasts` | No change |
| `/email/subscribers` | `/audience?tab=contacts` | Permanent redirect |
| `/team` | `/team` | No change (position in nav changes) |
| `/create` | `/magnets?create=1` | Permanent redirect |
| `/assets` | `/magnets?filter=all` | Permanent redirect |
| `/assets/libraries/[id]` | `/magnets/libraries/[id]` | Permanent redirect |
| `/assets/external/[id]` | `/magnets/external/[id]` | Permanent redirect |
| `/content` (legacy) | `/brain` | Update existing redirect |
| `/library` (legacy) | `/magnets` | Keep existing redirect |
| `/swipe-file` (legacy) | `/content` | Fix broken redirect |
| `/analytics` | Deprecated | Remove route |
| `/catalog` | Deprecated | Remove route |
| `/settings/signals` | `/audience?tab=signals` | Redirect or cross-link |

---

## Key Design Decisions & Rationale

### Decision 1: "Brain" not "Knowledge"

"Knowledge" sounds like a library — static, passive, something you look up. "Brain" sounds alive — it thinks, generates ideas, learns from new inputs. The product's AI Brain feature is already named this way internally (`KnowledgeDashboard`, `searchKnowledgeV2`, `cp_knowledge_entries`). The nav should match the brand.

"Brain" also signals to new users that this is where the AI magic lives. "Knowledge" sounds like documentation. "Brain" sounds like an engine.

### Decision 2: Brain gets Ideas (moved from Posts)

Ideas are intelligence generated by the Brain, not content waiting to be published. The brain extracts them from transcripts. They represent "what your expertise can become." Their natural home is the Brain.

The workflow bridge: clicking "Write Post" on an idea navigates to Content > Pipeline with the idea's topic pre-filled. Clicking "Create Lead Magnet" on an idea opens the creation dialog with the idea's data pre-filled. Brain feeds everything downstream.

### Decision 3: Command Center promoted to first Content tab

The Command Center (weekly profile × day calendar) is the single most-used daily interface for team accounts. It was buried as a subtab inside Posts. Promoting it to the first tab in Content means it's what you see when you click Content — your week at a glance.

Pipeline (the former default) becomes the second tab. Users checking on post status are one click away.

### Decision 4: Email stays separate from Content

Despite both being "distribution," Email and LinkedIn posts have different:
- Editors (flow builder + HTML vs. text posts)
- Lifecycles (flows auto-trigger, posts are scheduled)
- Cadences (daily posts vs. weekly/ad-hoc emails)
- Audiences (subscriber list vs. LinkedIn feed)

Merging them would create a 7-tab Content section. Keeping them separate means Content has 5 tabs and Email has 2 — both manageable.

### Decision 5: Audience is results, not creation

The user said: "Leads/contacts are a result of distribution, not a creation tool." Audience reflects this. It's where you see who responded, who converted, who's engaging. The actions are monitoring and management (view, filter, export, push to HeyReach), not creation.

The only "creation" in Audience is configuring signal monitors — but even that is monitoring setup, not content creation.

### Decision 6: Signal config moves out of Settings

Signal monitoring configuration (ICP criteria, keyword monitors, company monitors) is currently buried in Settings > Signals. This forces a context switch: you're reviewing signal leads in `/signals`, you want to adjust a keyword, so you navigate to `/settings/signals`, make the change, then navigate back.

In the new structure, monitor config is accessible inline within Audience > Signals. A "Configure Monitors" button or dedicated sub-view keeps everything in context.

### Decision 7: Subscribers tab eliminated from Email

Subscribers are people. Managing your subscriber list is an Audience concern. Email focuses on campaigns (what you're sending), not contacts (who you're sending to). When creating a broadcast, you select segments from the Audience data — but the segment definition and contact management live in Audience.

### Decision 8: Team demoted to bottom nav

Team management (members, profiles, voice profiles, LinkedIn connections) is essential for team accounts but irrelevant for solo users. It's not a daily-use section even for teams — you set up your team once and occasionally adjust profiles.

The Command Center (daily team calendar) moves to Content, where it's used daily. The Team page keeps member/profile management in bottom nav, accessible but not taking prime sidebar real estate.

### Decision 9: No standalone Analytics section

Analytics fragments are more useful inline than consolidated. Each section surfaces its own metrics:
- Home: overview stats
- Lead Magnets: per-magnet conversion analytics
- Content: post performance
- Email: broadcast metrics
- Audience: lead acquisition trends

A standalone Analytics page requires context switching and mental mapping ("which section does this metric belong to?"). Inline analytics keep metrics adjacent to the things they measure.

The existing hidden `/analytics` pages are deprecated. If a unified analytics view is needed later, it can be added as a Home > Analytics subtab.

### Decision 10: Pages eliminated entirely

Every funnel page belongs to a parent entity (lead magnet, library, or external resource). The `/pages` route shows the same data as `/magnets` filtered to "has funnel." It adds no unique information.

In the new structure, funnels are always accessed through their parent:
- Lead magnet → `/magnets/[id]?tab=funnel`
- Library → `/magnets/libraries/[id]?tab=funnel`
- External resource → `/magnets/external/[id]?tab=funnel`

Users never need to think about "pages" as a separate concept from "lead magnets."

---

## What The User Sees: Before → After

### Before (10 items, output-type organization):
```
Home | Lead Magnets | Pages | Knowledge | Posts | Automations | Leads | Signals | Email | Team
```
"Where do I start? What's the difference between Pages and Lead Magnets? Where did my post go after the wizard? Why are my leads in three different places?"

### After (6 items, workflow organization):
```
Home | Brain | Lead Magnets | Content | Email | Audience
```
"Brain is my expertise. Lead Magnets are what I build from it. Content is how I publish. Email is how I nurture. Audience is who responded."

### The mental model in one sentence:
> **I feed my Brain → I build Lead Magnets → I publish Content and send Email → I grow my Audience**

---

## Migration Considerations

### Non-breaking approach (can ship incrementally):

**Phase 1: Route aliases + redirects**
- Create `/brain` as an alias for `/knowledge` with reorganized tabs
- Create `/content` as an alias for `/posts` with reorganized tabs
- Create `/audience` as a new page assembling Leads + Signals + Contacts
- Update `DashboardNav.tsx` to show new 6-item structure
- Add permanent redirects for old routes

**Phase 2: Component reorganization**
- Move `IdeasTab` from `PostsContent` to `BrainContent`
- Move `KnowledgeDashboard` from `/knowledge` to `/brain`
- Merge `SignalLeadsTable` + `AutomationEditor` into unified Audience > Signals view
- Build unified Contacts tab (deduplicated from `funnel_leads` + `email_subscribers` + `signal_leads`)
- Surface signal config inline in Audience > Signals

**Phase 3: Clean up**
- Remove `/pages` route (redirect to `/magnets`)
- Remove `/automations` route (redirect to `/audience?tab=signals`)
- Remove `/signals` route (redirect to `/audience?tab=signals`)
- Remove `/leads` route (redirect to `/audience?tab=leads`)
- Remove Subscribers tab from Email layout
- Remove `/analytics` standalone pages
- Remove dead legacy routes (`/library`, `/swipe-file`, `/catalog`)

### What is NOT affected:
- All API routes stay at their current paths (API ≠ UI)
- Database schema unchanged
- Public pages (`/p/[username]/[slug]`) unchanged
- External API routes unchanged
- Funnel builder unchanged
- All existing functionality preserved — this is purely a reorganization of how users navigate to it

---

## Verification Plan

1. **New user test**: Sign up → Brain is visible and prominent → user understands it's the starting point
2. **"Where did X go?" test**: Every current page is reachable within 2 clicks from the new nav
3. **Redirect test**: Every old route (`/knowledge`, `/posts`, `/leads`, `/signals`, `/automations`, `/pages`) correctly redirects to new location
4. **Workflow test**: Brain → find idea → create lead magnet → build funnel → generate posts → send to pipeline → schedule → check audience — all without dead ends or confusion
5. **Tab count test**: No section has more than 5 tabs. No nested tab bars.
6. **Mobile test**: 6 nav items + 3 bottom items render cleanly in mobile drawer
7. **Existing tests**: `npm run test` passes (no behavioral changes, only navigation restructuring)
