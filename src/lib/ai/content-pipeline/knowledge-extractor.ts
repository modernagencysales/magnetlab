import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { CLAUDE_SONNET_MODEL } from './model-config';
import type { KnowledgeCategory, KnowledgeSpeaker, KnowledgeType, TranscriptType } from '@/lib/types/content-pipeline';
import { logError } from '@/lib/utils/logger';

export interface ExtractedKnowledgeEntry {
  category: KnowledgeCategory;
  knowledge_type: KnowledgeType;
  speaker: KnowledgeSpeaker;
  content: string;
  context: string;
  tags: string[];
  suggested_topics: string[];
  quality_score: number;
  specificity: boolean;
  actionability: 'immediately_actionable' | 'contextual' | 'theoretical';
  speaker_company?: string;
}

export interface KnowledgeExtractionResult {
  entries: ExtractedKnowledgeEntry[];
  total_count: number;
}

export interface SpeakerMapEntry {
  role: 'host' | 'client' | 'guest' | 'unknown';
  company: string;
}

export async function extractKnowledgeFromTranscript(
  transcript: string,
  transcriptType: TranscriptType,
  context?: {
    participants?: string[];
    callDate?: string;
    callTitle?: string;
    speakerMap?: Record<string, SpeakerMapEntry> | null;
  }
): Promise<KnowledgeExtractionResult> {
  const typeGuidance = transcriptType === 'coaching'
    ? `This is a GROUP COACHING CALL where the host teaches. Focus heavily on:
- Insights: methods, frameworks, principles, mental models, strategies, tactical advice, stories with lessons
- Questions: what participants ask or push back on (these reveal what the audience cares about and struggles with)
- Product Intel: any mentions of the product, what it does, what's missing, feature requests`
    : `This is a SALES CALL between a sales rep and a prospect. Focus heavily on:
- Questions: prospect questions, objections, pain points, concerns, what confuses them
- Product Intel: feature requests, gaps mentioned, competitor comparisons, what resonated, what didn't land
- Insights: anything the sales rep explains well about the approach, methodology, or value proposition`;

  // Build speaker context section if speaker_map is provided
  let speakerContext = '';
  if (context?.speakerMap && Object.keys(context.speakerMap).length > 0) {
    const lines = Object.entries(context.speakerMap)
      .filter(([, info]) => info.company || info.role !== 'unknown')
      .map(([name, info]) => {
        const parts = [`"${name}"`];
        if (info.role === 'host') parts.push('is the HOST');
        else if (info.role === 'client') parts.push('is a CLIENT');
        else if (info.role === 'guest') parts.push('is a GUEST');
        if (info.company) parts.push(`from ${info.company}`);
        return `- ${parts.join(' ')}`;
      });

    if (lines.length > 0) {
      speakerContext = `
Speaker Context:
${lines.join('\n')}

IMPORTANT: When extracting knowledge, attribute insights to the correct person and company.
- The HOST speaks for their own company. Content from the host should be attributed to the host.
- CLIENTs and GUESTs speak for their own companies. Do NOT attribute their words to the host's company.
- When setting the "speaker" field, use "host" for the host's statements and "participant" for clients/guests.
- When a participant shares a pain point, question, or insight, it reflects THEIR perspective, not the host's.`;
    }
  }

  const prompt = `Role: You are a knowledge extraction specialist. Your job is to mine transcripts for business-valuable information and organize it into a structured knowledge base.

Input:
${context?.callTitle ? `Title: ${context.callTitle}` : ''}
${context?.participants?.length ? `Participants: ${context.participants.join(', ')}` : ''}
${context?.callDate ? `Date: ${context.callDate}` : ''}
Transcript Type: ${transcriptType}
${speakerContext}

${typeGuidance}

Task: Extract every piece of valuable knowledge from this transcript. For each entry, provide:

1. **knowledge_type**: One of:
   - "how_to" — Process, method, steps, or technique someone can follow
   - "insight" — Strategic observation, principle, framework, or mental model
   - "story" — Specific example with outcome — client result, case study, anecdote with lesson
   - "question" — Something someone asked plus the answer if given
   - "objection" — Pushback, resistance, or concern raised — plus how it was handled
   - "mistake" — Something that went wrong, a failed approach, or a lesson from failure
   - "decision" — A choice made between alternatives, with the reasoning
   - "market_intel" — Information about competitors, market trends, pricing, or industry shifts

2. **category**: Legacy mapping from knowledge_type:
   - how_to, insight, story, mistake, decision → "insight"
   - question, objection → "question"
   - market_intel → "product_intel"

3. **speaker**: Who originated this content:
   - "host" — the teacher/sales rep (the authority)
   - "participant" — coaching attendee or prospect
   - "unknown" — when the transcript doesn't make the speaker clear

4. **content**: The actual knowledge, written to be standalone and useful without the original transcript.

5. **context**: 1-2 sentences explaining what prompted this.

6. **tags**: 2-5 lowercase freeform tags describing specifics (e.g., "cold email subject lines", not "marketing").

7. **suggested_topics**: 1-3 broad topic labels for this entry (e.g., "Cold Email", "LinkedIn Outreach", "Sales Objections"). These get normalized later — just suggest natural labels.

8. **quality_score**: Rate 1-5:
   - 5: Specific + actionable + concrete details (numbers, names, timeframes) + novel
   - 4: Specific and actionable, somewhat expected but well-articulated
   - 3: Useful context, not immediately actionable but good to know
   - 2: General observation, nothing surprising
   - 1: Filler, obvious, too vague, or incomplete

9. **specificity**: true if contains concrete details (numbers, names, timeframes, specific examples), false otherwise.

10. **actionability**: One of:
    - "immediately_actionable" — someone could do this right now
    - "contextual" — useful background, informs decisions
    - "theoretical" — abstract principle or observation

Rules:
- Extract the RICHEST version if the same point comes up multiple times.
- Every entry must be useful on its own.
- For insights: capture the reasoning and examples, not just the conclusion.
- For questions: always pair with the answer if one was given.
- Don't extract small talk, logistics, or low-value exchanges.
- Preserve specific numbers, names, timeframes, and examples.

THE TRANSCRIPT FOLLOWS:
-------------------------------
${transcript.slice(0, 25000)}${transcript.length > 25000 ? '\n... [truncated]' : ''}

Return your response as valid JSON in this exact format:
{
  "entries": [
    {
      "knowledge_type": "how_to|insight|story|question|objection|mistake|decision|market_intel",
      "category": "insight|question|product_intel",
      "speaker": "host|participant|unknown",
      "content": "The full extracted knowledge, standalone and useful",
      "context": "1-2 sentences of what prompted this",
      "tags": ["specific", "lowercase", "tags"],
      "suggested_topics": ["Cold Email", "Outbound Strategy"],
      "quality_score": 4,
      "specificity": true,
      "actionability": "immediately_actionable|contextual|theoretical"
    }
  ],
  "total_count": number
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

  return parseJsonResponse<KnowledgeExtractionResult>(textContent.text);
}

export async function batchExtractKnowledge(
  transcripts: Array<{
    id: string;
    text: string;
    transcriptType: TranscriptType;
    title?: string;
    participants?: string[];
    callDate?: string;
  }>
): Promise<Map<string, KnowledgeExtractionResult>> {
  const results = new Map<string, KnowledgeExtractionResult>();

  const BATCH_SIZE = 3;
  for (let i = 0; i < transcripts.length; i += BATCH_SIZE) {
    const batch = transcripts.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (t) => {
        try {
          const result = await extractKnowledgeFromTranscript(t.text, t.transcriptType, {
            callTitle: t.title,
            participants: t.participants,
            callDate: t.callDate,
          });
          return { id: t.id, result };
        } catch (error) {
          logError('ai/knowledge-extractor', error, { transcriptId: t.id });
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
