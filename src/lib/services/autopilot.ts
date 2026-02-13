import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getTopIdeas, type ScoringContext } from '@/lib/ai/content-pipeline/idea-scorer';
import { polishPost } from '@/lib/ai/content-pipeline/post-polish';
import { writePostFreeform } from '@/lib/ai/content-pipeline/post-writer';
import { buildContentBriefForIdea } from '@/lib/ai/content-pipeline/briefing-agent';
import { isEmbeddingsConfigured } from '@/lib/ai/embeddings';
import type {
  ContentIdea,
  ContentPillar,
  PillarDistribution,
  AutoPilotConfig,
  BatchResult,
} from '@/lib/types/content-pipeline';

const PILLAR_LOOKBACK_DAYS = 14;
const AUTO_PUBLISH_WINDOW_HOURS = 24;

export async function getPillarCounts(
  userId: string,
  days: number = PILLAR_LOOKBACK_DAYS,
  profileId?: string
): Promise<PillarDistribution> {
  const supabase = createSupabaseAdminClient();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  let postsQuery = supabase
    .from('cp_pipeline_posts')
    .select('idea_id')
    .eq('user_id', userId)
    .gte('created_at', cutoffDate.toISOString())
    .in('status', ['approved', 'scheduled', 'published']);

  if (profileId) {
    postsQuery = postsQuery.eq('team_profile_id', profileId);
  }

  const { data: posts } = await postsQuery;

  const ideaIds = posts?.map((p) => p.idea_id).filter(Boolean) || [];

  if (ideaIds.length === 0) {
    return { moments_that_matter: 0, teaching_promotion: 0, human_personal: 0, collaboration_social_proof: 0 };
  }

  const { data: ideas } = await supabase
    .from('cp_content_ideas')
    .select('content_pillar')
    .in('id', ideaIds);

  const counts: PillarDistribution = {
    moments_that_matter: 0, teaching_promotion: 0, human_personal: 0, collaboration_social_proof: 0,
  };

  for (const idea of ideas || []) {
    const pillar = idea.content_pillar as ContentPillar | null;
    if (pillar && pillar in counts) {
      counts[pillar]++;
    }
  }

  return counts;
}

async function getRecentPostTitles(userId: string, days: number = PILLAR_LOOKBACK_DAYS, profileId?: string): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  let postsQuery = supabase
    .from('cp_pipeline_posts')
    .select('idea_id')
    .eq('user_id', userId)
    .gte('created_at', cutoffDate.toISOString());

  if (profileId) {
    postsQuery = postsQuery.eq('team_profile_id', profileId);
  }

  const { data: posts } = await postsQuery;

  const ideaIds = posts?.map((p) => p.idea_id).filter(Boolean) || [];
  if (ideaIds.length === 0) return [];

  const { data: ideas } = await supabase
    .from('cp_content_ideas')
    .select('title')
    .in('id', ideaIds);

  return ideas?.map((i) => i.title) || [];
}

/**
 * Convert a wall-clock time in a given timezone to a UTC Date.
 * e.g. "14:00" in "America/New_York" → Date representing 14:00 ET in UTC
 */
function wallClockToUTC(baseDate: Date, hours: number, minutes: number, timezone: string): Date {
  // Get the date as seen in the target timezone
  const dateStr = baseDate.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD
  const [y, m, d] = dateStr.split('-').map(Number);

  // Create the wall-clock time as if UTC
  const naiveUTC = new Date(Date.UTC(y, m - 1, d, hours, minutes, 0, 0));

  // Find the timezone offset at this approximate time
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hour12: false,
  }).formatToParts(naiveUTC);

  const tzHour = parseInt(parts.find((p) => p.type === 'hour')!.value);
  const tzMinute = parseInt(parts.find((p) => p.type === 'minute')!.value);
  const tzDay = parseInt(parts.find((p) => p.type === 'day')!.value);

  // Offset = what the TZ shows minus what we wanted
  const tzTotalMinutes = tzDay * 24 * 60 + tzHour * 60 + tzMinute;
  const targetTotalMinutes = d * 24 * 60 + hours * 60 + minutes;
  const offsetMinutes = tzTotalMinutes - targetTotalMinutes;

  return new Date(naiveUTC.getTime() - offsetMinutes * 60 * 1000);
}

