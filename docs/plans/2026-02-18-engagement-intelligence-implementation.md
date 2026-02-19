# Engagement Intelligence System — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Unipile monitor accounts with Apify for engagement scraping, add competitor profile monitoring, route outreach through HeyReach, keep Unipile for publishing/like/reply only.

**Architecture:** Single unified cron scrapes own posts + competitor posts via Apify actors, stores engagement in `cp_post_engagements`, pushes leads to HeyReach campaigns. Comment automations route DMs/connects through HeyReach, keep like/reply on Unipile. New `cp_monitored_competitors` table + Settings UI for competitor management.

**Tech Stack:** Apify REST API (engagers + post actors), HeyReach API (campaign enrollment with custom vars), Supabase (new table + schema changes), Trigger.dev (refactored cron), Next.js API routes + React settings UI.

**Design doc:** `docs/plans/2026-02-18-engagement-intelligence-design.md`

---

## Task 1: Set APIFY_API_TOKEN env var

**Files:**
- Modify: `.env.local`

**Step 1:** Add `APIFY_API_TOKEN=<APIFY_TOKEN>` to `.env.local`.

**Step 2:** Set on Vercel:
```bash
echo "<APIFY_TOKEN>" | npx vercel env add APIFY_API_TOKEN production
```

**Step 3:** Set in Trigger.dev:
```bash
curl -s "https://api.trigger.dev/api/v1/projects/proj_jdjofdqazqwitpinxady/envvars/prod" \
  -X POST -H "Authorization: Bearer tr_prod_DB3vrdcduJYcXF19rrEB" \
  -H "Content-Type: application/json" \
  -d '{"name":"APIFY_API_TOKEN","value":"<APIFY_TOKEN>"}'
```

**Step 4:** Commit:
```bash
git add .env.local && git commit -m "chore: add APIFY_API_TOKEN env var"
```

---

## Task 2: Create Apify engagers client

**Files:**
- Create: `src/lib/integrations/apify-engagers.ts`

**Step 1:** Create the Apify client with two methods:

