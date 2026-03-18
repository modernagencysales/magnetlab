/**
 * Autopilot Service.
 * Generates posts from scored ideas. In team mode, generates for all profiles
 * from a shared idea pool with per-profile voice, template matching, and scheduling.
 * In personal mode, falls back to single-user behavior.
 * Never imports NextRequest, NextResponse, or cookies.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getTopIdeas, type ScoringContext } from '@/lib/ai/content-pipeline/idea-scorer';
import { polishPost } from '@/lib/ai/content-pipeline/post-polish';
import { writePost } from '@/lib/ai/content-pipeline/post-writer';
import { buildContentBriefForIdea } from '@/lib/ai/content-pipeline/briefing-agent';
import { isEmbeddingsConfigured } from '@/lib/ai/embeddings';
import type {
  ContentIdea,
  ContentPillar,
  PillarDistribution,
  AutoPilotConfig,
  BatchResult,
  ProfileBatchResult,
  TeamProfile,
  TeamVoiceProfile,
} from '@/lib/types/content-pipeline';
import { logError } from '@/lib/utils/logger';
import type { DataScope } from '@/lib/utils/team-context';

// ─── Constants ───────────────────────────────────────────────────────────────

const PILLAR_LOOKBACK_DAYS = 14;
const AUTO_PUBLISH_WINDOW_HOURS = 24;

const IDEA_SELECT_COLUMNS =
  'id, user_id, transcript_id, title, core_insight, full_context, why_post_worthy, post_ready, hook, key_points, target_audience, content_type, content_pillar, relevance_score, source_quote, status, composite_score, last_surfaced_at, similarity_hash, team_id, team_profile_id, created_at, updated_at';

const POSTING_SLOT_COLUMNS =
  'id, user_id, slot_number, time_of_day, day_of_week, timezone, is_active, team_profile_id, created_at, updated_at';

// ─── Profile context for post generation ─────────────────────────────────────

interface ProfileContext {
  profileId: string;
  fullName: string;
  title: string | null;
  voiceProfile: TeamVoiceProfile | undefined;
  expertiseAreas: string[];
}

// ─── Pillar & post history helpers ───────────────────────────────────────────

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
    return {
      moments_that_matter: 0,
      teaching_promotion: 0,
      human_personal: 0,
      collaboration_social_proof: 0,
    };
  }

  const { data: ideas } = await supabase
    .from('cp_content_ideas')
    .select('content_pillar')
    .in('id', ideaIds);

  const counts: PillarDistribution = {
    moments_that_matter: 0,
    teaching_promotion: 0,
    human_personal: 0,
    collaboration_social_proof: 0,
  };

  for (const idea of ideas || []) {
    const pillar = idea.content_pillar as ContentPillar | null;
    if (pillar && pillar in counts) {
      counts[pillar]++;
    }
  }

  return counts;
}

async function getRecentPostTitles(
  userId: string,
  days: number = PILLAR_LOOKBACK_DAYS,
  profileId?: string
): Promise<string[]> {
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

  const { data: ideas } = await supabase.from('cp_content_ideas').select('title').in('id', ideaIds);

  return ideas?.map((i) => i.title) || [];
}

// ─── Timezone helpers ────────────────────────────────────────────────────────

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
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
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

// ─── Scheduling ──────────────────────────────────────────────────────────────

/**
 * Find the next available posting slot for a user (optionally filtered by profile).
 * Skips times already occupied by scheduled posts.
 */