export async function getNextScheduledTime(
  userId: string,
  cachedScheduledTimes?: Set<number>
): Promise<Date> {
  const supabase = createSupabaseAdminClient();

  const { data: slots } = await supabase
    .from('cp_posting_slots')
    .select('id, user_id, slot_number, time_of_day, day_of_week, timezone, is_active, created_at, updated_at')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('slot_number', { ascending: true });

  if (!slots?.length) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setUTCHours(9, 0, 0, 0);
    return tomorrow;
  }

  // Find next available slot (timezone-aware)
  const now = new Date();
  const candidates: Date[] = [];

  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    for (const slot of slots) {
      const [hours, minutes] = slot.time_of_day.split(':').map(Number);
      const tz = slot.timezone || 'UTC';

      // Create a base date offset by dayOffset in the slot's timezone
      const baseDate = new Date(now.getTime() + dayOffset * 86400000);
      const candidate = wallClockToUTC(baseDate, hours, minutes, tz);

      if (candidate > now) {
        // Check day_of_week in the slot's timezone
        const dayName = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(candidate);
        const dayMap: Record<string, number> = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
        const dayInTZ = dayMap[dayName] ?? candidate.getUTCDay();
        if (slot.day_of_week === null || slot.day_of_week === dayInTZ) {
          candidates.push(candidate);
        }
      }
    }
  }

  candidates.sort((a, b) => a.getTime() - b.getTime());

  // Check for conflicts with already scheduled posts (use cache if provided)
  if (candidates.length > 0) {
    let scheduledTimes = cachedScheduledTimes;
    if (!scheduledTimes) {
      const { data: scheduledPosts } = await supabase
        .from('cp_pipeline_posts')
        .select('scheduled_time')
        .eq('user_id', userId)
        .eq('status', 'scheduled')
        .not('scheduled_time', 'is', null);

      scheduledTimes = new Set(
        scheduledPosts?.map((p) => new Date(p.scheduled_time!).getTime()) || []
      );
    }

    for (const candidate of candidates) {
      if (!scheduledTimes.has(candidate.getTime())) {
        return candidate;
      }
    }
  }

  // Fallback: tomorrow 9 AM UTC
  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 1);
  fallback.setUTCHours(9, 0, 0, 0);
  return fallback;
}

export async function getBufferSize(userId: string): Promise<number> {
  const supabase = createSupabaseAdminClient();

  const { count } = await supabase
    .from('cp_pipeline_posts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_buffer', true)
    .eq('status', 'approved');

  return count || 0;
}

