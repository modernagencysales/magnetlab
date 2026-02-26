import { task, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { polishLeadMagnetContent } from '@/lib/ai/lead-magnet-generator';
import { generateFullContent } from '@/lib/ai/generate-lead-magnet-content';
import { getRelevantContext } from '@/lib/services/knowledge-brain';
import type { LeadMagnetConcept } from '@/lib/types/lead-magnet';

interface RebuildPayload {
  leadMagnetId: string;
  userId: string;
}

/**
 * Rebuild a stub lead magnet with full AI-generated content.
 * Takes the existing title + concept + knowledge base context
 * and generates a complete 2000+ word ExtractedContent,
 * then polishes it into rich block format.
 */
export const rebuildLeadMagnetContent = task({
  id: 'rebuild-lead-magnet-content',
  maxDuration: 600,
  retry: { maxAttempts: 2 },
  run: async (payload: RebuildPayload) => {
    const { leadMagnetId, userId } = payload;
    const supabase = createSupabaseAdminClient();

    // Step 1: Read existing lead magnet
    const { data: lm, error: fetchError } = await supabase
      .from('lead_magnets')
      .select('id, title, concept, extracted_content, archetype')
      .eq('id', leadMagnetId)
      .single();

    if (fetchError || !lm) {
      throw new Error(`Lead magnet not found: ${leadMagnetId}`);
    }

    const concept = lm.concept as LeadMagnetConcept | null;
    if (!concept) {
      throw new Error(`Lead magnet ${leadMagnetId} has no concept`);
    }

    logger.info('Rebuilding content', {
      leadMagnetId,
      title: lm.title,
      hasExistingExtracted: !!lm.extracted_content,
    });

    // Step 2: Fetch relevant knowledge context
    let knowledgeContext = '';
    try {
      const searchQuery = `${lm.title} ${concept.painSolved || ''} ${concept.contents || ''}`;
      const knowledge = await getRelevantContext(userId, searchQuery, 15);
      if (knowledge.entries.length > 0) {
        knowledgeContext = knowledge.entries
          .map((e) => `[${e.category}] ${e.content}`)
          .join('\n\n');
        logger.info('Knowledge context loaded', { entries: knowledge.entries.length });
      }
    } catch (err) {
      logger.warn('Failed to fetch knowledge context, continuing without it', {
        error: err instanceof Error ? err.message : 'unknown',
      });
    }

    // Step 3: Generate full ExtractedContent via AI
    const extractedContent = await generateFullContent(lm.title, concept, knowledgeContext);

    logger.info('Content generated', {
      sections: extractedContent.structure.length,
      totalItems: extractedContent.structure.reduce((sum, s) => sum + s.contents.length, 0),
    });

    // Step 4: Save extracted_content immediately (don't lose it if polish fails)
    const { error: saveError } = await supabase
      .from('lead_magnets')
      .update({ extracted_content: extractedContent })
      .eq('id', leadMagnetId);

    if (saveError) {
      throw new Error(`Failed to save extracted content: ${saveError.message}`);
    }

    // Step 5: Polish into rich block format (best-effort — retry once on failure)
    let polished;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        polished = await polishLeadMagnetContent(extractedContent, concept);
        break;
      } catch (err) {
        logger.warn(`Polish attempt ${attempt} failed`, {
          error: err instanceof Error ? err.message : 'unknown',
        });
        if (attempt === 2) {
          logger.error('Polish failed after 2 attempts — extracted_content saved, polish skipped');
        }
      }
    }

    if (polished) {
      logger.info('Content polished', {
        wordCount: polished.metadata?.wordCount,
        readingTime: polished.metadata?.readingTimeMinutes,
      });

      await supabase
        .from('lead_magnets')
        .update({
          polished_content: polished,
          polished_at: new Date().toISOString(),
        })
        .eq('id', leadMagnetId);
    }

    return {
      leadMagnetId,
      title: lm.title,
      sections: extractedContent.structure.length,
      wordCount: polished?.metadata?.wordCount ?? null,
      polishSucceeded: !!polished,
    };
  },
});