```typescript
// src/lib/integrations/apify-engagers.ts
//
// Apify LinkedIn Engagement Scraping
// Actor 1: scraping_solutions/linkedin-posts-engagers (commenters + likers from a post URL)
// Actor 2: supreme_coder/linkedin-post (recent posts from a profile URL)

const ENGAGERS_ACTOR = 'scraping_solutions~linkedin-posts-engagers-likers-and-commenters-no-cookies';
const POSTS_ACTOR = 'supreme_coder~linkedin-post';
const APIFY_BASE = 'https://api.apify.com/v2';
const SYNC_TIMEOUT = 120; // seconds

export interface ApifyEngager {
  type: 'commenters' | 'likers';
  post_Link: string;
  url_profile: string;   // LinkedIn URL (clean /in/slug for commenters, /in/ACoXXX for likers)
  name: string;
  subtitle: string;       // headline
  content?: string;        // comment text (commenters only)
  timestamp?: number;
  datetime?: string;
}

export interface ApifyPost {
  url: string;
  text: string;
  numLikes: number;
  numComments: number;
  numShares: number;
  postedAtISO: string;
  postedAtTimestamp: number;
  authorName: string;
  authorProfileUrl: string;
  author: {
    firstName: string;
    lastName: string;
    occupation: string;
    publicId: string;
  };
}

/**
 * Scrape engagers (commenters or likers) from a single LinkedIn post URL.
 * Returns up to ~50 engagers per call.
 */
export async function scrapeEngagers(
  postUrl: string,
  type: 'commenters' | 'likers'
): Promise<{ data: ApifyEngager[]; error: string | null }> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return { data: [], error: 'APIFY_API_TOKEN not set' };

  try {
    const response = await fetch(
      `${APIFY_BASE}/acts/${ENGAGERS_ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=${SYNC_TIMEOUT}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: postUrl, type }),
        signal: AbortSignal.timeout((SYNC_TIMEOUT + 30) * 1000),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { data: [], error: `Apify HTTP ${response.status}: ${errorText.substring(0, 200)}` };
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return { data: [], error: `Unexpected response type: ${typeof data}` };
    }

    return { data: data as ApifyEngager[], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Scrape recent posts from a LinkedIn profile URL.
 * Uses the supreme_coder/linkedin-post actor (already rented).
 */
export async function scrapeProfilePosts(
  profileUrl: string,
  limit: number = 10
): Promise<{ data: ApifyPost[]; error: string | null }> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return { data: [], error: 'APIFY_API_TOKEN not set' };

  try {
    const response = await fetch(
      `${APIFY_BASE}/acts/${POSTS_ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=${SYNC_TIMEOUT}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: [profileUrl],
          limitPerSource: limit,
          deepScrape: true,
        }),
        signal: AbortSignal.timeout((SYNC_TIMEOUT + 30) * 1000),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { data: [], error: `Apify HTTP ${response.status}: ${errorText.substring(0, 200)}` };
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return { data: [], error: `Unexpected response type: ${typeof data}` };
    }

    return { data: data as ApifyPost[], error: null };
  } catch (err) {
    return { data: [], error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
```

**Step 2:** Commit:
```bash
git add src/lib/integrations/apify-engagers.ts && git commit -m "feat: add Apify engagers client for LinkedIn scraping"
```

---

## Task 3: DB migration — competitors table + engagement schema changes

**Files:**
- Create: `supabase/migrations/20260218300000_engagement_intelligence.sql`

**Step 1:** Write the migration:

```sql
-- Engagement Intelligence: competitor monitoring + Apify migration
-- Replaces Unipile monitor accounts with Apify for scraping

-- ============================================
-- New table: cp_monitored_competitors
-- ============================================

CREATE TABLE IF NOT EXISTS cp_monitored_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linkedin_profile_url TEXT NOT NULL,
  name TEXT,
  headline TEXT,
  heyreach_campaign_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_scraped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_cp_competitors_user_url
  ON cp_monitored_competitors(user_id, linkedin_profile_url);

CREATE INDEX idx_cp_competitors_active
  ON cp_monitored_competitors(user_id)
  WHERE is_active = true;

ALTER TABLE cp_monitored_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own competitors"
  ON cp_monitored_competitors FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access to competitors"
  ON cp_monitored_competitors FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- Schema changes: cp_post_engagements
-- ============================================

-- Add source tracking columns
ALTER TABLE cp_post_engagements
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'own_post',
  ADD COLUMN IF NOT EXISTS source_post_url TEXT,
  ADD COLUMN IF NOT EXISTS competitor_id UUID REFERENCES cp_monitored_competitors(id) ON DELETE SET NULL;

-- Make post_id nullable (competitor engagements don't have one)
ALTER TABLE cp_post_engagements ALTER COLUMN post_id DROP NOT NULL;

-- Drop old dedup index and recreate with WHERE clause for own posts
DROP INDEX IF EXISTS idx_cp_engagements_dedup;

CREATE UNIQUE INDEX idx_cp_engagements_dedup_own
  ON cp_post_engagements(post_id, provider_id, engagement_type)
  WHERE post_id IS NOT NULL;

-- New dedup index for competitor engagements
CREATE UNIQUE INDEX idx_cp_engagements_dedup_competitor
  ON cp_post_engagements(source_post_url, provider_id, engagement_type)
  WHERE source_post_url IS NOT NULL;

-- Index for competitor engagement lookups
CREATE INDEX idx_cp_engagements_competitor
  ON cp_post_engagements(competitor_id)
  WHERE competitor_id IS NOT NULL;

-- ============================================
-- Schema changes: linkedin_automations
-- ============================================

ALTER TABLE linkedin_automations
  ADD COLUMN IF NOT EXISTS heyreach_campaign_id TEXT,
  ADD COLUMN IF NOT EXISTS resource_url TEXT;
```

**Step 2:** Push migration:
```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npm run db:push
```

**Step 3:** Commit:
```bash
git add supabase/migrations/20260218300000_engagement_intelligence.sql && git commit -m "feat: add competitors table + engagement schema changes"
```

---

## Task 4: Extend HeyReach client to support custom variables

**Files:**
- Modify: `src/lib/integrations/heyreach.ts`

**Step 1:** Add `customVariables` parameter to `pushLeadsToHeyReach`:

Replace the entire `pushLeadsToHeyReach` function signature and lead mapping to accept and pass custom variables:

```typescript
export async function pushLeadsToHeyReach(
  campaignId: string,
  leads: Array<{
    profileUrl: string;
    firstName?: string;
    lastName?: string;
    customVariables?: Record<string, string>;
  }>
): Promise<{ success: boolean; added: number; error?: string }> {
```

In the `accountLeadPairs` mapping inside the function body, add the custom variables to each lead object:

```typescript
lead: {
  profileUrl: lead.profileUrl,
  firstName: lead.firstName,
  lastName: lead.lastName,
  ...lead.customVariables,
},
```

**Step 2:** Commit:
```bash
git add src/lib/integrations/heyreach.ts && git commit -m "feat: add custom variable support to HeyReach lead push"
```

---

## Task 5: Rewrite scrape-engagement cron to use Apify

**Files:**
- Modify: `src/trigger/scrape-engagement.ts`

This is the core refactor. Replace the entire file.

**Step 1:** Rewrite `src/trigger/scrape-engagement.ts`:

```typescript
import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { scrapeEngagers, scrapeProfilePosts } from '@/lib/integrations/apify-engagers';
import { pushLeadsToHeyReach } from '@/lib/integrations/heyreach';

// ============================================
// SCRAPE SCHEDULE: taper off as post ages
// ============================================

function shouldScrapeNow(publishedAt: string, lastScrapeAt: string | null): boolean {
  const now = Date.now();
  const published = new Date(publishedAt).getTime();
  const ageMs = now - published;
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours > 7 * 24) return false;
  if (!lastScrapeAt) return true;

  const lastScrape = new Date(lastScrapeAt).getTime();
  const sinceScrapeMin = (now - lastScrape) / (1000 * 60);

  if (ageHours <= 2) return sinceScrapeMin >= 10;
  if (ageHours <= 8) return sinceScrapeMin >= 30;
  if (ageHours <= 24) return sinceScrapeMin >= 120;
  return sinceScrapeMin >= 360;
}

function shouldScrapeCompetitor(lastScrapedAt: string | null): boolean {
  if (!lastScrapedAt) return true;
  const sinceScrapeMin = (Date.now() - new Date(lastScrapedAt).getTime()) / (1000 * 60);
  return sinceScrapeMin >= 60; // competitors: every 60 min
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

// ============================================
// Helper: scrape + upsert engagers for a single post URL
// ============================================

interface ScrapeTarget {
  postUrl: string;
  userId: string;
  postId?: string;          // null for competitor posts
  competitorId?: string;    // null for own posts
  source: 'own_post' | 'competitor';
  heyreachCampaignId?: string;
}

async function scrapeAndStoreEngagers(target: ScrapeTarget): Promise<{ comments: number; likers: number; errors: string[] }> {
  const supabase = createSupabaseAdminClient();
  const errors: string[] = [];
  let commentCount = 0;
  let likerCount = 0;

  // Scrape commenters
  const commentersResult = await scrapeEngagers(target.postUrl, 'commenters');
  if (commentersResult.error) {
    errors.push(`commenters: ${commentersResult.error}`);
  } else if (commentersResult.data.length > 0) {
    const rows = commentersResult.data.map(c => {
      const { firstName, lastName } = splitName(c.name);
      return {
        user_id: target.userId,
        post_id: target.postId || null,
        competitor_id: target.competitorId || null,
        source: target.source,
        source_post_url: target.postUrl,
        provider_id: c.url_profile, // Use LinkedIn URL as provider_id (unique per person)
        engagement_type: 'comment' as const,
        comment_text: c.content || null,
        first_name: firstName,
        last_name: lastName,
        linkedin_url: c.url_profile,
        subtitle: c.subtitle || null,
        engaged_at: c.datetime ? new Date(c.datetime).toISOString() : null,
        heyreach_campaign_id: target.heyreachCampaignId || null,
      };
    });

    // Upsert based on source type
    const onConflict = target.postId
      ? 'post_id,provider_id,engagement_type'
      : 'source_post_url,provider_id,engagement_type';

    const { error: upsertErr } = await supabase
      .from('cp_post_engagements')
      .upsert(rows, { onConflict, ignoreDuplicates: true });

    if (upsertErr) {
      errors.push(`comment upsert: ${upsertErr.message}`);
    } else {
      commentCount = rows.length;
    }
  }

  // Scrape likers
  const likersResult = await scrapeEngagers(target.postUrl, 'likers');
  if (likersResult.error) {
    errors.push(`likers: ${likersResult.error}`);
  } else if (likersResult.data.length > 0) {
    const rows = likersResult.data.map(l => {
      const { firstName, lastName } = splitName(l.name);
      return {
        user_id: target.userId,
        post_id: target.postId || null,
        competitor_id: target.competitorId || null,
        source: target.source,
        source_post_url: target.postUrl,
        provider_id: l.url_profile,
        engagement_type: 'reaction' as const,
        reaction_type: 'LIKE',
        first_name: firstName,
        last_name: lastName,
        linkedin_url: l.url_profile,
        subtitle: l.subtitle || null,
        heyreach_campaign_id: target.heyreachCampaignId || null,
      };
    });

    const onConflict = target.postId
      ? 'post_id,provider_id,engagement_type'
      : 'source_post_url,provider_id,engagement_type';

    const { error: upsertErr } = await supabase
      .from('cp_post_engagements')
      .upsert(rows, { onConflict, ignoreDuplicates: true });

    if (upsertErr) {
      errors.push(`liker upsert: ${upsertErr.message}`);
    } else {
      likerCount = rows.length;
    }
  }

  // Push unpushed leads to HeyReach
  if (target.heyreachCampaignId) {
    const whereClause = target.postId
      ? { post_id: target.postId }
      : { source_post_url: target.postUrl };

    const { data: unpushed } = await supabase
      .from('cp_post_engagements')
      .select('id, linkedin_url, first_name, last_name')
      .match(whereClause)
      .eq('user_id', target.userId)
      .not('linkedin_url', 'is', null)
      .is('heyreach_pushed_at', null)
      .is('heyreach_error', null)
      .eq('heyreach_campaign_id', target.heyreachCampaignId)
      .limit(100);

    if (unpushed && unpushed.length > 0) {
      const result = await pushLeadsToHeyReach(
        target.heyreachCampaignId,
        unpushed.map(l => ({
          profileUrl: l.linkedin_url!,
          firstName: l.first_name || undefined,
          lastName: l.last_name || undefined,
        }))
      );

      const now = new Date().toISOString();
      const ids = unpushed.map(l => l.id);

      if (result.success) {
        await supabase
          .from('cp_post_engagements')
          .update({ heyreach_pushed_at: now })
          .in('id', ids);
        logger.info(`Pushed ${result.added} leads to HeyReach`, { campaignId: target.heyreachCampaignId });
      } else {
        await supabase
          .from('cp_post_engagements')
          .update({ heyreach_error: result.error || 'Unknown error' })
          .in('id', ids);
        errors.push(`heyreach: ${result.error}`);
      }
    }
  }

  return { comments: commentCount, likers: likerCount, errors };
}

// ============================================
// CRON TASK: every 10 minutes
// ============================================

export const scrapeEngagement = schedules.task({
  id: 'scrape-engagement',
  cron: '*/10 * * * *',
  maxDuration: 300,
  run: async () => {
    const supabase = createSupabaseAdminClient();
    logger.info('Starting engagement scrape cycle (Apify)');

    let totalScraped = 0;
    const allErrors: string[] = [];

    // ==========================================
    // STEP 0: Auto-disable scraping for old posts (7+ days)
    // ==========================================
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: expiredPosts } = await supabase
      .from('cp_pipeline_posts')
      .update({ scrape_engagement: false })
      .eq('scrape_engagement', true)
      .eq('status', 'published')
      .lt('published_at', sevenDaysAgo)
      .select('id');

    if (expiredPosts && expiredPosts.length > 0) {
      logger.info(`Disabled scraping for ${expiredPosts.length} expired posts`);
    }

    // ==========================================
    // STEP 1: Scrape OWN posts (priority)
    // ==========================================
    const { data: ownPosts } = await supabase
      .from('cp_pipeline_posts')
      .select('id, user_id, linkedin_post_id, heyreach_campaign_id, published_at, last_engagement_scrape_at, engagement_scrape_count')
      .eq('scrape_engagement', true)
      .eq('status', 'published')
      .not('linkedin_post_id', 'is', null)
      .not('published_at', 'is', null)
      .limit(10);

    if (ownPosts) {
      const eligible = ownPosts.filter(p =>
        shouldScrapeNow(p.published_at!, p.last_engagement_scrape_at)
      );

      logger.info(`Own posts: ${eligible.length} eligible of ${ownPosts.length} total`);

      for (const post of eligible) {
        try {
          // linkedin_post_id could be a URN or UUID — build the post URL
          // If it looks like a UUID, we can't build a URL (legacy data)
          const postId = post.linkedin_post_id!;
          let postUrl: string;

          if (postId.startsWith('urn:li:')) {
            postUrl = `https://www.linkedin.com/feed/update/${postId}`;
          } else if (postId.includes('-') && postId.length > 30) {
            // UUID format — skip, can't scrape without a real LinkedIn URL
            logger.warn(`Skipping post ${post.id}: linkedin_post_id is UUID format, not a LinkedIn URN`);
            continue;
          } else {
            // Assume it's an activity ID
            postUrl = `https://www.linkedin.com/feed/update/urn:li:activity:${postId}`;
          }

          const result = await scrapeAndStoreEngagers({
            postUrl,
            userId: post.user_id,
            postId: post.id,
            source: 'own_post',
            heyreachCampaignId: post.heyreach_campaign_id || undefined,
          });

          logger.info(`Own post ${post.id}: ${result.comments} comments, ${result.likers} likers`, {
            errors: result.errors,
          });

          // Update scrape metadata
          await supabase
            .from('cp_pipeline_posts')
            .update({
              last_engagement_scrape_at: new Date().toISOString(),
              engagement_scrape_count: (post.engagement_scrape_count || 0) + 1,
            })
            .eq('id', post.id);

          totalScraped++;
          allErrors.push(...result.errors);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          logger.error(`Failed to scrape own post ${post.id}`, { error: msg });
          allErrors.push(`own:${post.id}: ${msg}`);
        }
      }
    }

    // ==========================================
    // STEP 2: Scrape COMPETITOR posts
    // ==========================================
    const { data: competitors } = await supabase
      .from('cp_monitored_competitors')
      .select('id, user_id, linkedin_profile_url, heyreach_campaign_id, last_scraped_at')
      .eq('is_active', true)
      .limit(20);

    if (competitors) {
      const eligible = competitors.filter(c => shouldScrapeCompetitor(c.last_scraped_at));

      logger.info(`Competitors: ${eligible.length} eligible of ${competitors.length} total`);

      for (const comp of eligible) {
        try {
          // Get competitor's recent posts
          const postsResult = await scrapeProfilePosts(comp.linkedin_profile_url, 10);

          if (postsResult.error) {
            logger.warn(`Failed to get posts for competitor ${comp.id}`, { error: postsResult.error });
            allErrors.push(`competitor:${comp.id}: ${postsResult.error}`);
            continue;
          }

          // Filter to posts from last 7 days
          const sevenDaysAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
          const recentPosts = postsResult.data.filter(p =>
            p.postedAtTimestamp > sevenDaysAgoMs
          );

          logger.info(`Competitor ${comp.id}: ${recentPosts.length} recent posts (of ${postsResult.data.length} total)`);

          // Also update competitor name/headline from first post if available
          if (postsResult.data.length > 0) {
            const firstPost = postsResult.data[0];
            await supabase
              .from('cp_monitored_competitors')
              .update({
                name: firstPost.author?.firstName && firstPost.author?.lastName
                  ? `${firstPost.author.firstName} ${firstPost.author.lastName}`
                  : firstPost.authorName || undefined,
                headline: firstPost.author?.occupation || undefined,
              })
              .eq('id', comp.id);
          }

          for (const post of recentPosts) {
            const postUrl = post.url;
            if (!postUrl) continue;

            const result = await scrapeAndStoreEngagers({
              postUrl,
              userId: comp.user_id,
              competitorId: comp.id,
              source: 'competitor',
              heyreachCampaignId: comp.heyreach_campaign_id || undefined,
            });

            logger.info(`Competitor post: ${result.comments} comments, ${result.likers} likers`, {
              competitorId: comp.id,
              postUrl: postUrl.substring(0, 80),
              errors: result.errors,
            });

            totalScraped++;
            allErrors.push(...result.errors);
          }

          // Update last_scraped_at
          await supabase
            .from('cp_monitored_competitors')
            .update({ last_scraped_at: new Date().toISOString() })
            .eq('id', comp.id);

        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          logger.error(`Failed to scrape competitor ${comp.id}`, { error: msg });
          allErrors.push(`competitor:${comp.id}: ${msg}`);
        }
      }
    }

    logger.info(`Engagement scrape complete: ${totalScraped} targets scraped, ${allErrors.length} errors`);
    return { scraped: totalScraped, errors: allErrors };
  },
});
```

**Step 2:** Commit:
```bash
git add src/trigger/scrape-engagement.ts && git commit -m "feat: rewrite scrape-engagement to use Apify instead of Unipile"
```

---

## Task 6: Refactor comment automation to use HeyReach for DM/connect

**Files:**
- Modify: `src/lib/services/linkedin-automation.ts`

**Step 1:** Replace the DM and connection-request actions with HeyReach campaign enrollment. Keep like and reply on Unipile.

In `processComment()`, replace:
- Section `// 2. Send DM if template exists` — replace Unipile `client.startChat()` with `pushLeadsToHeyReach()` using the automation's `heyreach_campaign_id` and `resource_url` as a custom variable.
- Section `// 3. Auto-connect` — remove entirely (HeyReach campaign handles connect + DM sequence).
- Section `// 5. Schedule follow-up DM` — remove entirely (HeyReach handles sequencing).
- Keep section `// 1. Auto-like` and `// 4. Reply to comment` on Unipile.

