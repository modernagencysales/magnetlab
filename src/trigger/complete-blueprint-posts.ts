/** Complete blueprint posts with real knowledge from content interviews.
 * Scores ~60 blueprint posts, selects top N, matches with knowledge entries,
 * completes/rewrites with verified details, and inserts as pipeline posts.
 * Constraint: Never modifies the original posts table — only reads from it.
 */

import { task, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getAnthropicClient, parseJsonResponse } from '@/lib/ai/content-pipeline/anthropic-client';
import { CLAUDE_SONNET_MODEL } from '@/lib/ai/content-pipeline/model-config';
import { buildContentBrief } from '@/lib/ai/content-pipeline/briefing-agent';
import { polishPost } from '@/lib/ai/content-pipeline/post-polish';
import { fireDfyCallback } from '@/server/services/dfy-callback';
import { logError } from '@/lib/utils/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CompleteBlueprintPostsPayload {
  userId: string;
  prospectId: string;
  maxPosts?: number;
  engagementId?: string;
}

/** Shape of a row from the shared `posts` table (owned by leadmagnet-backend). */
interface BlueprintPost {
  id: string;
  prospect_id: string;
  name: string;
  post_content: string;
  first_sentence: string | null;
  action_items: string | null;
  post_ready: boolean;
  to_fix: boolean;
  number: number | null;
}

interface ScoredPost {
  post_id: string;
  score: number;
  reasoning: string;
}

