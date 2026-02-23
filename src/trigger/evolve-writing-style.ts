import { task, schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getAnthropicClient, parseJsonResponse } from '@/lib/ai/content-pipeline/anthropic-client';
import { aggregateEditPatterns } from '@/lib/services/style-evolution';

export const evolveWritingStyle = task({
  id: 'evolve-writing-style',
  maxDuration: 300,
  retry: { maxAttempts: 2 },
  run: async (payload: { profileId: string }) => {
    const supabase = createSupabaseAdminClient();

    // 1. Get current profile
    const { data: profile, error: profileError } = await supabase
      .from('team_profiles')
      .select('id, full_name, voice_profile')
      .eq('id', payload.profileId)
      .single();

    if (profileError || !profile) {
      throw new Error(`Profile not found: ${profileError?.message || 'no data'}`);
    }

    // 2. Get unprocessed edits for this profile
    const { data: edits, error: editsError } = await supabase
      .from('cp_edit_history')
      .select('id, original_text, edited_text, ceo_note, edit_tags, auto_classified_changes, created_at')
      .eq('profile_id', payload.profileId)
      .eq('processed', false)
      .order('created_at', { ascending: true });

    if (editsError) {
      throw new Error(`Failed to fetch edits: ${editsError.message}`);
    }

    if (!edits || edits.length === 0) {
      logger.info('No unprocessed edits found', { profileId: payload.profileId });
      return { status: 'no_edits' as const };
    }

    logger.info('Processing edits for style evolution', {
      profileId: payload.profileId,
      profileName: profile.full_name,
      editCount: edits.length,
    });

    // 3. Aggregate patterns from classified edits
    const aggregatedPatterns = aggregateEditPatterns(edits);

    // 4. Ask Claude to evolve the voice profile
    const anthropic = getAnthropicClient();
    const currentProfile = (profile.voice_profile as Record<string, unknown>) || {};

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `You are a writing style analyst. Given a current voice profile and recent edit patterns, produce an updated voice profile.

CURRENT VOICE PROFILE:
${JSON.stringify(currentProfile, null, 2)}

RECENT EDIT PATTERNS (${edits.length} edits analyzed):
${aggregatedPatterns.map((p) => `- ${p.pattern} (${p.count}x): ${p.description}`).join('\n')}

SAMPLE EDITS (most recent 5):
${edits
  .slice(-5)
  .map(
    (e) =>
      `Original: "${(e.original_text || '').slice(0, 200)}"\nEdited: "${(e.edited_text || '').slice(0, 200)}"\nCEO note: ${e.ceo_note || 'none'}\nTags: ${(e.edit_tags || []).join(', ') || 'none'}`
  )
  .join('\n---\n')}

Return a JSON voice profile that:
1. Preserves existing preferences that weren't contradicted
2. Updates preferences based on consistent patterns (3+ occurrences)
3. Adds new patterns with confidence scores
4. Separates linkedin vs email structure patterns
5. Includes vocabulary_preferences (avoid/prefer lists) based on actual word replacements

Return ONLY the JSON object, no explanation.`,
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const evolvedProfile = parseJsonResponse<Record<string, unknown>>(text);

    // Merge evolution metadata
    evolvedProfile.edit_patterns = aggregatedPatterns;
    evolvedProfile.last_evolved = new Date().toISOString();
    evolvedProfile.evolution_version =
      ((currentProfile.evolution_version as number) || 0) + 1;

    // 5. Save evolved profile
    const { error: updateError } = await supabase
      .from('team_profiles')
      .update({ voice_profile: evolvedProfile })
      .eq('id', payload.profileId);

    if (updateError) {
      throw new Error(`Failed to save evolved profile: ${updateError.message}`);
    }

    // 6. Mark edits as processed (use specific IDs to avoid race condition
    // where new edits inserted between fetch and update would be marked processed
    // without being analyzed)
    const editIds = edits.map((e: { id: string }) => e.id);
    const { error: markError } = await supabase
      .from('cp_edit_history')
      .update({ processed: true })
      .in('id', editIds);

    if (markError) {
      logger.warn('Failed to mark edits as processed', { error: markError.message });
    }

    logger.info('Style evolution complete', {
      profileId: payload.profileId,
      version: evolvedProfile.evolution_version,
      patternsProcessed: edits.length,
      topPatterns: aggregatedPatterns.slice(0, 5).map((p) => p.pattern),
    });

    return {
      status: 'evolved' as const,
      version: evolvedProfile.evolution_version as number,
      patternsProcessed: edits.length,
      topPatterns: aggregatedPatterns.slice(0, 5),
    };
  },
});

// Weekly schedule: Sunday 3:30 AM UTC
export const weeklyStyleEvolution = schedules.task({
  id: 'weekly-style-evolution',
  cron: '30 3 * * 0',
  maxDuration: 600,
  run: async () => {
    const supabase = createSupabaseAdminClient();

    // Find all profiles with unprocessed edits
    const { data: profiles, error } = await supabase
      .from('cp_edit_history')
      .select('profile_id')
      .eq('processed', false)
      .not('profile_id', 'is', null);

    if (error) {
      throw new Error(`Failed to query edit history: ${error.message}`);
    }

    if (!profiles || profiles.length === 0) {
      logger.info('No profiles with unprocessed edits');
      return { status: 'no_profiles' as const, profileCount: 0 };
    }

    const uniqueProfiles = [...new Set(profiles.map((p) => p.profile_id))];
    logger.info('Triggering style evolution', { profileCount: uniqueProfiles.length });

    for (const profileId of uniqueProfiles) {
      await evolveWritingStyle.trigger({ profileId });
    }

    return { status: 'triggered' as const, profileCount: uniqueProfiles.length };
  },
});
