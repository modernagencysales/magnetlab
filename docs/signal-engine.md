<!-- Extracted from CLAUDE.md — see main file for architecture overview -->

## LinkedIn Signal Engine (Feb 2026)

Multi-signal LinkedIn lead discovery engine. Monitors LinkedIn for buying intent via keyword posts, company pages, profile engagement, and job changes. Enriches leads, filters against ICP criteria, scores with AI sentiment analysis, and pushes qualified leads to HeyReach. All LinkedIn data flows through Harvest API (replaced Apify).

### Architecture

```
Signal Sources (Harvest API)
  ├── Keyword Posts (searchPosts → getPostComments/Reactions)
  ├── Company Pages (getCompanyPosts → getPostComments/Reactions)
  ├── Profile Engagers (getProfilePosts → getPostComments/Reactions)
  └── Job Changes (detected via enrichment)
        │
  Raw Leads → signal_events + signal_leads tables
        │
  Enrich → Harvest API /profile ($4-8/1k)
        │
  ICP Filter → Country + Job Title + Company match
        │
  AI Score → Claude Haiku sentiment + signal stacking
        │
  HeyReach → Push qualified leads to campaigns
```

### Signal Types (8)

1. **Keyword Content Engagement** — Search posts by target keywords, extract commenters + reactors
2. **Company Page Monitoring** — Track competitor/target company pages, extract engagers
3. **Profile Engagement Tracking** — Monitor influencer/competitor profiles, extract engagers
4. **Job Change Detection** — Flag profiles with role changes in last 90 days
5. **Comment Sentiment Scoring** — AI classifies comments: `high_intent`, `question`, `medium_intent`, `low_intent`
6. **Content Velocity Scoring** — Flag profiles with 3x+ posting frequency spike
7. **Multi-Signal Stacking** — Compound score from distinct signal types (weights: job_change=30, keyword=15, etc.)
8. **Job Posting Intelligence** — Scrape company job posts for tool/platform mentions

### Database Tables (6)

- `signal_configs` — Per-user ICP filters (countries, job titles, exclusions, company size, auto-push toggle)
- `signal_keyword_monitors` — Keyword watchlists (max 20 per user), tracks posts_found/leads_found
- `signal_company_monitors` — Company page watchlists (max 10 per user), LinkedIn company URLs
- `signal_profile_monitors` — Profile watchlists (migrated from `cp_monitored_competitors`), competitor/influencer types
- `signal_leads` — Deduplicated leads across all sources, with ICP score, compound score, sentiment, status pipeline
- `signal_events` — Individual signal occurrences linked to leads, with signal_type, comment_text, sentiment

All tables have RLS enabled (user self-management + service role bypass).

### Harvest API Client

- `src/lib/integrations/harvest-api.ts` — REST client at `https://api.harvest-api.com`, auth: `X-API-Key` header
- Endpoints: `searchPosts`, `getPostComments`, `getPostReactions`, `getProfilePosts`, `getProfile`, `getCompanyPosts`, `searchJobs`
- Replaces Apify integration (`apify-engagers.ts` deleted)

### Trigger.dev Scheduled Tasks

| Task | Cron | Purpose |
|------|------|---------|
| `signal-keyword-scan` | `0 */12 * * *` | Search posts by keyword, extract engagers |
| `signal-company-scan` | `30 */12 * * *` | Scrape company page posts + engagers |
| `signal-profile-scan` | `*/10 * * * *` | Profile monitoring (replaced Apify Phase 2) |
| `signal-enrich-and-score` | `15 */2 * * *` | Enrich leads, ICP filter, sentiment score, compound score |
| `signal-push-heyreach` | `*/30 * * * *` | Push qualified ICP-matched leads to HeyReach |
| `scrape-engagement` | `*/10 * * * *` | Own-post engagement only (migrated to Harvest API) |

### Services

- `src/lib/services/signal-engine.ts` — `normalizeLinkedInUrl()`, `upsertSignalLead()`, `recordSignalEvent()`, `updateSignalCounts()`, `processEngagers()`
- `src/lib/services/signal-icp-filter.ts` — `matchesIcp()`, `computeIcpScore()` (0-100 composite)
- `src/lib/ai/signal-sentiment.ts` — `classifyCommentSentiment()` (Claude Haiku), `batchClassifySentiment()`

### API Routes

| Route | Purpose |
|-------|---------|
| `GET/PUT /api/signals/config` | User's ICP filter config |
| `GET/POST /api/signals/keywords` | List/add keyword monitors |
| `PATCH/DELETE /api/signals/keywords/[id]` | Toggle/delete keyword |
| `GET/POST /api/signals/companies` | List/add company monitors |
| `PATCH/DELETE /api/signals/companies/[id]` | Update/delete company |
| `GET /api/signals/leads` | List leads with filters (status, ICP, signal type, score, pagination) |
| `POST /api/signals/leads` | Bulk actions (exclude, push to HeyReach) |

### UI Components

- `src/components/settings/SignalConfig.tsx` — ICP config form (countries, titles, toggles)
- `src/components/settings/KeywordMonitors.tsx` — Keyword watchlist manager
- `src/components/settings/CompanyMonitors.tsx` — Company page watchlist manager
- `src/components/signals/SignalLeadsTable.tsx` — Dashboard table with filters + bulk actions
- `src/components/signals/SignalLeadDetail.tsx` — Slide-out detail drawer with signal events timeline
- Dashboard nav: "Signals" item at `/(dashboard)/signals`

### Compound Scoring

Weights per signal type: `job_change=30`, `job_posting=20`, `keyword_engagement=15`, `content_velocity=15`, `company_engagement=10`, `profile_engagement=10`. Sentiment bonuses: `high_intent=+20`, `question=+15`, `medium_intent=+5`. Capped at 100.

### Env Vars

| Var | Where | Purpose |
|-----|-------|---------|
| `HARVEST_API_KEY` | `.env.local` + Vercel + Trigger.dev | Harvest API calls |
| `HEYREACH_API_KEY` | Trigger.dev | HeyReach campaign enrollment |

### Tool Responsibility Split

| Tool | Does | Doesn't |
|------|------|---------|
| Harvest API | All LinkedIn scraping (posts, comments, reactions, profiles, jobs) | Any actions |
| Unipile | Publish posts, like comments, reply to comments | Scrape, DM, connect |
| HeyReach | DMs, connection requests (via campaign enrollment) | Scraping |

### Legacy Engagement (still active for own posts)

- `src/trigger/scrape-engagement.ts` — Own-post engagement scraping (migrated from Apify to Harvest API). Competitor scraping fully removed (handled by `signal-profile-scan.ts`).
- `cp_post_engagements` table — Still used for own-post engagement tracking
- `cp_monitored_competitors` table — Data migrated to `signal_profile_monitors`, table kept for backward compatibility
