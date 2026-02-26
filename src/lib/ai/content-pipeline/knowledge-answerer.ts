import { getAnthropicClient } from './anthropic-client';
import { CLAUDE_HAIKU_MODEL } from './model-config';
import { searchKnowledgeV2 } from '@/lib/services/knowledge-brain';
import { logError } from '@/lib/utils/logger';

interface KnowledgeAnswer {
  answer: string;
  sources: Array<{ id: string; content: string; type: string }>;
}

/**
 * Answer a natural language question using the knowledge base.
 * Uses RAG: retrieve relevant entries -> synthesize answer.
 */
export async function answerKnowledgeQuestion(
  userId: string,
  question: string,
  teamId?: string
): Promise<KnowledgeAnswer> {
  const result = await searchKnowledgeV2(userId, {
    query: question,
    limit: 15,
    threshold: 0.5,
    minQuality: 2,
    teamId,
  });

  if (result.entries.length === 0) {
    return {
      answer: 'I don\'t have enough knowledge on this topic yet. Process more call transcripts to build your knowledge base.',
      sources: [],
    };
  }

  const context = result.entries
    .map((e, i) => `[${i + 1}] (${e.knowledge_type || e.category}) ${e.content}`)
    .join('\n\n');

  try {
    const client = getAnthropicClient('knowledge-answerer');
    const response = await client.messages.create({
      model: CLAUDE_HAIKU_MODEL,
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Answer this question using ONLY the knowledge base entries below. Be specific and cite entry numbers when referencing specific knowledge.

QUESTION: ${question}

KNOWLEDGE BASE:
${context}

Answer concisely but thoroughly. If the knowledge is incomplete, say what's missing. Do not make up information not in the knowledge base.`,
      }],
    });

    const answer = response.content[0].type === 'text' ? response.content[0].text : 'Unable to generate answer.';

    return {
      answer,
      sources: result.entries.slice(0, 5).map(e => ({
        id: e.id,
        content: e.content.slice(0, 200),
        type: e.knowledge_type || e.category,
      })),
    };
  } catch (error) {
    logError('ai/knowledge-answerer', error);
    return {
      answer: 'Failed to generate answer. Please try again.',
      sources: [],
    };
  }
}