export async function getNextScheduledTime(
  userId: string,
  cachedScheduledTimes?: Set<number>,
  profileId?: string
): Promise<Date> {
  const supabase = createSupabaseAdminClient();

  let slotsQuery = supabase
    .from('cp_posting_slots')
    .select(POSTING_SLOT_COLUMNS)
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('slot_number', { ascending: true });

  if (profileId) {
    slotsQuery = slotsQuery.eq('team_profile_id', profileId);
  }

  const { data: slots } = await slotsQuery;

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
        const dayName = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(
          candidate
        );
        const dayMap: Record<string, number> = {
          Sunday: 0,
          Monday: 1,
          Tuesday: 2,
          Wednesday: 3,
          Thursday: 4,
          Friday: 5,
          Saturday: 6,
        };
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
      let scheduledQuery = supabase
        .from('cp_pipeline_posts')
        .select('scheduled_time')
        .eq('user_id', userId)
        .eq('status', 'scheduled')
        .not('scheduled_time', 'is', null);

      if (profileId) {
        scheduledQuery = scheduledQuery.eq('team_profile_id', profileId);
      }

      const { data: scheduledPosts } = await scheduledQuery;

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

export async function getBufferSize(userId: string, profileId?: string): Promise<number> {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from('cp_pipeline_posts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_buffer', true)
    .eq('status', 'approved');

  if (profileId) {
    query = query.eq('team_profile_id', profileId);
  }

  const { count } = await query;

  return count || 0;
}

// ─── Idea assignment helpers ─────────────────────────────────────────────────

/**
 * Pick the best idea for a profile from the scored pool.
 * If the profile has expertise_areas, prefer ideas whose topic/content matches.
 * Falls back to round-robin (next idea in ranked order).
 */
export function pickIdeaForProfile(
  rankedIdeas: Array<{ idea: ContentIdea; score: { compositeScore: number } }>,
  profile: ProfileContext,
  usedIdeasByProfile: Map<string, Set<string>>
): { idea: ContentIdea; score: { compositeScore: number } } | null {
  const profileUsed = usedIdeasByProfile.get(profile.profileId) ?? new Set();

  // If profile has expertise areas, try to match
  if (profile.expertiseAreas.length > 0) {
    const expertiseSet = new Set(profile.expertiseAreas.map((e) => e.toLowerCase()));

    for (const ranked of rankedIdeas) {
      if (profileUsed.has(ranked.idea.id)) continue;

      const ideaText = [
        ranked.idea.title,
        ranked.idea.core_insight,
        ranked.idea.content_type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matches = [...expertiseSet].some((area) => ideaText.includes(area));
      if (matches) return ranked;
    }
  }

  // Fallback: first unused idea in ranked order
  for (const ranked of rankedIdeas) {
    if (!profileUsed.has(ranked.idea.id)) return ranked;
  }

  // All ideas used by this profile — allow reuse (different voice/template)
  return rankedIdeas[0] ?? null;
}

// ─── Team mode batch ─────────────────────────────────────────────────────────

/**
 * Generate posts for all team profiles from a shared idea pool.
 * Each profile gets posts matched to their voice, templates matched per-profile
 * freshness, and posted in their own slots.
 */
async function runTeamBatch(config: AutoPilotConfig): Promise<BatchResult> {
  const {
    userId,
    postsPerBatch = 3,
    autoPublish = false,
    autoPublishDelayHours = AUTO_PUBLISH_WINDOW_HOURS,
    teamId,
  } = config;

  if (!teamId) throw new Error('runTeamBatch requires teamId');

  const supabase = createSupabaseAdminClient();
  const result: BatchResult = {
    postsCreated: 0,
    postsScheduled: 0,
    ideasProcessed: 0,
    errors: [],
    profileResults: [],
  };

  try {
    // 1. Fetch shared idea pool by team_id
    const { data: pendingIdeas } = await supabase
      .from('cp_content_ideas')
      .select(IDEA_SELECT_COLUMNS)
      .eq('team_id', teamId)
      .eq('status', 'extracted')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!pendingIdeas?.length) {
      return result;
    }

    // 2. Score ideas using team-wide context (not per-profile — ideas are shared)
    const recentPostTitles = await getRecentPostTitles(userId, PILLAR_LOOKBACK_DAYS);
    const pillarCounts = await getPillarCounts(userId, PILLAR_LOOKBACK_DAYS);
    const scoringContext: ScoringContext = { recentPostTitles, pillarCounts };

    const totalNeeded = postsPerBatch * 3; // overshoot so each profile has enough to pick from
    const topIdeas = getTopIdeas(pendingIdeas as ContentIdea[], totalNeeded, scoringContext);

    if (topIdeas.length === 0) {
      return result;
    }

    // 3. Fetch active profiles with posting slots
    const { data: profiles } = await supabase
      .from('team_profiles')
      .select('id, full_name, title, voice_profile, expertise_areas, status')
      .eq('team_id', teamId)
      .eq('status', 'active');

    if (!profiles?.length) {
      result.errors.push('No active profiles in team');
      return result;
    }

    // 4. For each profile, check which have active posting slots
    const profileContexts: ProfileContext[] = [];

    for (const profile of profiles) {
      const { count: slotCount } = await supabase
        .from('cp_posting_slots')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('team_profile_id', profile.id)
        .eq('is_active', true);

      if (!slotCount || slotCount === 0) continue;

      profileContexts.push({
        profileId: profile.id,
        fullName: profile.full_name,
        title: profile.title || null,
        voiceProfile: profile.voice_profile as TeamVoiceProfile | undefined,
        expertiseAreas: (profile.expertise_areas as string[]) || [],
      });
    }

    if (profileContexts.length === 0) {
      return result;
    }

    // 5. Generate posts for each profile
    const usedIdeasByProfile = new Map<string, Set<string>>();
    const processedIdeaIds = new Set<string>();

    for (const profileCtx of profileContexts) {
      const profileResult: ProfileBatchResult = {
        profileId: profileCtx.profileId,
        profileName: profileCtx.fullName,
        postsCreated: 0,
        postsScheduled: 0,
        ideasUsed: [],
        errors: [],
      };

      // Pre-fetch scheduled times for this profile
      const { data: existingScheduled } = await supabase
        .from('cp_pipeline_posts')
        .select('scheduled_time')
        .eq('user_id', userId)
        .eq('team_profile_id', profileCtx.profileId)
        .eq('status', 'scheduled')
        .not('scheduled_time', 'is', null);

      const scheduledTimesCache = new Set(
        existingScheduled?.map((p) => new Date(p.scheduled_time!).getTime()) || []
      );

      for (let i = 0; i < postsPerBatch; i++) {
        const picked = pickIdeaForProfile(topIdeas, profileCtx, usedIdeasByProfile);
        if (!picked) {
          profileResult.errors.push('No more ideas available');
          break;
        }

        const { idea, score } = picked;

        // Track usage
        if (!usedIdeasByProfile.has(profileCtx.profileId)) {
          usedIdeasByProfile.set(profileCtx.profileId, new Set());
        }
        usedIdeasByProfile.get(profileCtx.profileId)!.add(idea.id);

        try {
          // Build knowledge context
          let knowledgeContext: string | undefined;
          if (isEmbeddingsConfigured()) {
            try {
              const brief = await buildContentBriefForIdea(userId, idea, {
                teamId,
                profileId: profileCtx.profileId,
                voiceProfile: profileCtx.voiceProfile,
              });
              if (brief.compiledContext) {
                knowledgeContext = brief.compiledContext;
              }
            } catch (err) {
              logError('autopilot/team-batch', err, { step: 'knowledge_context', profileId: profileCtx.profileId });
            }
          }

          // Mark idea as writing (only first time this idea is used)
          if (!processedIdeaIds.has(idea.id)) {
            await supabase
              .from('cp_content_ideas')
              .update({
                status: 'writing',
                composite_score: score.compositeScore,
                similarity_hash: (score as { similarityHash?: string }).similarityHash ?? null,
                last_surfaced_at: new Date().toISOString(),
              })
              .eq('id', idea.id);
            processedIdeaIds.add(idea.id);
          }

          // Write post with this profile's voice and per-profile template matching
          const writtenPost = await writePost(
            {
              idea: {
                id: idea.id,
                title: idea.title,
                core_insight: idea.core_insight,
                full_context: idea.full_context,
                why_post_worthy: idea.why_post_worthy,
                content_type: idea.content_type,
              },
              knowledgeContext,
              voiceProfile: profileCtx.voiceProfile,
              authorName: profileCtx.fullName,
              authorTitle: profileCtx.title || undefined,
            },
            teamId,
            profileCtx.profileId
          );

          // Polish post
          const polishResult = await polishPost(writtenPost.content, {
            voiceProfile: profileCtx.voiceProfile,
          });

          // Scheduling: first post for this profile gets scheduled, rest are buffer
          const isFirstPost = i === 0;
          const scheduledTime = isFirstPost
            ? await getNextScheduledTime(userId, scheduledTimesCache, profileCtx.profileId)
            : null;
          const isBuffer = !isFirstPost;

          let bufferPosition: number | null = null;
          if (isBuffer) {
            const currentBufferSize = await getBufferSize(userId, profileCtx.profileId);
            bufferPosition = currentBufferSize + (i - 1) + 1;
          }

          // Save post with profile assignment and template_id
          const { error: postError } = await supabase.from('cp_pipeline_posts').insert({
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
            auto_publish_after:
              autoPublish && isFirstPost
                ? new Date(Date.now() + autoPublishDelayHours * 60 * 60 * 1000).toISOString()
                : null,
            team_profile_id: profileCtx.profileId,
            template_id: writtenPost.matchedTemplateId || null,
          });

          if (postError) {
            profileResult.errors.push(`Failed to save post for idea ${idea.id}: ${postError.message}`);
            continue;
          }

          profileResult.postsCreated++;
          profileResult.ideasUsed.push(idea.id);

          if (isFirstPost && scheduledTime) {
            scheduledTimesCache.add(scheduledTime.getTime());
            profileResult.postsScheduled++;
          }
        } catch (ideaError) {
          const errorMsg = ideaError instanceof Error ? ideaError.message : String(ideaError);
          profileResult.errors.push(`Failed to process idea ${idea.id} for profile ${profileCtx.fullName}: ${errorMsg}`);
        }
      }

      result.profileResults!.push(profileResult);
      result.postsCreated += profileResult.postsCreated;
      result.postsScheduled += profileResult.postsScheduled;
      result.errors.push(...profileResult.errors);
    }

    // Mark all processed ideas as written
    for (const ideaId of processedIdeaIds) {
      await supabase.from('cp_content_ideas').update({ status: 'written' }).eq('id', ideaId);
    }

    result.ideasProcessed = processedIdeaIds.size;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Team batch failed: ${errorMsg}`);
  }

  return result;
}

// ─── Personal mode batch (original single-user flow) ─────────────────────────

async function runPersonalBatch(config: AutoPilotConfig): Promise<BatchResult> {
  const {
    userId,
    postsPerBatch = 3,
    autoPublish = false,
    autoPublishDelayHours = AUTO_PUBLISH_WINDOW_HOURS,
    teamId,
    profileId,
  } = config;
  const supabase = createSupabaseAdminClient();
  const result: BatchResult = { postsCreated: 0, postsScheduled: 0, ideasProcessed: 0, errors: [] };

  // Fetch voice profile if running for a specific team member
  let voiceProfile: TeamVoiceProfile | undefined;
  let authorName: string | undefined;
  let authorTitle: string | undefined;
  if (profileId) {
    const { data: profile } = await supabase
      .from('team_profiles')
      .select('full_name, title, voice_profile')
      .eq('id', profileId)
      .single();
    if (profile) {
      voiceProfile = profile.voice_profile as TeamVoiceProfile;
      authorName = profile.full_name;
      authorTitle = profile.title || undefined;
    }
  }

  try {
    // 1. Fetch pending ideas
    const { data: pendingIdeas } = await supabase
      .from('cp_content_ideas')
      .select(IDEA_SELECT_COLUMNS)
      .eq('user_id', userId)
      .eq('status', 'extracted')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!pendingIdeas?.length) {
      return result;
    }

    // 2. Build scoring context
    const recentPostTitles = await getRecentPostTitles(userId, PILLAR_LOOKBACK_DAYS, profileId);
    const pillarCounts = await getPillarCounts(userId, PILLAR_LOOKBACK_DAYS, profileId);
    const scoringContext: ScoringContext = { recentPostTitles, pillarCounts };

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
        // Build knowledge context via AI Brain
        let knowledgeContext: string | undefined;
        if (isEmbeddingsConfigured()) {
          try {
            const brief = await buildContentBriefForIdea(userId, idea, {
              teamId,
              profileId,
              voiceProfile,
            });
            if (brief.compiledContext) {
              knowledgeContext = brief.compiledContext;
            }
          } catch (err) {
            logError('autopilot/personal-batch', err, { step: 'knowledge_context' });
          }
        }

        // Update idea status
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
        const resolvedTeamId = teamId ?? userId;
        const resolvedProfileId = profileId ?? userId;
        const writtenPost = await writePost(
          {
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
          },
          resolvedTeamId,
          resolvedProfileId
        );

        // Polish post
        const polishResult = await polishPost(writtenPost.content, { voiceProfile });

        // Determine scheduling
        const isFirstPost = i === 0;
        const scheduledTime = isFirstPost
          ? await getNextScheduledTime(userId, scheduledTimesCache, profileId)
          : null;
        const isBuffer = !isFirstPost;

        let bufferPosition: number | null = null;
        if (isBuffer) {
          const currentBufferSize = await getBufferSize(userId, profileId);
          bufferPosition = currentBufferSize + (i - 1) + 1;
        }

        // Save post
        const { error: postError } = await supabase.from('cp_pipeline_posts').insert({
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
          auto_publish_after:
            autoPublish && isFirstPost
              ? new Date(Date.now() + autoPublishDelayHours * 60 * 60 * 1000).toISOString()
              : null,
          team_profile_id: profileId || null,
          template_id: writtenPost.matchedTemplateId || null,
        });

        if (postError) {
          result.errors.push(`Failed to save post for idea ${idea.id}: ${postError.message}`);
          continue;
        }

        // Update idea status
        await supabase.from('cp_content_ideas').update({ status: 'written' }).eq('id', idea.id);

        result.postsCreated++;
        result.ideasProcessed++;

        if (isFirstPost && scheduledTime) {
          result.postsScheduled++;
        }
      } catch (ideaError) {
        const errorMsg = ideaError instanceof Error ? ideaError.message : String(ideaError);
        result.errors.push(`Failed to process idea ${idea.id}: ${errorMsg}`);

        // Reset idea status on failure
        await supabase.from('cp_content_ideas').update({ status: 'extracted' }).eq('id', idea.id);
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Batch failed: ${errorMsg}`);
  }

  return result;
}

