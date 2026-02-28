# LinkedIn Intent Signals Engine — Design

**Date:** 2026-02-26
**Status:** Approved
**Repo:** magnetlab

## Overview

Multi-signal LinkedIn lead discovery engine that monitors LinkedIn for buying intent, enriches and filters leads against ICP criteria, and pushes qualified leads to HeyReach. All LinkedIn data flows through Harvest API, replacing the current Apify integration.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Signal Sources (Harvest API)            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │ Keyword  │ │ Company  │ │ Profile  │ │ Job Change │ │
│  │ Posts    │ │ Pages    │ │ Engagers │ │ Detection  │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘ │
└───────┼─────────────┼───────────┼──────────────┼────────┘
        └─────────────┴───────────┴──────────────┘
                          │
                    ┌─────▼──────┐
                    │ Raw Leads  │  signal_events table
                    └─────┬──────┘
                          │
                    ┌─────▼──────┐
                    │  Enrich    │  Harvest API /profile ($4-8/1k)
                    └─────┬──────┘
                          │
                    ┌─────▼──────┐
                    │ ICP Filter │  Country + Job Title + Company
                    └─────┬──────┘
                          │
                    ┌─────▼──────┐
                    │  AI Score  │  Comment sentiment + signal stacking
                    └─────┬──────┘
                          │
                    ┌─────▼──────┐
                    │  HeyReach  │  Push qualified leads
                    └────────────┘
