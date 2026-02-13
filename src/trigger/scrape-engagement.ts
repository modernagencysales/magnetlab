import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getUnipileClient } from '@/lib/integrations/unipile';
import { pushLeadsToHeyReach } from '@/lib/integrations/heyreach';

// ============================================
// SCRAPE SCHEDULE: taper off as post ages
// ============================================

function shouldScrapeNow(publishedAt: string, lastScrapeAt: string | null): boolean {
  const now = Date.now();
  const published = new Date(publishedAt).getTime();
  const ageMs = now - published;
  const ageHours = ageMs / (1000 * 60 * 60);

  // Post older than 7 days — should be disabled, not scraped
  if (ageHours > 7 * 24) return false;

  if (!lastScrapeAt) return true; // Never scraped

  const lastScrape = new Date(lastScrapeAt).getTime();
  const sinceScrapeMs = now - lastScrape;
  const sinceScrapeMin = sinceScrapeMs / (1000 * 60);

  // 0-2h: every 10 min
  if (ageHours <= 2) return sinceScrapeMin >= 10;
  // 2-8h: every 30 min
  if (ageHours <= 8) return sinceScrapeMin >= 30;
  // 8-24h: every 2 hours
  if (ageHours <= 24) return sinceScrapeMin >= 120;
  // 1-7 days: every 6 hours
  return sinceScrapeMin >= 360;
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================
// CRON TASK: every 10 minutes
// ============================================

export const scrapeEngagement = schedules.task({
  id: 'scrape-engagement',
  cron: '*/10 * * * *',
  maxDuration: 300,
  run: async () => {
    const supabase = createSupabaseAdminClient();

    logger.info('Starting engagement scrape cycle');

    // ==========================================
    // STEP 0: Auto-disable scraping for old posts (7+ days)
    // ==========================================
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: expiredPosts, error: expireErr } = await supabase
      .from('cp_pipeline_posts')
      .update({ scrape_engagement: false })
      .eq('scrape_engagement', true)
      .eq('status', 'published')
      .lt('published_at', sevenDaysAgo)
      .select('id');

    if (expireErr) {
      logger.error('Failed to disable expired posts', { error: expireErr.message });
    } else if (expiredPosts && expiredPosts.length > 0) {
      logger.info(`Disabled scraping for ${expiredPosts.length} expired posts`);
    }

    // ==========================================
    // STEP 1: Find posts that need scraping
    // ==========================================
    const { data: posts, error: postsErr } = await supabase
      .from('cp_pipeline_posts')
      .select('id, user_id, linkedin_post_id, heyreach_campaign_id, published_at, last_engagement_scrape_at, engagement_scrape_count')
      .eq('scrape_engagement', true)
      .eq('status', 'published')
      .not('linkedin_post_id', 'is', null)
      .limit(10);

    if (postsErr) {
      logger.error('Failed to query posts', { error: postsErr.message });
      return { scraped: 0, errors: [postsErr.message] };
    }

    if (!posts || posts.length === 0) {
      logger.info('No posts to scrape');
      return { scraped: 0, errors: [] };
    }

    // Filter by scrape schedule
    const eligiblePosts = posts.filter(p =>
      shouldScrapeNow(p.published_at!, p.last_engagement_scrape_at)
    );

    if (eligiblePosts.length === 0) {
      logger.info('No posts due for scraping right now');
      return { scraped: 0, errors: [] };
    }

    logger.info(`${eligiblePosts.length} posts eligible for scraping`);

    let unipileClient;
    try {
      unipileClient = getUnipileClient();
    } catch (err) {
      logger.error('Failed to initialize Unipile client', { error: (err as Error).message });
      return { scraped: 0, errors: ['Unipile not configured'] };
    }

    let totalScraped = 0;
    const errors: string[] = [];

    for (const post of eligiblePosts) {
      try {
        const postId = post.linkedin_post_id!;
        logger.info(`Scraping post ${post.id}`, { linkedinPostId: postId });

        // ==========================================
        // STEP 2: Scrape comments (paginated)
        // ==========================================
        let commentCursor: string | undefined;
        let commentCount = 0;
        do {
          const commentsResult = await unipileClient.getPostComments(postId, undefined, commentCursor);
          if (commentsResult.error || !commentsResult.data?.items) {
            logger.warn(`Failed to fetch comments for post ${post.id}`, { error: commentsResult.error });
            break;
          }

          const comments = commentsResult.data.items;
          if (comments.length === 0) break;

          const commentRows = comments.map(c => {
            const { firstName, lastName } = splitName(c.author.name);
            return {
              user_id: post.user_id,
              post_id: post.id,
              provider_id: c.author.provider_id,
              engagement_type: 'comment' as const,
              comment_text: c.text,
              first_name: firstName,
              last_name: lastName,
              engaged_at: c.created_at,
              heyreach_campaign_id: post.heyreach_campaign_id,
            };
          });

          const { error: upsertErr } = await supabase
            .from('cp_post_engagements')
            .upsert(commentRows, { onConflict: 'post_id,provider_id,engagement_type', ignoreDuplicates: true });

          if (upsertErr) {
            logger.warn(`Comment upsert error for post ${post.id}`, { error: upsertErr.message });
          }

          commentCount += comments.length;
          commentCursor = commentsResult.data.cursor;
        } while (commentCursor);

        // ==========================================
        // STEP 3: Scrape reactions (paginated)
        // ==========================================
        let reactionCursor: string | undefined;
        let reactionCount = 0;
        do {
          const reactionsResult = await unipileClient.getPostReactions(postId, undefined, reactionCursor);
          if (reactionsResult.error || !reactionsResult.data?.items) {
            logger.warn(`Failed to fetch reactions for post ${post.id}`, { error: reactionsResult.error });
            break;
          }

          const reactions = reactionsResult.data.items;
          if (reactions.length === 0) break;

          const reactionRows = reactions.map(r => {
            const { firstName, lastName } = splitName(r.author.name);
            return {
              user_id: post.user_id,
              post_id: post.id,
              provider_id: r.author.provider_id,
              engagement_type: 'reaction' as const,
              reaction_type: r.type,
              first_name: firstName,
              last_name: lastName,
              heyreach_campaign_id: post.heyreach_campaign_id,
            };
          });

          const { error: upsertErr } = await supabase
            .from('cp_post_engagements')
            .upsert(reactionRows, { onConflict: 'post_id,provider_id,engagement_type', ignoreDuplicates: true });

          if (upsertErr) {
            logger.warn(`Reaction upsert error for post ${post.id}`, { error: upsertErr.message });
          }

          reactionCount += reactions.length;
          reactionCursor = reactionsResult.data.cursor;
        } while (reactionCursor);

        logger.info(`Post ${post.id}: ${commentCount} comments, ${reactionCount} reactions scraped`);

        // ==========================================
        // STEP 4: Resolve unresolved profiles (max 20 per post per cycle)
        // ==========================================
        const { data: unresolvedEngagements } = await supabase
          .from('cp_post_engagements')
          .select('id, provider_id')
          .eq('post_id', post.id)
          .is('linkedin_url', null)
          .limit(20);

        if (unresolvedEngagements && unresolvedEngagements.length > 0) {
          let resolved = 0;

          for (const engagement of unresolvedEngagements) {
            // Check cache first
            const { data: cached } = await supabase
              .from('cp_linkedin_profiles')
              .select('linkedin_url, first_name, last_name')
              .eq('provider_id', engagement.provider_id)
              .single();

            if (cached) {
              // Update engagement from cache
              await supabase
                .from('cp_post_engagements')
                .update({
                  linkedin_url: cached.linkedin_url,
                  first_name: cached.first_name,
                  last_name: cached.last_name,
                })
                .eq('id', engagement.id);
              resolved++;
              continue;
            }

            // Resolve via Unipile API
            await delay(500); // Rate limit protection
            const profileResult = await unipileClient.getUserProfile(engagement.provider_id);

            if (profileResult.error || !profileResult.data) {
              logger.warn(`Failed to resolve profile ${engagement.provider_id}`, { error: profileResult.error });
              continue;
            }

            const profile = profileResult.data;
            const linkedinUrl = profile.public_identifier
              ? `https://www.linkedin.com/in/${profile.public_identifier}/`
              : null;

            if (!linkedinUrl) {
              logger.warn(`No public_identifier for provider ${engagement.provider_id}`);
              continue;
            }

            const nameParts = splitName(profile.name || '');
            const firstName = profile.first_name || nameParts.firstName;
            const lastName = profile.last_name || nameParts.lastName;

            // Cache the resolved profile
            await supabase
              .from('cp_linkedin_profiles')
              .upsert({
                provider_id: engagement.provider_id,
                first_name: firstName,
                last_name: lastName,
                linkedin_url: linkedinUrl,
                headline: profile.headline || null,
                resolved_at: new Date().toISOString(),
              }, { onConflict: 'provider_id' });

            // Update the engagement record
            await supabase
              .from('cp_post_engagements')
              .update({
                linkedin_url: linkedinUrl,
                first_name: firstName,
                last_name: lastName,
              })
              .eq('id', engagement.id);

            resolved++;
          }

          logger.info(`Post ${post.id}: resolved ${resolved}/${unresolvedEngagements.length} profiles`);
        }

        // ==========================================
        // STEP 5: Push resolved+unpushed leads to HeyReach
        // ==========================================
        if (post.heyreach_campaign_id) {
          const { data: unpushedLeads } = await supabase
            .from('cp_post_engagements')
            .select('id, linkedin_url, first_name, last_name')
            .eq('post_id', post.id)
            .not('linkedin_url', 'is', null)
            .is('heyreach_pushed_at', null)
            .eq('heyreach_campaign_id', post.heyreach_campaign_id)
            .limit(100);

          if (unpushedLeads && unpushedLeads.length > 0) {
            const result = await pushLeadsToHeyReach(
              post.heyreach_campaign_id,
              unpushedLeads.map(l => ({
                profileUrl: l.linkedin_url!,
                firstName: l.first_name || undefined,
                lastName: l.last_name || undefined,
              }))
            );

            const now = new Date().toISOString();
            if (result.success) {
              // Mark all as pushed
              const ids = unpushedLeads.map(l => l.id);
              await supabase
                .from('cp_post_engagements')
                .update({ heyreach_pushed_at: now })
                .in('id', ids);

              logger.info(`Post ${post.id}: pushed ${result.added} leads to HeyReach campaign ${post.heyreach_campaign_id}`);
            } else {
              // Mark error on all
              const ids = unpushedLeads.map(l => l.id);
              await supabase
                .from('cp_post_engagements')
                .update({ heyreach_error: result.error || 'Unknown error' })
                .in('id', ids);

              logger.error(`Post ${post.id}: HeyReach push failed`, { error: result.error });
            }
          }
        }

        // ==========================================
        // STEP 6: Update scrape metadata
        // ==========================================
        await supabase
          .from('cp_pipeline_posts')
          .update({
            last_engagement_scrape_at: new Date().toISOString(),
            engagement_scrape_count: (post.engagement_scrape_count || 0) + 1,
          })
          .eq('id', post.id);

        totalScraped++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`Failed to scrape post ${post.id}`, { error: message });
        errors.push(`Post ${post.id}: ${message}`);
      }
    }

    logger.info(`Engagement scrape complete: ${totalScraped} posts scraped, ${errors.length} errors`);
    return { scraped: totalScraped, errors };
  },
});