interface CompletedPost {
  originalName: string;
  finalContent: string;
  hookScore: number | null;
  polishChanges: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const BLUEPRINT_POST_COLUMNS =
  'id, prospect_id, name, post_content, first_sentence, action_items, post_ready, to_fix, number';

const KNOWLEDGE_ENTRY_COUNT_COLUMNS = 'id';

const BATCH_SIZE = 3;

// ─── Task ───────────────────────────────────────────────────────────────────

export const completeBlueprintPostsTask = task({
  id: 'complete-blueprint-posts',
  maxDuration: 600,
  retry: { maxAttempts: 1 },
  run: async (payload: CompleteBlueprintPostsPayload) => {
    const { userId, prospectId, maxPosts = 15, engagementId } = payload;
    const supabase = createSupabaseAdminClient();

    logger.info('Starting blueprint post completion', { userId, prospectId, maxPosts });

    // ─── Step 1: Load data ────────────────────────────────────────────

    const { data: blueprintPosts, error: postsError } = await supabase
      .from('posts')
      .select(BLUEPRINT_POST_COLUMNS)
      .eq('prospect_id', prospectId)
      .order('number', { ascending: true });

    if (postsError) {
      throw new Error(`Failed to load blueprint posts: ${postsError.message}`);
    }

    if (!blueprintPosts || blueprintPosts.length === 0) {
      throw new Error(`No blueprint posts found for prospect_id=${prospectId}`);
    }

    const { count: knowledgeCount, error: knowledgeCountError } = await supabase
      .from('cp_knowledge_entries')
      .select(KNOWLEDGE_ENTRY_COUNT_COLUMNS, { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('superseded_by', null);

    if (knowledgeCountError) {
      throw new Error(`Failed to count knowledge entries: ${knowledgeCountError.message}`);
    }

    if (!knowledgeCount || knowledgeCount === 0) {
      throw new Error(
        `No knowledge entries found for user_id=${userId}. Process a content interview transcript first.`
      );
    }

    logger.info('Data loaded', {
      blueprintPostCount: blueprintPosts.length,
      knowledgeEntryCount: knowledgeCount,
    });

    // ─── Step 2: Score & select ───────────────────────────────────────

    const postSummaries = (blueprintPosts as BlueprintPost[]).map((p) => ({
      id: p.id,
      name: p.name,
      preview: (p.post_content || '').slice(0, 200),
      action_items: p.action_items || 'None listed',
    }));

    const scoringPrompt = buildScoringPrompt(postSummaries, maxPosts);
    const client = getAnthropicClient('complete-blueprint-posts');

    const scoringResponse = await client.messages.create({
      model: CLAUDE_SONNET_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: scoringPrompt }],
    });

    const scoringText = scoringResponse.content.find((b) => b.type === 'text');
    if (!scoringText || scoringText.type !== 'text') {
      throw new Error('No text response from scoring call');
    }

    const scoredPosts = parseJsonResponse<ScoredPost[]>(scoringText.text);

    if (!Array.isArray(scoredPosts) || scoredPosts.length === 0) {
      throw new Error('Scoring returned no valid results');
    }

    // Map scored post IDs back to full post objects
    const postMap = new Map((blueprintPosts as BlueprintPost[]).map((p) => [p.id, p]));
    const selectedPosts = scoredPosts
      .map((sp) => postMap.get(sp.post_id))
      .filter((p): p is BlueprintPost => p !== undefined)
      .slice(0, maxPosts);

    logger.info('Posts scored and selected', {
      totalScored: scoredPosts.length,
      selected: selectedPosts.length,
    });

    // ─── Step 3: Complete each selected post ──────────────────────────

    const completedPosts: CompletedPost[] = [];
    const errors: string[] = [];

    for (let i = 0; i < selectedPosts.length; i += BATCH_SIZE) {
      const batch = selectedPosts.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (post) => {
          try {
            return await completePost(post, userId);
          } catch (err) {
            const msg = `Failed to complete post "${post.name}": ${err instanceof Error ? err.message : String(err)}`;
            logError('complete-blueprint-posts', err, { postId: post.id, step: 'complete' });
            errors.push(msg);
            return null;
          }
        })
      );

      for (const result of batchResults) {
        if (result) completedPosts.push(result);
      }
    }

    logger.info('Posts completed', {
      completed: completedPosts.length,
      errors: errors.length,
    });

    if (completedPosts.length === 0) {
      throw new Error(`All post completions failed. Errors: ${errors.join('; ')}`);
    }

    // ─── Step 4: Insert into cp_pipeline_posts ────────────────────────

    const insertRows = completedPosts.map((cp) => ({
      user_id: userId,
      idea_id: null,
      draft_content: cp.finalContent,
      final_content: cp.finalContent,
      status: 'reviewing' as const,
      is_buffer: false,
      hook_score: cp.hookScore,
      polish_status: 'polished' as const,
      polish_notes: `Completed from blueprint post "${cp.originalName}". ${cp.polishChanges} improvements applied.`,
      variations: [],
      dm_template: null,
      cta_word: null,
      buffer_position: null,
      template_id: null,
      style_id: null,
      enable_automation: false,
      scrape_engagement: false,
      engagement_scrape_count: 0,
      image_urls: [],
    }));

    const { data: insertedPosts, error: insertError } = await supabase
      .from('cp_pipeline_posts')
      .insert(insertRows)
      .select('id, status');

    if (insertError) {
      throw new Error(`Failed to insert pipeline posts: ${insertError.message}`);
    }

    logger.info('Pipeline posts inserted', {
      count: insertedPosts?.length || 0,
    });

    // ─── Step 5: Fire DFY callback ───────────────────────────────────

    if (engagementId) {
      fireDfyCallback({
        engagement_id: engagementId,
        automation_type: 'content_calendar',
        status: 'completed',
        result: {
          posts_created: completedPosts.length,
          magnetlab_user_id: userId,
        },
      }).catch(() => {
        // Fire-and-forget — already logged inside fireDfyCallback
      });
    }

    return {
      postsScored: scoredPosts.length,
      postsSelected: selectedPosts.length,
      postsCompleted: completedPosts.length,
      postsInserted: insertedPosts?.length || 0,
      errors,
    };
  },
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildScoringPrompt(
  posts: Array<{ id: string; name: string; preview: string; action_items: string }>,
  maxPosts: number
): string {
  const postList = posts
    .map(
      (p, i) =>
        `[${i + 1}] ID: ${p.id}\nTitle: ${p.name}\nPreview: ${p.preview}\nAction Items: ${p.action_items}`
    )
    .join('\n\n');

  return `You are evaluating LinkedIn blueprint posts. These posts were generated from scraped LinkedIn profile data and contain unverified claims, placeholder details, and AI-generated content. We now have REAL knowledge from content interview transcripts that can fill in the gaps.

Score each post 1-10 on three dimensions:
1. **Hook strength** (1-10): How compelling is the opening? Will it stop the scroll?
2. **Topic relevance** (1-10): Is this a topic worth posting about? Does it address real business problems?
3. **Completability** (1-10): Based on the action_items, how feasible is it to complete this post with real interview knowledge? Posts needing specific stories, numbers, or how-tos score higher because interview transcripts are rich in those.

Compute an overall score as: (hook * 0.3) + (topic * 0.3) + (completability * 0.4)

Select the top ${maxPosts} posts by overall score.

POSTS TO EVALUATE:
${postList}

Respond with ONLY valid JSON — an array of objects sorted by score descending:
[
  {"post_id": "uuid-here", "score": 8.5, "reasoning": "Strong hook, completable with real client stories"},
  ...
]

Return exactly ${maxPosts} posts (or fewer if fewer than ${maxPosts} posts are provided). No markdown, no explanation outside the JSON.`;
}

function buildCompletionPrompt(post: BlueprintPost, knowledgeContext: string): string {
  return `You are completing a LinkedIn post by replacing unverified claims and placeholder content with REAL details from content interview transcripts.

ORIGINAL POST:
${post.post_content}

ACTION ITEMS (what needs fixing):
${post.action_items || 'No specific items listed — review for generic claims and replace with specifics.'}

REAL KNOWLEDGE FROM INTERVIEWS:
${knowledgeContext}

INSTRUCTIONS:
1. Keep the post's structure and hook intact (improve the hook only if it's weak)
2. Replace ALL unverified claims, placeholder numbers, and generic statements with real details from the knowledge context
3. If the knowledge doesn't cover a specific claim, either remove that section or reframe it around what IS known
4. Maintain the conversational, direct tone — no corporate speak
5. The post should read as if the person wrote it themselves, drawing on their real experience

CRITICAL STYLE RULES:
- No emojis, no hashtags, no em dashes
- No AI phrases: "game-changer," "here's the thing," "let me explain," "the truth is," "here's what most people miss," "let's dive in," "let's break it down," "crushing it," "next level," "deep dive," "leverage," "synergy," "robust," "seamless," "comprehensive," "holistic approach," "cutting-edge," "best-in-class," "world-class"
- No stacked one-liner declarations: "That's the game. That's it. Full stop."
- No three-item dramatic lists: "Every X, every Y, every Z."
- Write real sentences with subject-verb-object construction, not choppy fragments
- Short paragraphs (1-4 sentences), strategic line breaks
- Start with "I" about 70% of the time for hooks
- Make points through explanation and specifics, not declaration or repetition

Return ONLY the completed post text. No preamble, no explanation, no markdown wrappers.`;
}

async function completePost(post: BlueprintPost, userId: string): Promise<CompletedPost> {
  // Build knowledge brief using semantic search
  const searchQuery = [post.name, (post.post_content || '').slice(0, 300)]
    .filter(Boolean)
    .join(' ');
  const brief = await buildContentBrief(userId, searchQuery, { maxEntries: 10 });

  if (!brief.compiledContext || brief.compiledContext.trim().length === 0) {
    throw new Error(`No relevant knowledge found for post "${post.name}"`);
  }

  // Complete the post with real knowledge
  const completionPrompt = buildCompletionPrompt(post, brief.compiledContext);
  const client = getAnthropicClient('complete-blueprint-posts');

  const completionResponse = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content: completionPrompt }],
  });

  const completionText = completionResponse.content.find((b) => b.type === 'text');
  if (!completionText || completionText.type !== 'text') {
    throw new Error('No text response from completion call');
  }

  const completedContent = completionText.text.trim();

  // Polish the completed post
  const polishResult = await polishPost(completedContent);

  return {
    originalName: post.name,
    finalContent: polishResult.polished,
    hookScore: polishResult.hookScore?.score || null,
    polishChanges: polishResult.changes?.length || 0,
  };
}