Update imports: add `pushLeadsToHeyReach` from heyreach, remove `getUserPostingAccountId`.

The `accountId` is still needed for like/reply (Unipile actions). If no accountId, skip like/reply but still do HeyReach enrollment.

Key changes to the function:

```typescript
// 2. Enroll in HeyReach campaign (replaces Unipile DM)
if (automation.heyreach_campaign_id && comment.commenterLinkedinUrl) {
  try {
    const customVars: Record<string, string> = {};
    if (automation.resource_url) {
      customVars.resource_url = automation.resource_url;
    }

    const result = await pushLeadsToHeyReach(
      automation.heyreach_campaign_id,
      [{
        profileUrl: comment.commenterLinkedinUrl,
        firstName: comment.commenterName.split(' ')[0] || undefined,
        lastName: comment.commenterName.split(' ').slice(1).join(' ') || undefined,
        customVariables: Object.keys(customVars).length > 0 ? customVars : undefined,
      }]
    );

    if (!result.success) throw new Error(result.error || 'HeyReach push failed');
    actions.push('heyreach_enrolled');
    await logEvent(automation.id, 'dm_sent', comment, `HeyReach campaign ${automation.heyreach_campaign_id}`);

    // Increment leads_captured
    await supabase
      .from('linkedin_automations')
      .update({ leads_captured: (automation.leads_captured || 0) + 1 })
      .eq('id', automation.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    errors.push(`heyreach: ${msg}`);
    await logEvent(automation.id, 'dm_failed', comment, undefined, msg);
  }
}
```