export async function runNightlyBatch(config: AutoPilotConfig): Promise<BatchResult> {
  const { userId, postsPerBatch = 3, autoPublish = false, autoPublishDelayHours = AUTO_PUBLISH_WINDOW_HOURS, teamId, profileId } = config;
  const supabase = createSupabaseAdminClient();
  const result: BatchResult = { postsCreated: 0, postsScheduled: 0, ideasProcessed: 0, errors: [] };

  // Fetch voice profile if running for a specific team member
  let voiceProfile: import('@/lib/types/content-pipeline').TeamVoiceProfile | undefined;
  let authorName: string | undefined;
  let authorTitle: string | undefined;
  if (profileId) {
    const { data: profile } = await supabase
      .from('team_profiles')
      .select('full_name, title, voice_profile')
      .eq('id', profileId)
      .single();
    if (profile) {
      voiceProfile = profile.voice_profile as import('@/lib/types/content-pipeline').TeamVoiceProfile;
      authorName = profile.full_name;
      authorTitle = profile.title || undefined;
    }
  }

  try {
    // 1. Fetch pending ideas (filter by profile if set)
    let ideasQuery = supabase
      .from('cp_content_ideas')
      .select('id, user_id, transcript_id, title, core_insight, full_context, why_post_worthy, post_ready, hook, key_points, target_audience, content_type, content_pillar, relevance_score, source_quote, status, composite_score, last_surfaced_at, similarity_hash, team_profile_id, created_at, updated_at')
      .eq('user_id', userId)
      .eq('status', 'extracted')
      .order('created_at', { ascending: false })
      .limit(50);

    if (profileId) {
      ideasQuery = ideasQuery.eq('team_profile_id', profileId);
    }

    const { data: pendingIdeas } = await ideasQuery;

    if (!pendingIdeas?.length) {
      return result;
    }

    // 2. Build scoring context
    const recentPostTitles = await getRecentPostTitles(userId, PILLAR_LOOKBACK_DAYS, profileId);
    const pillarCounts = await getPillarCounts(userId, PILLAR_LOOKBACK_DAYS, profileId);

    const scoringContext: ScoringContext = {
      recentPostTitles,
      pillarCounts,
    };

    // 3. Score and select top ideas
    const topIdeas = getTopIdeas(pendingIdeas as ContentIdea[], postsPerBatch, scoringContext);

    // Pre-fetch scheduled times once for all posts in batch
    const { data: existingScheduled } = await supabase
      .from('cp_pipeline_posts')
      .select('scheduled_time')
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .not('scheduled_time', 'is', null);

    const scheduledTimesCache = new Set(
      existingScheduled?.map((p) => new Date(p.scheduled_time!).getTime()) || []
    );

    // 4. Generate posts for each idea
    for (let i = 0; i < topIdeas.length; i++) {
      const { idea, score } = topIdeas[i];

      try {
        // Build knowledge context via AI Brain (before marking as writing)
        let knowledgeContext: string | undefined;
        if (isEmbeddingsConfigured()) {
          try {
            const brief = await buildContentBriefForIdea(userId, idea, { teamId, profileId });
            if (brief.compiledContext) {
              knowledgeContext = brief.compiledContext;
            }
          } catch {
            // Non-critical, proceed without knowledge context
          }
        }

        // Update idea status (after context build succeeds)
        await supabase
          .from('cp_content_ideas')
          .update({
            status: 'writing',
            composite_score: score.compositeScore,
            similarity_hash: score.similarityHash,
            last_surfaced_at: new Date().toISOString(),
          })
          .eq('id', idea.id);

        // Write post
        const writtenPost = await writePostFreeform({
          idea: {
            id: idea.id,
            title: idea.title,
            core_insight: idea.core_insight,
            full_context: idea.full_context,
            why_post_worthy: idea.why_post_worthy,
            content_type: idea.content_type,
          },
          knowledgeContext,
          voiceProfile,
          authorName,
          authorTitle,
        });

        // Polish post
        const polishResult = await polishPost(writtenPost.content);

        // Determine scheduling (use cached scheduled times)
        const isFirstPost = i === 0;
        const scheduledTime = isFirstPost ? await getNextScheduledTime(userId, scheduledTimesCache) : null;
        const isBuffer = !isFirstPost;

        // Calculate buffer position
        let bufferPosition: number | null = null;
        if (isBuffer) {
          const currentBufferSize = await getBufferSize(userId);
          bufferPosition = currentBufferSize + (i - 1) + 1;
        }

        // Save post
        const { error: postError } = await supabase
          .from('cp_pipeline_posts')
          .insert({
            user_id: userId,
            idea_id: idea.id,
            draft_content: writtenPost.content,
            final_content: polishResult.polished,
            dm_template: writtenPost.dm_template,
            cta_word: writtenPost.cta_word,
            variations: writtenPost.variations,
            status: isFirstPost ? 'reviewing' : 'approved',
            scheduled_time: scheduledTime?.toISOString() || null,
            hook_score: polishResult.hookScore.score,
            polish_status: polishResult.changes.length > 0 ? 'polished' : 'pending',
            polish_notes: polishResult.changes.length > 0 ? polishResult.changes.join('; ') : null,
            is_buffer: isBuffer,
            buffer_position: bufferPosition,
            auto_publish_after: autoPublish && isFirstPost
              ? new Date(Date.now() + autoPublishDelayHours * 60 * 60 * 1000).toISOString()
              : null,
            team_profile_id: profileId || null,
          });

        if (postError) {
          result.errors.push(`Failed to save post for idea ${idea.id}: ${postError.message}`);
          continue;
        }

        // Update idea status
        await supabase
          .from('cp_content_ideas')
          .update({ status: 'written' })
          .eq('id', idea.id);

        result.postsCreated++;
        result.ideasProcessed++;

        if (isFirstPost && scheduledTime) {
          result.postsScheduled++;
        }
      } catch (ideaError) {
        const errorMsg = ideaError instanceof Error ? ideaError.message : String(ideaError);
        result.errors.push(`Failed to process idea ${idea.id}: ${errorMsg}`);

        // Reset idea status on failure
        await supabase
          .from('cp_content_ideas')
          .update({ status: 'extracted' })
          .eq('id', idea.id);
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Batch failed: ${errorMsg}`);
  }

  return result;
}

export async function approvePost(userId: string, postId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const scheduledTime = await getNextScheduledTime(userId);

  await supabase
    .from('cp_pipeline_posts')
    .update({
      status: 'scheduled',
      scheduled_time: scheduledTime.toISOString(),
      is_buffer: false,
      buffer_position: null,
    })
    .eq('id', postId)
    .eq('user_id', userId);
}

export async function rejectPost(userId: string, postId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();

  // Get the rejected post's buffer position
  const { data: post } = await supabase
    .from('cp_pipeline_posts')
    .select('buffer_position, is_buffer')
    .eq('id', postId)
    .eq('user_id', userId)
    .single();

  // Move to draft
  await supabase
    .from('cp_pipeline_posts')
    .update({
      status: 'draft',
      is_buffer: false,
      buffer_position: null,
      scheduled_time: null,
    })
    .eq('id', postId);

  // If it was a buffer post, decrement positions of posts after it
  if (post?.is_buffer && post.buffer_position !== null) {
    await supabase.rpc('cp_decrement_buffer_positions', {
      p_user_id: userId,
      p_min_position: post.buffer_position,
    });
  }
}

export async function getBufferStatus(userId: string) {
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from('cp_pipeline_posts')
    .select('id, user_id, idea_id, draft_content, final_content, dm_template, cta_word, variations, status, scheduled_time, leadshark_post_id, linkedin_post_id, publish_provider, hook_score, polish_status, polish_notes, is_buffer, buffer_position, auto_publish_after, published_at, engagement_stats, created_at, updated_at')
    .eq('user_id', userId)
    .eq('is_buffer', true)
    .eq('status', 'approved')
    .order('buffer_position', { ascending: true });

  return data || [];
}
