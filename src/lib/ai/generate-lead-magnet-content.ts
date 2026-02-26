import { createAnthropicClient } from '@/lib/ai/anthropic-client';
import type { ExtractedContent, LeadMagnetConcept } from '@/lib/types/lead-magnet';

/**
 * Generate full ExtractedContent for a lead magnet from its title, concept, and optional knowledge context.
 * Reused by the rebuild-lead-magnet-content Trigger task and the generate-content API route.
 */
export async function generateFullContent(
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

  const client = createAnthropicClient('generate-lead-magnet-content', { timeout: 480_000 });
  const response = await client.messages.create({
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
