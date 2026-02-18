import { task, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { extractTemplateFromPost } from '@/lib/ai/content-pipeline/template-extractor';
import { generateEmbedding, createTemplateEmbeddingText } from '@/lib/ai/embeddings';

/**
 * Extract winning templates from viral posts.
 *
 * Triggered by `scrape-linkedin-content` after finding winners.
 * Processes cp_viral_posts marked as winners that haven't been extracted yet.
 * For each winner:
 *   1. Extracts reusable template structure via Claude
 *   2. Generates pgvector embedding for semantic matching
 *   3. Saves as a global cp_post_template
 *   4. Adds to swipe_file_posts for community inspiration
 *   5. Marks the viral post as processed
 */
export const extractWinningTemplates = task({
  id: 'extract-winning-templates',
  maxDuration: 300, // 5 minutes
  retry: { maxAttempts: 2 },
  run: async () => {
    const supabase = createSupabaseAdminClient();
    const runStartedAt = new Date().toISOString();

    // ─── 1. Fetch unprocessed winners ─────────────────────────────────────────
    const { data: winners, error: winnersError } = await supabase
      .from('cp_viral_posts')
      .select('id, author_name, author_headline, author_url, content, likes, comments, shares, engagement_score')
      .eq('is_winner', true)
      .eq('template_extracted', false)
      .order('engagement_score', { ascending: false })
      .limit(30);

    if (winnersError) {
      logger.error('Failed to fetch winning viral posts', { error: winnersError.message });
      throw new Error(`Failed to fetch winners: ${winnersError.message}`);
    }

    if (!winners || winners.length === 0) {
      logger.info('No unprocessed winning viral posts found');
      return { processed: 0, skipped: true };
    }

    logger.info('Found unprocessed winners', { count: winners.length });

    // ─── 2. Get a user_id for the FK on cp_post_templates ─────────────────────
    // cp_post_templates.user_id is NOT NULL, so we need a real user.
    const { data: anyUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .limit(1)
      .single();

    if (userError || !anyUser) {
      logger.error('No users found for template FK', { error: userError?.message });
      throw new Error('Cannot create templates: no users in database');
    }

    const systemUserId = anyUser.id;

    // ─── 3. Process in batches of 3 ──────────────────────────────────────────
    let templatesExtracted = 0;
    let swipeFileSaved = 0;
    const errors: string[] = [];
    const BATCH_SIZE = 3;

    for (let i = 0; i < winners.length; i += BATCH_SIZE) {
      const batch = winners.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (post) => {
          try {
            // a. Extract template structure via Claude
            logger.info('Extracting template from post', { postId: post.id, author: post.author_name });
            const extracted = await extractTemplateFromPost(post.content);

            // b. Generate embedding
            const description = `Extracted from ${post.author_name || 'Unknown'}'s post (${post.likes ?? 0} likes, ${post.comments ?? 0} comments)`;
            const embeddingText = createTemplateEmbeddingText({
              name: extracted.name,
              category: extracted.category,
              description,
              structure: extracted.structure,
              use_cases: extracted.use_cases,
              tags: extracted.tags,
            });
            const embedding = await generateEmbedding(embeddingText);

            // c. Insert into cp_post_templates
            const { data: template, error: templateError } = await supabase
              .from('cp_post_templates')
              .insert({
                user_id: systemUserId,
                name: extracted.name,
                category: extracted.category,
                description,
                structure: extracted.structure,
                example_posts: [post.content],
                use_cases: extracted.use_cases,
                tags: extracted.tags,
                embedding: JSON.stringify(embedding),
                source: 'scraped',
                is_global: true,
                scraped_post_id: post.id,
              })
              .select('id')
              .single();

            if (templateError) {
              throw new Error(`Failed to insert template: ${templateError.message}`);
            }

            // d. Insert into swipe_file_posts
            const { error: swipeError } = await supabase
              .from('swipe_file_posts')
              .insert({
                content: post.content,
                author_name: post.author_name,
                author_headline: post.author_headline,
                likes_count: post.likes,
                comments_count: post.comments,
                post_type: extracted.category || 'educational',
                niche: 'other',
                status: 'approved',
                is_curated: true,
              });

            if (swipeError) {
              logger.warn('Failed to insert swipe file post (non-critical)', {
                postId: post.id,
                error: swipeError.message,
              });
            } else {
              swipeFileSaved++;
            }

            // e. Mark viral post as processed
            const { error: updateError } = await supabase
              .from('cp_viral_posts')
              .update({
                template_extracted: true,
                extracted_template_id: template.id,
              })
              .eq('id', post.id);

            if (updateError) {
              logger.warn('Failed to mark viral post as processed', {
                postId: post.id,
                error: updateError.message,
              });
            }

            templatesExtracted++;

            logger.info('Template extracted successfully', {
              postId: post.id,
              templateId: template.id,
              templateName: extracted.name,
              category: extracted.category,
            });

            return { postId: post.id, templateId: template.id };
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            logger.error('Failed to extract template from post', {
              postId: post.id,
              error: msg,
            });
            errors.push(`post ${post.id}: ${msg}`);

            // Mark as processed to avoid infinite retries on consistently failing posts
            await supabase
              .from('cp_viral_posts')
              .update({ template_extracted: true })
              .eq('id', post.id);

            throw error;
          }
        })
      );

      // Log batch results
      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;
      logger.info('Batch complete', {
        batchIndex: Math.floor(i / BATCH_SIZE),
        succeeded,
        failed,
      });
    }

    // ─── 4. Log extraction run ────────────────────────────────────────────────
    const { error: logError } = await supabase.from('cp_pipeline_scrape_runs').insert({
      run_type: 'extraction',
      posts_found: winners.length,
      winners_found: winners.length,
      templates_extracted: templatesExtracted,
      started_at: runStartedAt,
      completed_at: new Date().toISOString(),
      error_log: errors.length > 0 ? errors.join('\n') : null,
    });

    if (logError) {
      logger.warn('Failed to log extraction run', { error: logError.message });
    }

    const summary = {
      winnersProcessed: winners.length,
      templatesExtracted,
      swipeFileSaved,
      errors: errors.length,
    };

    logger.info('Extraction run complete', summary);

    return summary;
  },
});