// ─── Public entry point ──────────────────────────────────────────────────────

/**
 * Run the nightly autopilot batch.
 * - Team mode (teamId set, no profileId): generates for ALL profiles from shared idea pool
 * - Personal/single-profile mode: generates for one user/profile (original behavior)
 */
export async function runNightlyBatch(config: AutoPilotConfig): Promise<BatchResult> {
  const { teamId, profileId } = config;

  // Team mode: teamId set AND no specific profileId → generate for all profiles
  if (teamId && !profileId) {
    return runTeamBatch(config);
  }

  // Personal mode or single-profile mode
  return runPersonalBatch(config);
}

// ─── Post management ─────────────────────────────────────────────────────────

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

export async function getBufferStatus(userId: string, scope?: DataScope) {
  const supabase = createSupabaseAdminClient();

  // cp_pipeline_posts uses team_profile_id, not team_id — can't use applyScope
  let query = supabase
    .from('cp_pipeline_posts')
    .select(
      'id, user_id, idea_id, draft_content, final_content, dm_template, cta_word, variations, status, scheduled_time, linkedin_post_id, publish_provider, hook_score, polish_status, polish_notes, is_buffer, buffer_position, auto_publish_after, published_at, engagement_stats, created_at, updated_at'
    )
    .eq('is_buffer', true)
    .eq('status', 'approved')
    .order('buffer_position', { ascending: true });

  if (scope?.type === 'team' && scope.teamId) {
    const { data: profiles } = await supabase
      .from('team_profiles')
      .select('id')
      .eq('team_id', scope.teamId)
      .eq('status', 'active');
    const profileIds = profiles?.map((p) => p.id) ?? [];
    if (profileIds.length > 0) {
      query = query.in('team_profile_id', profileIds);
    } else {
      query = query.eq('user_id', userId);
    }
  } else {
    query = query.eq('user_id', userId);
  }

  const { data } = await query;

  return data || [];
}
