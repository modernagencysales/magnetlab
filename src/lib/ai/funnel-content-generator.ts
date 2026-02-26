// AI Content Generator for Funnel Pages
// Generates opt-in page copy from lead magnet data

import { createAnthropicClient } from '@/lib/ai/anthropic-client';
import type { LeadMagnetConcept, ExtractedContent } from '@/lib/types/lead-magnet';
import type { GeneratedOptinContent } from '@/lib/types/funnel';

// Lazy initialization to ensure env vars are loaded
function getAnthropicClient() {
  return createAnthropicClient('funnel-content-generator', { timeout: 30_000 });
}

const OPTIN_CONTENT_SYSTEM_PROMPT = `You are an expert copywriter specializing in high-converting opt-in pages for digital lead magnets. Your copy is:

- CONCISE: Headlines under 10 words, sublines 15-25 words max
- BENEFIT-FOCUSED: Lead with outcomes, not features
- URGENT: Creates a sense of "I need this now"
- SPECIFIC: Uses concrete numbers and results where possible
- CREDIBLE: Incorporates social proof naturally

AVOID:
- Generic phrases like "unlock your potential" or "transform your life"
- AI-sounding clichés like "unleash", "supercharge", "game-changer"
- Vague promises without specific outcomes
- Overly long or complex sentences

The opt-in page has 4 elements:
1. Headline (8-10 words): The main promise/hook that makes them stop scrolling
2. Subline (15-25 words): Expands on headline, addresses the pain or adds specificity
3. Social proof (1 line): A credibility statement (numbers work best)
4. Button text (2-4 words): Action-oriented CTA`;

export interface GenerateOptinContentInput {
  leadMagnetTitle: string;
  concept: LeadMagnetConcept | null;
  extractedContent: ExtractedContent | null;
  credibility?: string;
}

export async function generateOptinContent(
  input: GenerateOptinContentInput
): Promise<GeneratedOptinContent> {
  const { leadMagnetTitle, concept, extractedContent, credibility } = input;

  // Build context from available data
  const contextParts: string[] = [];

  contextParts.push(`Lead Magnet Title: ${leadMagnetTitle}`);

  if (concept) {
    contextParts.push(`Pain Solved: ${concept.painSolved}`);
    contextParts.push(`Format: ${concept.deliveryFormat}`);
    contextParts.push(`Contents: ${concept.contents}`);
    if (concept.whyNowHook) {
      contextParts.push(`Urgency Angle: ${concept.whyNowHook}`);
    }
  }

  if (extractedContent) {
    contextParts.push(`Non-Obvious Insight: ${extractedContent.nonObviousInsight}`);
    contextParts.push(`Differentiation: ${extractedContent.differentiation}`);
    if (extractedContent.proof) {
      contextParts.push(`Proof/Results: ${extractedContent.proof}`);
    }
  }

  if (credibility) {
    contextParts.push(`Creator Credibility: ${credibility}`);
  }

  const prompt = `${OPTIN_CONTENT_SYSTEM_PROMPT}

LEAD MAGNET CONTEXT:
${contextParts.join('\n')}

Generate opt-in page content for this lead magnet. Return ONLY valid JSON with this exact structure:
{
  "headline": "8-10 word headline that hooks attention",
  "subline": "15-25 word supporting text that expands on the promise",
  "socialProof": "One credibility line with specific numbers if available",
  "buttonText": "2-4 word CTA"
}

Examples of good output:
- headline: "The Exact LinkedIn DM Script That Books 12 Calls/Week"
- subline: "Stop guessing what to say. Use the same message template that generated $340K in consulting revenue last quarter."
- socialProof: "Used by 2,400+ consultants to book qualified sales calls"
- buttonText: "Get the Script"`;

  const response = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  // Extract text content from response
  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text content in AI response');
  }

  // Parse JSON from response
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not find JSON in AI response');
  }

  const result = JSON.parse(jsonMatch[0]) as GeneratedOptinContent;

  // Validate required fields
  if (!result.headline || !result.subline || !result.socialProof || !result.buttonText) {
    throw new Error('AI response missing required fields');
  }

  return result;
}

// Alternative simpler version for quick generation without AI
export function generateDefaultOptinContent(
  leadMagnetTitle: string,
  concept?: LeadMagnetConcept | null
): GeneratedOptinContent {
  const painSolved = concept?.painSolved || 'Get instant access to proven strategies';

  return {
    headline: leadMagnetTitle.length > 60
      ? leadMagnetTitle.substring(0, 57) + '...'
      : leadMagnetTitle,
    subline: painSolved.length > 100
      ? painSolved.substring(0, 97) + '...'
      : painSolved,
    socialProof: 'Join thousands of professionals using this resource',
    buttonText: 'Get Free Access',
  };
}
