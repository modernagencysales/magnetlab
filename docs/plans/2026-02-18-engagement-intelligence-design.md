# Engagement Intelligence System — Design

> Date: 2026-02-18
> Status: Approved
> Repo: magnetlab

## Summary

Replace Unipile monitor accounts with Apify for all engagement scraping. Add competitor profile monitoring. Route DMs/connections through HeyReach campaigns. Keep Unipile only for publishing posts and low-risk actions (like/reply).

## Tool Responsibilities

| Tool | Does | Doesn't |
|------|------|---------|
| Unipile | Publish posts, like comments, reply to comments | Scrape, DM, connect |
| Apify | Scrape all engagement (own + competitor posts) | Any actions |
| HeyReach | DMs, connection requests (via campaign enrollment) | Scraping |

## Apify Actors

- **`scraping_solutions/linkedin-posts-engagers`** ($30/mo) — takes a post URL + type (`commenters` or `likers`), returns ~50 engagers with name, headline, LinkedIn URL
- **`supreme_coder/linkedin-post`** (already rented, $1/1k) — takes a profile URL, returns recent posts with engagement counts

## New DB Table: `cp_monitored_competitors`

```sql
cp_monitored_competitors (
  id UUID PK,
  user_id UUID FK → auth.users,
  linkedin_profile_url TEXT NOT NULL,
  name TEXT,
  headline TEXT,
  heyreach_campaign_id TEXT,
  is_active BOOLEAN DEFAULT true,
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  UNIQUE(user_id, linkedin_profile_url)
)
```

Max 10 per user (enforced in API).

## Schema Changes: `cp_post_engagements`

- Add `source TEXT DEFAULT 'own_post'` — values: `own_post`, `competitor`
- Add `source_post_url TEXT` — LinkedIn post URL (for competitor posts without a cp_pipeline_posts row)
- Add `competitor_id UUID` FK → `cp_monitored_competitors` (null for own posts)
- Make `post_id` nullable (competitor engagements won't have one)
- New dedup index for competitor posts: `UNIQUE(source_post_url, provider_id, engagement_type)` where `source_post_url IS NOT NULL`
- Update existing dedup to add `WHERE post_id IS NOT NULL`

## Refactored `scrape-engagement` Cron (every 10 min)

Single unified cron, own posts first (priority), then competitors:

### Step 0: Auto-disable expired own posts (7+ days)

Same as today.

### Step 1: Scrape OWN posts

For each eligible `cp_pipeline_posts` (scrape_engagement=true, published, has linkedin_post_id):
1. Build LinkedIn post URL from `linkedin_post_id`
2. Call Apify engagers actor (`type: "commenters"`)
3. Call Apify engagers actor (`type: "likers"`)
4. Upsert into `cp_post_engagements` (source='own_post')
5. Push unpushed leads to HeyReach campaign

No profile resolution needed — Apify returns LinkedIn URLs directly.

### Step 2: Scrape COMPETITOR posts (if time remains)

For each active `cp_monitored_competitors`:
1. Call `supreme_coder/linkedin-post` to get recent posts
2. Filter to posts from last 7 days
3. For each post, call engagers actor (commenters + likers)
4. Upsert into `cp_post_engagements` (source='competitor', competitor_id set)
5. Push unpushed leads to HeyReach campaign
6. Update `last_scraped_at`

Adaptive schedule applies to competitors too — skip if scraped recently.

## Comment→DM Automation (Real-time Webhook Path)

When Unipile webhook fires with a new comment on a post with active automation:

1. Keyword match (unchanged)
2. **HeyReach campaign enrollment** — enroll commenter with `{{resource_url}}` custom variable
3. **Unipile like** — like the comment (low-risk, keeps engagement visible)
4. **Unipile reply** — reply to comment if template exists (low-risk)
5. **Drop `send-follow-up-dm` task** — HeyReach handles sequencing

`linkedin_automations` table gains `heyreach_campaign_id` column.

## HeyReach Integration Changes

- New dedicated campaign for engagement delivery (user creates manually, stores ID)
- `pushLeadsToHeyReach` extended to accept custom variables (e.g., `resource_url`)
- Default campaign ID from `HEYREACH_ENGAGEMENT_CAMPAIGN_ID` env var

## New Apify Client

`src/lib/integrations/apify-engagers.ts`:
- `scrapeEngagers(postUrl, type)` — calls engagers actor via `run-sync-get-dataset-items`
- `scrapeProfilePosts(profileUrl, limit)` — calls supreme_coder actor for competitor posts
- 120s timeout per call

## Unipile Client Cleanup

Keep: `createPost`, `requestHostedAuthLink`, `verifyConnection`, `deleteAccount`, `addComment`, `addReaction`

Remove: `getPostComments`, `getPostReactions`, `getUserProfile`, `getMonitorAccountId`, `UNIPILE_MONITOR_ACCOUNT_IDS` env var usage

## UI: Competitor Monitoring

Settings section (or dedicated page):
- Add competitor by LinkedIn profile URL
- Name/headline auto-populated from first scrape
- Toggle active/inactive
- Set HeyReach campaign per competitor
- Max 10 per user
- Shows last scraped time + total engagers found

## Env Vars

| Var | Where | Purpose |
|-----|-------|---------|
| `APIFY_API_TOKEN` | Vercel + Trigger.dev (magnetlab) | Apify API calls |
| `HEYREACH_ENGAGEMENT_CAMPAIGN_ID` | Trigger.dev (magnetlab) | Default campaign for engagement leads |
| `HEYREACH_API_KEY` | Trigger.dev (magnetlab) | HeyReach API (may already be set) |
| ~~`UNIPILE_MONITOR_ACCOUNT_IDS`~~ | **REMOVED** | No longer needed |