Remove the auto_connect section (3) and follow-up section (5) entirely.

**Step 2:** Commit:
```bash
git add src/lib/services/linkedin-automation.ts && git commit -m "feat: route automation DMs through HeyReach, keep like/reply on Unipile"
```

---

## Task 7: Update process-linkedin-comment task (remove follow-up DM)

**Files:**
- Modify: `src/trigger/process-linkedin-comment.ts`

**Step 1:** Remove the follow-up DM scheduling block (lines 55-76 in current file). HeyReach handles sequencing now. The rest of the task stays the same.

Remove:
```typescript
// If follow-up was scheduled, trigger the delayed task
if (
  result.actions.includes('follow_up_scheduled') &&
  ...
```

**Step 2:** Commit:
```bash
git add src/trigger/process-linkedin-comment.ts && git commit -m "refactor: remove follow-up DM scheduling, HeyReach handles sequences"
```

---

## Task 8: Clean up Unipile client (remove scraping methods)

**Files:**
- Modify: `src/lib/integrations/unipile.ts`

**Step 1:** Remove these methods and functions:
- `getPostComments()` method
- `getPostReactions()` method
- `getUserProfile()` method
- `getMonitorAccountId()` function
- `startChat()` method (DMs now go through HeyReach)
- `sendInvitation()` method (connections now go through HeyReach)

