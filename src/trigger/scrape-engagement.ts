import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { scrapeEngagers, scrapeProfilePosts } from '@/lib/integrations/apify-engagers';
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
        provider_id: c.url_profile,
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

    // DEPRECATED: Competitor scraping migrated to signal-profile-scan.ts (Harvest API)
    // Phase 2 code below is disabled. Remove after confirming signal-profile-scan is stable.
    if (false) {
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

          // Update competitor name/headline from first post if available
          if (postsResult.data.length > 0) {
            const firstPost = postsResult.data[0];
            const updateFields: Record<string, string> = {};
            if (firstPost.author?.firstName && firstPost.author?.lastName) {
              updateFields.name = `${firstPost.author.firstName} ${firstPost.author.lastName}`;
            } else if (firstPost.authorName) {
              updateFields.name = firstPost.authorName;
            }
            if (firstPost.author?.occupation) {
              updateFields.headline = firstPost.author.occupation;
            }
            if (Object.keys(updateFields).length > 0) {
              await supabase
                .from('cp_monitored_competitors')
                .update(updateFields)
                .eq('id', comp.id);
            }
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
    } // end disabled Phase 2

    logger.info(`Engagement scrape complete: ${totalScraped} targets scraped, ${allErrors.length} errors`);
    return { scraped: totalScraped, errors: allErrors };
  },
});
