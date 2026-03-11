/** Analyze Signal Task. Classifies media + extracts signal patterns via AI. */

import { task, logger } from '@trigger.dev/sdk/v3';
import * as signalsRepo from '@/server/repositories/cs-signals.repo';
import { classifyMedia } from '@/lib/ai/creative-strategy/media-classifier';
import { analyzeSignal as runAnalysis } from '@/lib/ai/creative-strategy/signal-analyzer';

// ─── Task definition ────────────────────────────────────────────────────────

export const analyzeSignal = task({
  id: 'analyze-signal',
  maxDuration: 120,
  retry: { maxAttempts: 2 },
  run: async ({ signalId }: { signalId: string }) => {
    const signal = await signalsRepo.findSignalById(signalId);
    if (!signal) {
      logger.warn('Signal not found', { signalId });
      return { status: 'skipped', reason: 'not_found' };
    }

    logger.info('Analyzing signal', { signalId, source: signal.source });

    // Step 1: Classify media (if present)
    let mediaClassification: string | null = null;
    if (signal.media_type !== 'none' && signal.media_urls.length > 0) {
      mediaClassification = await classifyMedia(signal.media_urls[0]);
      logger.info('Media classified', { signalId, classification: mediaClassification });
    }

    // Step 2: Analyze content + media context
    const analysis = await runAnalysis(signal.content, mediaClassification);

    // Step 3: Store results (media_classification + analysis fields)
    await signalsRepo.updateSignalAnalysis(signalId, {
      media_classification: mediaClassification,
      hook_pattern: analysis.hook_pattern,
      format_fingerprint: analysis.format_fingerprint,
      trending_topic: analysis.trending_topic,
      exploit_hypothesis: analysis.exploit_hypothesis,
      similar_play_ids: [],
    });

    logger.info('Signal analysis complete', { signalId, hookPattern: analysis.hook_pattern });
    return { status: 'complete', signalId };
  },
});