Keep:
- `UnipileClient` class with constructor
- `requestHostedAuthLink()`
- `createPost()`
- `getPost()` (for post status checking)
- `addComment()`
- `addReaction()`
- `verifyConnection()`
- `deleteAccount()`
- `getUnipileClient()`
- `isUnipileConfigured()`
- `getUserPostingAccountId()`

**Step 2:** Commit:
```bash
git add src/lib/integrations/unipile.ts && git commit -m "refactor: strip Unipile to publishing + like/reply only"
```

---

## Task 9: Delete send-follow-up-dm task

**Files:**
- Delete: `src/trigger/send-follow-up-dm.ts`

**Step 1:** Delete the file. HeyReach handles follow-up sequencing now.

**Step 2:** Remove any imports of `sendFollowUpDm` elsewhere:
```bash
grep -r "send-follow-up-dm\|sendFollowUpDm" src/ --include="*.ts" --include="*.tsx"
```
The only reference should be in `process-linkedin-comment.ts` which we already cleaned up in Task 7.

**Step 3:** Commit:
```bash
git rm src/trigger/send-follow-up-dm.ts && git commit -m "refactor: remove send-follow-up-dm task, HeyReach handles sequences"
```

---

## Task 10: Competitor monitoring API routes

**Files:**
- Create: `src/app/api/competitors/route.ts` (GET list + POST create)
- Create: `src/app/api/competitors/[id]/route.ts` (PATCH update + DELETE)