```

## Signal Types (8)

### Core 4 (GoJiberri parity)

1. **Keyword Content Engagement** — Search LinkedIn posts by target keywords (2x daily via Trigger.dev), extract commenters + reactors from matching posts. This is GoJiberri's core "$99/mo" feature.

2. **Company Page Monitoring** — Track competitor/target company LinkedIn pages. Scrape their posts 2x daily, extract engagers. Extends existing competitor profile tracking to company pages.

3. **Profile Engagement Tracking** — Existing feature, migrated from Apify to Harvest API. Track influencer/competitor personal profiles, extract post engagers. Already built — just swapping the API client.

4. **Job Change Detection** — Flag profiles with role changes in last 90 days. High-value buying signal (new mandate + discretionary budget, 90-120 day window).

### Novel Differentiators (5-8)

5. **Comment Sentiment Scoring** — AI classifies comment text into intent tiers:
   - `high_intent`: "How does this work?", "We're evaluating this", "Does this integrate with X?"
   - `medium_intent`: "Interesting approach", "We've been thinking about this"
   - `low_intent`: "Great post!", "Congrats!", emoji-only reactions
   - `question`: "What's the pricing?", "How do you handle Y?"

6. **Content Velocity Scoring** — Flag profiles whose posting frequency spiked 3x+ in last 30 days vs prior 30 days. Signals new role, new initiative, or thought leadership push — these people are highly active and responsive to outreach.

7. **Multi-Signal Stacking** — Lead score based on number of distinct signal types. Research shows 2+ signals = 94% accuracy vs 23% for single signal. A person who commented on a keyword post AND changed jobs AND is at a hiring company gets highest compound score.

8. **Job Posting Intelligence** — Scrape target companies' job posts for tool/platform mentions in descriptions (e.g., company posting "experience with HubSpot" is buying in that category). Identifies companies actively investing in specific problem spaces.

## Decisions

- **API**: Harvest API (direct REST, pay-as-you-go) replacing Apify ($30/mo subscription + usage)
- **Keyword scan cadence**: Scheduled batch, 2x daily via Trigger.dev
- **ICP filtering**: Filter in magnetlab before pushing to HeyReach (enrich via Harvest /profile endpoint)
- **ICP config**: Per-tenant settings in DB (`signal_configs` table)
- **Migration**: Full migration from Apify to Harvest API in this project

## Database Schema

### `signal_configs` — Per-tenant ICP filters

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| user_id | uuid FK | Auth user |
| target_countries | text[] | e.g., ['US', 'UK', 'CA'] |
| target_job_titles | text[] | Keyword match, e.g., ['VP Sales', 'Head of Marketing', 'CMO'] |
| exclude_job_titles | text[] | e.g., ['Intern', 'Student'] |
| min_company_size | int | Optional |
| max_company_size | int | Optional |
| target_industries | text[] | Optional |
| default_heyreach_campaign_id | text | Default campaign for qualified leads |
| enrichment_enabled | boolean | Default true |
| sentiment_scoring_enabled | boolean | Default true |
| auto_push_enabled | boolean | Auto-push qualified leads to HeyReach |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `signal_keyword_monitors` — Keyword watchlists

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| user_id | uuid FK | |
| keyword | text | Search term |
| is_active | boolean | Default true |
| last_scanned_at | timestamptz | |
| posts_found | int | Running count |
| leads_found | int | Running count |
| created_at | timestamptz | |

Unique: (user_id, keyword)

### `signal_company_monitors` — Company page watchlists

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| user_id | uuid FK | |
| linkedin_company_url | text | |
| company_name | text | Auto-populated |
| is_active | boolean | Default true |
| last_scanned_at | timestamptz | |
| heyreach_campaign_id | text | Optional override |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Unique: (user_id, linkedin_company_url)

### `signal_profile_monitors` — Profile watchlists (migrated from cp_monitored_competitors)

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| user_id | uuid FK | |
| linkedin_profile_url | text | |
| name | text | Auto-populated |
| headline | text | Auto-populated |
| is_active | boolean | Default true |
| last_scraped_at | timestamptz | |
| heyreach_campaign_id | text | Optional override |
| monitor_type | text | 'competitor' or 'influencer' |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Unique: (user_id, linkedin_profile_url)

### `signal_leads` — Discovered leads (deduplicated across all sources)

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| user_id | uuid FK | |
| linkedin_url | text | Normalized LinkedIn URL |
| first_name | text | |
| last_name | text | |
| headline | text | From engagement or enrichment |
| job_title | text | Parsed from enrichment |
| company | text | |
| country | text | |
| profile_data | jsonb | Full enrichment response |
| email | text | If found via Harvest email search |
| icp_match | boolean | Passes ICP filter |
| icp_score | int | 0-100 composite |
| signal_count | int | Distinct signal types detected |
| compound_score | int | 0-100 multi-signal score |
| sentiment_score | text | Highest sentiment from events |
| content_velocity_score | float | Posts/30d ratio |
| status | text | new → enriched → qualified → pushed → excluded |
| heyreach_campaign_id | text | Campaign pushed to |
| heyreach_pushed_at | timestamptz | |
| heyreach_error | text | |
| enriched_at | timestamptz | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

Unique: (user_id, linkedin_url)

### `signal_events` — Individual signal occurrences

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| user_id | uuid FK | |
| lead_id | uuid FK → signal_leads | |
| signal_type | text | keyword_engagement, company_engagement, profile_engagement, job_change, content_velocity, job_posting |
| source_url | text | Post URL, company URL, job URL |
| source_monitor_id | uuid | FK to the monitor that triggered this |
| comment_text | text | If commenter |
| sentiment | text | high_intent / medium_intent / low_intent / question |
| keyword_matched | text | Which keyword triggered (for keyword signals) |
| engagement_type | text | comment / reaction / post_author |
| metadata | jsonb | Extra context |
| detected_at | timestamptz | When the signal was observed |
| created_at | timestamptz | |

Index: (user_id, lead_id, signal_type, source_url) for dedup

## Harvest API Client

Replace `src/lib/integrations/apify-engagers.ts` with `src/lib/integrations/harvest-api.ts`.

**Base URL:** `https://api.harvest-api.com`
**Auth:** `X-API-Key: alVIGw5vMtgQwCG9FdAh2jkMmCOP0PZ6`

