import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getPostComments, getPostReactions } from '@/lib/integrations/harvest-api';
import { pushLeadsToHeyReach } from '@/lib/integrations/heyreach/client';

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

  // Scrape commenters via Harvest API
  const commentersResult = await getPostComments(target.postUrl);
  if (commentersResult.error) {
    errors.push(`commenters: ${commentersResult.error}`);
  } else if (commentersResult.data.length > 0) {
    const rows = commentersResult.data.map(c => {
      const { firstName, lastName } = splitName(c.actor.name);
      return {
        user_id: target.userId,
        post_id: target.postId || null,
        competitor_id: target.competitorId || null,
        source: target.source,
        source_post_url: target.postUrl,
        provider_id: c.actor.linkedinUrl,
        engagement_type: 'comment' as const,
        comment_text: c.commentary || null,
        first_name: firstName,
        last_name: lastName,
        linkedin_url: c.actor.linkedinUrl,
        subtitle: c.actor.position || null,
        engaged_at: c.createdAt || null,
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
      errors.push(`comment upsert: ${upsertErr.message}`);
    } else {
      commentCount = rows.length;
    }
  }

  // Scrape reactors via Harvest API
  const reactionsResult = await getPostReactions(target.postUrl);
  if (reactionsResult.error) {
    errors.push(`reactions: ${reactionsResult.error}`);
  } else if (reactionsResult.data.length > 0) {
    const rows = reactionsResult.data.map(r => {
      const { firstName, lastName } = splitName(r.actor.name);
      return {
        user_id: target.userId,
        post_id: target.postId || null,
        competitor_id: target.competitorId || null,
        source: target.source,
        source_post_url: target.postUrl,
        provider_id: r.actor.linkedinUrl,
        engagement_type: 'reaction' as const,
        reaction_type: r.reactionType || 'LIKE',
        first_name: firstName,
        last_name: lastName,
        linkedin_url: r.actor.linkedinUrl,
        subtitle: r.actor.position || null,
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
      errors.push(`reaction upsert: ${upsertErr.message}`);
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
    logger.info('Starting engagement scrape cycle (Harvest API)');

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

    // Competitor scraping fully migrated to signal-profile-scan.ts (Harvest API)

    logger.info(`Engagement scrape complete: ${totalScraped} targets scraped, ${allErrors.length} errors`);
    return { scraped: totalScraped, errors: allErrors };
  },
});