**Step 1:** Create `src/app/api/competitors/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';

const MAX_COMPETITORS = 10;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('cp_monitored_competitors')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get engagement counts per competitor
    const competitors = await Promise.all(
      (data || []).map(async (comp) => {
        const { count } = await supabase
          .from('cp_post_engagements')
          .select('id', { count: 'exact', head: true })
          .eq('competitor_id', comp.id);
        return { ...comp, total_engagers: count || 0 };
      })
    );

    return NextResponse.json({ competitors });
  } catch (error) {
    logError('api/competitors', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { linkedinProfileUrl, heyreachCampaignId } = body as {
      linkedinProfileUrl: string;
      heyreachCampaignId?: string;
    };

    if (!linkedinProfileUrl?.trim()) {
      return NextResponse.json({ error: 'LinkedIn profile URL is required' }, { status: 400 });
    }

    // Normalize URL
    let normalizedUrl = linkedinProfileUrl.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = `https://www.linkedin.com/in/${normalizedUrl}`;
    }
    // Strip query params
    normalizedUrl = normalizedUrl.split('?')[0].replace(/\/$/, '');

    const supabase = createSupabaseAdminClient();

    // Check limit
    const { count } = await supabase
      .from('cp_monitored_competitors')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', session.user.id);

    if ((count || 0) >= MAX_COMPETITORS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_COMPETITORS} competitors allowed` },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('cp_monitored_competitors')
      .insert({
        user_id: session.user.id,
        linkedin_profile_url: normalizedUrl,
        heyreach_campaign_id: heyreachCampaignId || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Competitor already added' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ competitor: data }, { status: 201 });
  } catch (error) {
    logError('api/competitors', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Step 2:** Create `src/app/api/competitors/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if ('is_active' in body && typeof body.is_active === 'boolean') {
      updates.is_active = body.is_active;
    }
    if ('heyreach_campaign_id' in body) {
      updates.heyreach_campaign_id = body.heyreach_campaign_id || null;
    }

    const { data, error } = await supabase
      .from('cp_monitored_competitors')
      .update(updates)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Competitor not found' }, { status: 404 });
    }

    return NextResponse.json({ competitor: data });
  } catch (error) {
    logError('api/competitors', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('cp_monitored_competitors')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    logError('api/competitors', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Step 3:** Commit:
```bash
git add src/app/api/competitors/ && git commit -m "feat: add competitor monitoring CRUD API routes"
```

---

## Task 11: Competitor monitoring UI component

**Files:**
- Create: `src/components/settings/CompetitorMonitoring.tsx`
- Modify: `src/components/dashboard/SettingsContent.tsx`

**Step 1:** Create `src/components/settings/CompetitorMonitoring.tsx` — a Settings card that:
- Lists monitored competitors (name, headline, last scraped, total engagers, active toggle)
- Has an "Add Competitor" form (LinkedIn URL input + optional HeyReach campaign ID)
- Shows max 10 limit
- Delete button per competitor
- Uses the API routes from Task 10

Follow the same patterns as `LinkedInSettings.tsx` — `'use client'`, fetch on mount, loading states, error handling.

**Step 2:** Add `CompetitorMonitoring` to `SettingsContent.tsx` in the Integrations section, after `LinkedInSettings`:

```typescript
import { CompetitorMonitoring } from '@/components/settings/CompetitorMonitoring';
```

Add after the LinkedIn settings block:
```tsx
{/* Competitor Monitoring */}
<CompetitorMonitoring />
```

**Step 3:** Commit:
```bash
git add src/components/settings/CompetitorMonitoring.tsx src/components/dashboard/SettingsContent.tsx && git commit -m "feat: add competitor monitoring UI in settings"
```

---

## Task 12: Update automation API + UI to support HeyReach campaign

**Files:**
- Modify: `src/app/api/linkedin/automations/route.ts`

**Step 1:** Add `heyreachCampaignId` and `resourceUrl` to the POST handler's body destructuring and insert:

Add to the destructured body type:
```typescript
heyreachCampaignId?: string;
resourceUrl?: string;
```

Add to the insert object:
```typescript
heyreach_campaign_id: heyreachCampaignId || null,
resource_url: resourceUrl || null,
```

**Step 2:** Commit:
```bash
git add src/app/api/linkedin/automations/route.ts && git commit -m "feat: add HeyReach campaign + resource URL to automation API"
```

---

## Task 13: Deploy

**Step 1:** Typecheck:
```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit
```

**Step 2:** Deploy to Vercel:
```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && vercel --prod
```

**Step 3:** Deploy Trigger.dev tasks:
```bash
cd "/Users/timlife/Documents/claude code/magnetlab" && TRIGGER_SECRET_KEY=tr_prod_DB3vrdcduJYcXF19rrEB npx trigger.dev@4.3.3 deploy
```

**Step 4:** Verify the scrape-engagement cron starts running in Trigger.dev dashboard.

---

## Task 14: Update CLAUDE.md with new architecture

**Files:**
- Modify: `CLAUDE.md`

**Step 1:** Add an "Engagement Intelligence" section documenting:
- Apify actors used and their input/output
- `cp_monitored_competitors` table
- Schema changes to `cp_post_engagements`
- Tool responsibility split (Unipile vs Apify vs HeyReach)
- Env vars needed
- Key files

**Step 2:** Commit:
```bash
git add CLAUDE.md && git commit -m "docs: add engagement intelligence system to CLAUDE.md"
```
