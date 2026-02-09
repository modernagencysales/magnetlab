import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { CLAUDE_SONNET_MODEL } from './model-config';
import type { ContentType, ContentPillar } from '@/lib/types/content-pipeline';

export interface ExtractedIdea {
  title: string;
  core_insight: string;
  full_context: string;
  why_post_worthy: string;
  content_type: ContentType;
  content_pillar: ContentPillar;
  post_ready: boolean;
}

export interface ExtractionResult {
  ideas: ExtractedIdea[];
  total_count: number;
  post_ready_count: number;
}

export async function extractIdeasFromTranscript(
  transcript: string,
  context?: {
    participants?: string[];
    callDate?: string;
    callTitle?: string;
  }
): Promise<ExtractionResult> {
  const prompt = `Role: You are a content strategist extracting post-worthy ideas from video transcripts. Your job is to identify every distinct idea that contains enough substance to write a standalone LinkedIn post with real value. You extract aggressively—capture everything needed to write the post, or skip the idea entirely.

Input:
${context?.callTitle ? `Title: ${context.callTitle}` : ''}
${context?.participants?.length ? `Participants: ${context.participants.join(', ')}` : ''}
${context?.callDate ? `Date: ${context.callDate}` : ''}

Task: Extract every idea from this transcript that could become a high-quality LinkedIn post. For each idea, provide:

1. **Core insight** (1-2 sentences capturing the actual takeaway)

2. **Full context** (Extract ALL of the following that exist in the transcript):
   - The complete story or example with setup, details, and outcome
   - Exact numbers, timeframes, dollar amounts, or metrics mentioned
   - The step-by-step process or mechanism if one is described
   - Who specifically this applies to or came from
   - What the situation was before vs. after
   - Any failures, mistakes, or "what not to do" mentioned
   - The reasoning or logic behind why this works
   - Any memorable phrasing, analogies, or quotable language worth preserving

3. **Why it's post-worthy** (what makes this interesting, counterintuitive, or actionable)

Quality gate—only extract ideas that have at least TWO of the following:
- A specific story, case study, or real example with details
- Exact numbers, metrics, or timeframes
- A step-by-step process or clear mechanism
- A contrarian take with the actual reasoning behind it
- A concrete before/after or problem/solution structure
- A memorable analogy, framework, or reframe

Do NOT extract:
- Observations without supporting detail
- Opinions without the argument or evidence behind them
- Advice that's just "what" without "how" or "why"
- Ideas where you'd have to invent details to make a full post
- Generic insights that could apply to any business

Extraction principle: When in doubt, include more detail from the transcript rather than less.

THE TRANSCRIPT FOLLOWS:
-------------------------------
${transcript.slice(0, 25000)}${transcript.length > 25000 ? '\n... [truncated]' : ''}

Content Pillar Classification:
Assign exactly ONE pillar to each idea based on its THEMATIC focus:
- "moments_that_matter": Career milestones, business turning points, achievements, lessons from pivotal moments
- "teaching_promotion": How-tos, educational content, frameworks, tips, expertise sharing
- "human_personal": Personal stories, vulnerabilities, life lessons, behind-the-scenes, failures and learnings
- "collaboration_social_proof": Partnerships, client wins, testimonials, case studies, shoutouts

Return your response as valid JSON in this exact format:
{
  "ideas": [
    {
      "title": "Working title for this idea (5-10 words)",
      "core_insight": "1-2 sentences capturing the actual takeaway",
      "full_context": "Complete extracted context including stories, numbers, processes, quotes",
      "why_post_worthy": "What makes this interesting, counterintuitive, or actionable",
      "content_type": "story|insight|tip|framework|case_study|question|listicle|contrarian",
      "content_pillar": "moments_that_matter|teaching_promotion|human_personal|collaboration_social_proof",
      "post_ready": true or false
    }
  ],
  "total_count": number,
  "post_ready_count": number
}`;

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return parseJsonResponse<ExtractionResult>(textContent.text);
}

export async function batchExtractIdeas(
  transcripts: Array<{
    id: string;
    text: string;
    title?: string;
    participants?: string[];
    callDate?: string;
  }>
): Promise<Map<string, ExtractionResult>> {
  const results = new Map<string, ExtractionResult>();

  const BATCH_SIZE = 3;
  for (let i = 0; i < transcripts.length; i += BATCH_SIZE) {
    const batch = transcripts.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (t) => {
        try {
          const result = await extractIdeasFromTranscript(t.text, {
            callTitle: t.title,
            participants: t.participants,
            callDate: t.callDate,
          });
          return { id: t.id, result };
        } catch (error) {
          console.error(`Failed to extract ideas from transcript ${t.id}:`, error);
          return { id: t.id, result: null };
        }
      })
    );

    for (const { id, result } of batchResults) {
      if (result) {
        results.set(id, result);
      }
    }
  }

  return results;
}
