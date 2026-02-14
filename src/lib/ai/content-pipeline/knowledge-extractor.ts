import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { CLAUDE_SONNET_MODEL } from './model-config';
import type { KnowledgeCategory, KnowledgeSpeaker, TranscriptType } from '@/lib/types/content-pipeline';
import { logError } from '@/lib/utils/logger';

export interface ExtractedKnowledgeEntry {
  category: KnowledgeCategory;
  speaker: KnowledgeSpeaker;
  content: string;
  context: string;
  tags: string[];
}

export interface KnowledgeExtractionResult {
  entries: ExtractedKnowledgeEntry[];
  total_count: number;
}

export async function extractKnowledgeFromTranscript(
  transcript: string,
  transcriptType: TranscriptType,
  context?: {
    participants?: string[];
    callDate?: string;
    callTitle?: string;
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

  const prompt = `Role: You are a knowledge extraction specialist. Your job is to mine transcripts for business-valuable information and organize it into a structured knowledge base.

Input:
${context?.callTitle ? `Title: ${context.callTitle}` : ''}
${context?.participants?.length ? `Participants: ${context.participants.join(', ')}` : ''}
${context?.callDate ? `Date: ${context.callDate}` : ''}
Transcript Type: ${transcriptType}

${typeGuidance}

Task: Extract every piece of valuable knowledge from this transcript. For each entry, provide:

1. **category**: One of:
   - "insight" — anything the host teaches, believes, recommends, or explains. Frameworks, principles, tips, stories with lessons, mental models, tactical advice, strategies.
   - "question" — what participants/prospects ask, push back on, or express confusion about. Include the question AND the host's answer if one was given.
   - "product_intel" — mentions of the product or service: feature requests, gaps, praise, complaints, comparisons to competitors, what resonated with prospects.

2. **speaker**: Who originated this content:
   - "host" — the teacher/sales rep (the authority)
   - "participant" — coaching attendee or prospect
   - "unknown" — when the transcript doesn't make the speaker clear

3. **content**: The actual knowledge, written to be standalone and useful without the original transcript.

4. **context**: 1-2 sentences explaining what prompted this

5. **tags**: 2-5 lowercase freeform tags describing the topics. Be specific ("cold email subject lines") not generic ("marketing").

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
      "category": "insight|question|product_intel",
      "speaker": "host|participant|unknown",
      "content": "The full extracted knowledge, standalone and useful",
      "context": "1-2 sentences of what prompted this",
      "tags": ["specific", "lowercase", "tags"]
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
