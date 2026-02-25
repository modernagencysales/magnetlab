import { task, logger } from '@trigger.dev/sdk/v3';
import Anthropic from '@anthropic-ai/sdk';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { polishLeadMagnetContent } from '@/lib/ai/lead-magnet-generator';
import { getRelevantContext } from '@/lib/services/knowledge-brain';
import type { ExtractedContent, LeadMagnetConcept } from '@/lib/types/lead-magnet';

interface RebuildPayload {
  leadMagnetId: string;
  userId: string;
}

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  return new Anthropic({ apiKey, timeout: 480_000 });
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

async function generateFullContent(
  title: string,
  concept: LeadMagnetConcept,
  knowledgeContext: string
): Promise<ExtractedContent> {
  const prompt = `You are writing the full content for a lead magnet (free resource) that will be delivered as a web page. This needs to be a COMPLETE, substantive asset — not a summary or overview. Target: 2000-3000 words of actionable, detailed content.

## LEAD MAGNET DETAILS
- Title: ${title}
- Pain Solved: ${concept.painSolved || 'N/A'}
- Why Now Hook: ${concept.whyNowHook || 'N/A'}
- Delivery Format: ${concept.deliveryFormat || 'Digital guide'}
- Contents Description: ${concept.contents || 'N/A'}
- Target Audience: Agency owners and B2B service providers
- Author: Tim Keen (agency owner who built a $4.7M agency using LinkedIn)

${knowledgeContext ? `## KNOWLEDGE BASE (Real insights from Tim's coaching calls and sales conversations)
Use these to ground the content in real examples, specific numbers, and authentic experiences:

${knowledgeContext}

CRITICAL: Reference specific insights, numbers, and examples from the knowledge base above. Do NOT write generic content — make it feel like Tim personally wrote this based on his real experience.` : ''}

## REQUIREMENTS
1. Write 6-8 sections, each with 2-4 detailed content items
2. Each content item should be 150-300 words — detailed, actionable, with specific examples
3. Include specific numbers, frameworks, and step-by-step processes
4. Write in Tim's voice: direct, confident, no fluff, results-focused
5. Include a non-obvious insight that most people get wrong
6. Include personal experience/story that adds credibility
7. Include proof points (specific metrics, client results, case studies)
8. Include 3-5 common mistakes people make

## OUTPUT FORMAT (strict JSON)
{
  "title": "${title}",
  "format": "${concept.deliveryFormat || 'Digital Guide'}",
  "structure": [
    {
      "sectionName": "Section Name Here",
      "contents": [
        "First detailed content item (150-300 words). Include specific examples, numbers, and actionable steps...",
        "Second detailed content item..."
      ]
    }
  ],
  "nonObviousInsight": "A counterintuitive insight that challenges conventional wisdom (2-3 sentences)",
  "personalExperience": "Tim's personal story or experience relevant to this topic (2-3 sentences)",
  "proof": "Specific metrics and results that prove this works (e.g. revenue numbers, conversion rates)",
  "commonMistakes": ["Mistake 1 with explanation", "Mistake 2 with explanation", "Mistake 3 with explanation"],
  "differentiation": "What makes this approach different from what everyone else teaches (2-3 sentences)"
}

Return ONLY the JSON object, no markdown fences or extra text.`;

  const response = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((block) => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  try {
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as ExtractedContent;
    }
    return JSON.parse(textBlock.text) as ExtractedContent;
  } catch {
    throw new Error('Failed to parse generated content as JSON');
  }
}
