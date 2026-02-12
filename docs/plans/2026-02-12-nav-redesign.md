# MagnetLab Navigation & UX Redesign

## Problem

The current sidebar has 9 nav items with confusing organization:
- "Assets" hides funnels inside tabs, but funnels also live at Library/[id]/funnel
- "Content" bundles 6 sub-features (transcripts, knowledge, ideas, posts, schedule, buffer)
- "Catalog", "API Docs", and "Swipe File" take prime nav space for niche features
- "Library" isn't even in the sidebar — accessed via Dashboard quick actions
- No onboarding flow for new users
- No clear path connecting: create magnet -> build funnel -> publish -> capture leads

## Design Decisions

- Primary persona: solo creator, with power features accessible for teams
- Home page: action-oriented, journey-aware (not static stats dashboard)
- Funnels: owned by their magnet (tab), but also visible in a top-level Pages view
- Content pipeline: split into Knowledge (input) and Posts (output)
- Niche features: Catalog removed from normal nav (team-mode only), API Docs into Settings, Swipe File into Posts as "Inspiration" tab

## New Sidebar (6 items)

| # | Label      | Icon      | Route        | Purpose                                           |
|---|------------|-----------|--------------|---------------------------------------------------|
| 1 | Home       | Home      | /            | Journey-aware dashboard + onboarding checklist     |
| 2 | Lead Magnets | Magnet  | /magnets     | All magnets. Detail view has Funnel/Post/Leads tabs |
| 3 | Pages      | Globe     | /pages       | Birds-eye view of all published funnel pages       |
| 4 | Knowledge  | Brain     | /knowledge   | Transcripts + AI Brain (knowledge base)            |
| 5 | Posts      | PenTool   | /posts       | Ideas, drafts, schedule, autopilot + Inspiration   |
| 6 | Leads      | Users     | /leads       | Lead management (unchanged)                        |

Footer: Settings (icon), Theme toggle, Sign out

## Home Page (3 States)

### State 1: New User
- Welcome header
- Interactive walkthrough (driver.js tooltips on first login)
- Onboarding checklist:
  1. Set up Brand Kit -> Settings
  2. Create first lead magnet -> /create
  3. Build a funnel page -> unlocks after magnet saved
  4. Capture first lead -> unlocks after funnel published
  5. Write a LinkedIn post -> unlocks after content generated
- "How MagnetLab Works" explainer cards

### State 2: Active User
- Checklist with progress
- "Continue where you left off" card (most recent draft)
- Quick stats row (magnets, leads this week, views, posts scheduled)
- Contextual suggestions ("Magnet X has no funnel yet")

### State 3: Power User (checklist complete)
- Stats with trends
- Recent activity feed
- Quick actions

Checklist state stored as JSON in users table (`onboarding_progress` column).

## Lead Magnets Page (/magnets)

### List View (/magnets)
- Grid of magnet cards
- Each card: archetype badge, title, status pill (Draft/Published/Processing), inline stats (views, leads), action row (Edit Funnel | View Page | Post)
- "Create New" button

### Detail View (/magnets/[id])
Tabbed layout replacing 3 separate routes:
- **Overview** — title, concept, extracted content summary
- **Funnel** — funnel builder (moved from /library/[id]/funnel)
- **Post** — LinkedIn post variations + DM template
- **Leads** — leads captured through this magnet's funnel
- **Analytics** — views/engagement for this magnet

## Pages Page (/pages)

Birds-eye table of all funnel pages:
- Page URL (clickable)
- Linked magnet name (links to /magnets/[id])
- Status: Published / Draft
- Views + leads
- Last edited
- "Quick Create" button (moves from /create/page-quick)

## Knowledge Page (/knowledge)

Two tabs (split from /content):
- **Transcripts** — upload/paste, Grain/Fireflies webhooks, extraction status
- **AI Brain** — semantic search, browse insights, tag filtering

## Posts Page (/posts)

Four tabs (split from /content + absorbs Swipe File):
- **Ideas** — extracted ideas, scores, "Write Post" action
- **Drafts** — posts in progress, edit/polish/approve
- **Schedule** — posting slots, autopilot config, buffer queue
- **Inspiration** — swipe file (renamed), community posts

## Settings Changes

- Add **API Docs** tab (moved from top-level /docs)
- Add **Team** tab (absorbs /team, /team-select; Catalog accessed from here)
- Existing: Account, Billing, Brand Kit, Integrations

## Interactive Walkthrough

Library: driver.js (3KB, MIT)
Trigger: first login (flag: `onboarding_walkthrough_completed` on user record)

5 tooltip steps:
1. Create button — "Start here. Build your first lead magnet."
2. Lead Magnets — "Your magnets live here with funnels, posts, and leads."
3. Knowledge — "Upload call transcripts for AI expertise extraction."
4. Posts — "LinkedIn posts generated from your magnets. Schedule here."
5. Home — "Come back to see what to do next."

## Route Migration

| Old Route              | New Route                    | Action                                    |
|------------------------|------------------------------|-------------------------------------------|
| /                      | /                            | Rebuild (journey-aware Home)              |
| /library               | /magnets                     | Rename + 301 redirect                    |
| /library/[id]          | /magnets/[id]                | Tabbed detail + 301 redirect             |
| /library/[id]/funnel   | /magnets/[id] (Funnel tab)   | Absorb + 301 redirect                    |
| /content               | /knowledge (default redirect) | Split + 301 redirect                     |
| /assets                | /pages                       | Rename + 301 redirect                    |
| /create                | /create                      | Unchanged                                 |
| /create/page-quick     | /pages/new                   | Move + 301 redirect                      |
| /analytics             | / (Home stats section)       | Distribute + 301 redirect                |
| /swipe-file            | /posts (Inspiration tab)     | Absorb + 301 redirect                    |
| /catalog               | /catalog (team-mode only)    | Remove from default nav                  |
| /docs                  | /settings (API Docs tab)     | Move + 301 redirect                      |
| /leads                 | /leads                       | Unchanged                                 |
| /settings              | /settings                    | Add API Docs + Team tabs                 |
| /pages (old redirect)  | /pages                       | Now primary route (remove redirect)      |
| /pages/import          | /pages/import                | Keep                                      |

## Implementation Order

### Phase 1: Sidebar + Routes (foundation)
1. Update DashboardNav with new 6-item structure
2. Create route aliases (/magnets -> moved from /library)
3. Set up 301 redirects for all old routes
4. Update middleware if needed

### Phase 2: Lead Magnets hub
5. Build /magnets list page (enhanced cards from /library)
6. Build /magnets/[id] tabbed detail page
7. Move funnel builder into Funnel tab
8. Move post display into Post tab
9. Add per-magnet Leads + Analytics tabs

### Phase 3: Split Content -> Knowledge + Posts
10. Build /knowledge page with Transcripts + AI Brain tabs
11. Build /posts page with Ideas, Drafts, Schedule, Inspiration tabs
12. Move swipe file content into Inspiration tab

### Phase 4: Pages + Home
13. Build /pages birds-eye view
14. Move quick-create into /pages/new
15. Rebuild Home page with 3-state journey logic
16. Add onboarding checklist (DB column + UI)

### Phase 5: Onboarding + Polish
17. Install driver.js, build walkthrough
18. Move API Docs + Team into Settings tabs
19. Clean up old routes/components
20. Test all redirects
