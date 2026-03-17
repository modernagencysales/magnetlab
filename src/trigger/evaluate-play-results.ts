/** Evaluate Play Results. Daily cron (3 AM UTC) that computes promotion/decline suggestions for active plays. */

import { schedules, logger } from '@trigger.dev/sdk/v3';
import * as playsRepo from '@/server/repositories/cs-plays.repo';

import {
  PLAY_PROMOTION_THRESHOLDS,
  type CsPlay,
  type CsPlayResult,
} from '@/lib/types/creative-strategy';

// ─── Cron task ──────────────────────────────────────────────────────────────

export const evaluatePlayResults = schedules.task({
  id: 'evaluate-play-results',
  cron: '0 3 * * *',
  maxDuration: 120,
  run: async () => {
    logger.info('Starting play results evaluation');

    // Step 1: Fetch all plays with status 'testing' or 'proven' via repo
    const [{ data: testingPlays }, { data: provenPlays }] = await Promise.all([
      playsRepo.findPlays({ status: 'testing', limit: 200 }),
      playsRepo.findPlays({ status: 'proven', limit: 200 }),
    ]);

    const plays = [...testingPlays, ...provenPlays];

    if (plays.length === 0) {
      logger.info('No plays to evaluate');
      return { evaluated: 0, suggestions: [] };
    }

    logger.info(`Evaluating ${plays.length} plays`);

    // Step 2: Evaluate each play
    const suggestions: PlaySuggestion[] = [];

    for (const play of plays) {
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
  const { promoteMinMultiplier, declineMaxMultiplier, minResultsForPromotion } =
    PLAY_PROMOTION_THRESHOLDS;

  if (results.length < minResultsForPromotion) {
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
  if (play.status === 'testing' && avgMultiplier >= promoteMinMultiplier) {
    return {
      play_id: play.id,
      play_title: play.title,
      current_status: play.status,
      action: 'promote',
      avg_multiplier: Math.round(avgMultiplier * 100) / 100,
      result_count: results.length,
    };
  }

  if (play.status === 'testing' && avgMultiplier < declineMaxMultiplier) {
    return {
      play_id: play.id,
      play_title: play.title,
      current_status: play.status,
      action: 'decline',
      avg_multiplier: Math.round(avgMultiplier * 100) / 100,
      result_count: results.length,
    };
  }

  if (play.status === 'proven' && avgMultiplier < declineMaxMultiplier) {
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