| Method | Harvest Endpoint | Purpose |
|--------|-----------------|---------|
| searchPosts(keywords, dateRange) | GET /linkedin/post-search | Keyword content monitoring |
| getPostComments(postUrl) | GET /linkedin/post-comments | Extract commenters |
| getPostReactions(postUrl) | GET /linkedin/post-reactions | Extract reactors |
| getProfilePosts(profileUrl, limit) | GET /linkedin/profile-posts | Profile/competitor monitoring |
| getProfile(profileUrl) | GET /linkedin/profile | Lead enrichment |
| getCompanyPosts(companyUrl) | GET /linkedin/company-posts (TBC) | Company page monitoring |
| searchJobs(companyUrl) | GET /linkedin/job-search | Job posting intelligence |

## Trigger.dev Tasks

| Task | Schedule | Description |
|------|----------|-------------|
| `signal-keyword-scan` | Every 12 hours | For each active keyword monitor: search posts, extract commenters + reactors, upsert signal_events + signal_leads |
| `signal-company-scan` | Every 12 hours | For each active company monitor: get company posts (last 24h), extract engagers |
| `signal-profile-scan` | Every 60 min | Migrated from existing scrape-engagement task. Profile monitors with adaptive tapering |
| `signal-enrich-leads` | Every 2 hours | Batch-enrich signal_leads where status='new'. Call Harvest /profile, parse job title/company/country, update profile_data |
| `signal-icp-filter` | After enrichment | Apply ICP filters from signal_configs. Compute icp_score. Set icp_match=true/false, status=qualified or excluded |
| `signal-sentiment-score` | After enrichment | AI-classify comment_text in signal_events. Update sentiment on event + lead |
| `signal-compound-score` | After all scoring | Count distinct signal_types per lead. Weight: job_change=3x, high_intent_comment=2x, keyword_engagement=1.5x, reaction=1x. Compute compound_score |
| `signal-push-heyreach` | Every 30 min | Push leads where status=qualified AND auto_push_enabled to HeyReach. Update pushed_at |

## Cost Estimate

| Item | Monthly cost (1k leads) |
|------|------------------------|
| Keyword post search (10 keywords × 2x daily) | ~$12 |
| Comment/reaction extraction (~50 posts/day) | ~$6 |
| Company page monitoring (5 companies × 2x daily) | ~$6 |
| Profile enrichment (filter step, ~2k profiles) | ~$8-16 |
| Job posting search (10 companies × weekly) | ~$1 |
| **Total** | **~$30-40/month** |

vs current Apify: $30/mo subscription + usage, fewer capabilities

## UI Changes

### Settings → Signals page (new section)

- **ICP Configuration**: Countries (multi-select), job titles (tag input), exclusions, company size range, industries
- **Keyword Monitors**: Add/remove keywords, shows posts_found / leads_found per keyword, toggle active
- **Company Monitors**: Add/remove LinkedIn company page URLs, auto-populate name
- **Profile Monitors**: Migrated from existing competitor monitoring section, add "influencer" vs "competitor" label

### Dashboard → Signal Leads page (new)

- Table: Name, headline, company, country, signal count, compound score, sentiment, status, detected date
- Filters: signal type, score range, ICP match, date range, status
- Bulk actions: push to HeyReach, exclude, export CSV
- Detail drawer: all signal_events for a lead, full profile data, timeline

## Migration Plan

1. Create new tables (signal_configs, signal_keyword_monitors, signal_company_monitors, signal_profile_monitors, signal_leads, signal_events)
2. Migrate cp_monitored_competitors → signal_profile_monitors
3. Migrate cp_post_engagements → signal_events + signal_leads
4. Build Harvest API client
5. Build Trigger.dev tasks (keyword scan first, then others)
6. Build ICP config UI
7. Build signal leads dashboard
8. Swap existing scrape-engagement task to use Harvest API
9. Remove Apify integration
10. Deploy + test
