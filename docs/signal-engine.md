# LinkedIn Signal Engine

Multi-signal lead discovery: keyword posts, company pages, profile engagement, job changes. Harvest API (replaced Apify). Enriches → ICP filter → AI sentiment → HeyReach push.

## Signal Types

Keyword engagement, company monitoring, profile engagement, job change detection, comment sentiment, content velocity, multi-signal stacking, job posting intelligence.

## Tables

`signal_configs`, `signal_keyword_monitors`, `signal_company_monitors`, `signal_profile_monitors`, `signal_leads`, `signal_events`

## Trigger Tasks

| Task | Cron | Purpose |
|------|------|---------|
| signal-keyword-scan | 0 */12 * * * | Search posts by keyword |
| signal-company-scan | 30 */12 * * * | Company page engagers |
| signal-profile-scan | */10 * * * * | Profile monitoring |
| signal-enrich-and-score | 15 */2 * * * | Enrich, ICP filter, sentiment |
| signal-push-heyreach | */30 * * * * | Push qualified leads |

## API Routes

`/api/signals/config` | `keywords`, `companies` (CRUD) | `leads` (list, bulk actions)

## Env Vars

`HARVEST_API_KEY`, `HEYREACH_API_KEY`
