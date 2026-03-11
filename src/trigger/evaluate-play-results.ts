/** Evaluate Play Results. Daily cron (3 AM UTC) that computes promotion/decline suggestions for active plays. */

import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import * as playsRepo from '@/server/repositories/cs-plays.repo';

import type { CsPlay, CsPlayResult } from '@/lib/types/creative-strategy';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Minimum test results required before suggesting promotion/decline. */
const MIN_RESULTS_FOR_EVALUATION = 3;

/** Average multiplier above this suggests promotion to 'proven'. */
const PROMOTE_THRESHOLD = 1.5;

/** Average multiplier below this suggests decline to 'declining'. */
const DECLINE_THRESHOLD = 0.8;

const PLAY_COLUMNS =
  'id, title, thesis, exploit_type, format_instructions, status, visibility, niches, last_used_at, created_by, created_at, updated_at';

// ─── Cron task ──────────────────────────────────────────────────────────────

export const evaluatePlayResults = schedules.task({
  id: 'evaluate-play-results',
  cron: '0 3 * * *',
  maxDuration: 120,
  run: async () => {
    const supabase = createSupabaseAdminClient();
    logger.info('Starting play results evaluation');

    // Step 1: Fetch all plays with status 'testing' or 'proven'
    const { data: plays, error: fetchError } = await supabase
      .from('cs_plays')
      .select(PLAY_COLUMNS)
      .in('status', ['testing', 'proven']);

    if (fetchError) {
      logger.error('Failed to fetch plays for evaluation', { error: fetchError.message });
      return { evaluated: 0, suggestions: [] };
    }

    if (!plays || plays.length === 0) {
      logger.info('No plays to evaluate');
      return { evaluated: 0, suggestions: [] };
    }

    logger.info(`Evaluating ${plays.length} plays`);

    // Step 2: Evaluate each play
    const suggestions: PlaySuggestion[] = [];

    for (const play of plays as CsPlay[]) {
      try {
        const results = await playsRepo.findResultsByPlayId(play.id);
        const suggestion = evaluatePlay(play, results);

        if (suggestion) {
          suggestions.push(suggestion);
          logger.info('Play evaluation suggestion', {
            playId: play.id,
            title: play.title,
            status: play.status,
            suggestion: suggestion.action,
            avgMultiplier: suggestion.avg_multiplier,
            resultCount: results.length,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`Failed to evaluate play ${play.id}`, { error: msg });
      }
    }

    logger.info('Play results evaluation complete', {
      evaluated: plays.length,
      suggestionsCount: suggestions.length,
    });

    return { evaluated: plays.length, suggestions };
  },
});

// ─── Evaluation logic ───────────────────────────────────────────────────────

interface PlaySuggestion {
  play_id: string;
  play_title: string;
  current_status: string;
  action: 'promote' | 'decline';
  avg_multiplier: number;
  result_count: number;
}

function evaluatePlay(play: CsPlay, results: CsPlayResult[]): PlaySuggestion | null {
  if (results.length < MIN_RESULTS_FOR_EVALUATION) {
    return null;
  }

  // Compute average multiplier from results that have one
  const validMultipliers = results
    .map((r) => r.multiplier)
    .filter((m): m is number => m !== null && m > 0);

  if (validMultipliers.length === 0) {
    return null;
  }

  const avgMultiplier = validMultipliers.reduce((sum, m) => sum + m, 0) / validMultipliers.length;

  // Determine suggestion based on current status + performance
  if (play.status === 'testing' && avgMultiplier >= PROMOTE_THRESHOLD) {
    return {
      play_id: play.id,
      play_title: play.title,
      current_status: play.status,
      action: 'promote',
      avg_multiplier: Math.round(avgMultiplier * 100) / 100,
      result_count: results.length,
    };
  }

  if (play.status === 'testing' && avgMultiplier < DECLINE_THRESHOLD) {
    return {
      play_id: play.id,
      play_title: play.title,
      current_status: play.status,
      action: 'decline',
      avg_multiplier: Math.round(avgMultiplier * 100) / 100,
      result_count: results.length,
    };
  }

  if (play.status === 'proven' && avgMultiplier < DECLINE_THRESHOLD) {
    return {
      play_id: play.id,
      play_title: play.title,
      current_status: play.status,
      action: 'decline',
      avg_multiplier: Math.round(avgMultiplier * 100) / 100,
      result_count: results.length,
    };
  }

  return null;
}
