import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { CLAUDE_SONNET_MODEL } from './model-config';
import { getPrompt, interpolatePrompt } from '@/lib/services/prompt-registry';
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

  const template = await getPrompt('knowledge-extractor');
  const prompt = interpolatePrompt(template.user_prompt, {
    call_title_line: context?.callTitle ? `Title: ${context.callTitle}` : '',
    participants_line: context?.participants?.length ? `Participants: ${context.participants.join(', ')}` : '',
    call_date_line: context?.callDate ? `Date: ${context.callDate}` : '',
    transcript_type: transcriptType,
    speaker_context: speakerContext,
    type_guidance: typeGuidance,
    transcript: `${transcript.slice(0, 25000)}${transcript.length > 25000 ? '\n... [truncated]' : ''}`,
  });

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: template.model,
    max_tokens: template.max_tokens,
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
