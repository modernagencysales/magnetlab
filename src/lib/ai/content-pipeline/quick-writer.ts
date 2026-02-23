import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { CLAUDE_SONNET_MODEL } from './model-config';
import { writePostFreeform } from './post-writer';
import { findBestTemplate, buildTemplateGuidance } from './template-matcher';
import { polishPost } from './post-polish';
import type { WrittenPost, IdeaContext } from './post-writer';
import type { PolishResult } from './post-polish';

interface QuickWriteOptions {
  userId?: string;
  templateStructure?: string;
  styleInstructions?: string;
  targetAudience?: string;
  knowledgeContext?: string;
  voiceProfile?: Record<string, unknown>;
  authorName?: string;
  authorTitle?: string;
}

interface QuickWriteResult {
  post: WrittenPost;
  polish: PolishResult;
  syntheticIdea: IdeaContext;
}

async function expandToIdea(rawThought: string): Promise<IdeaContext> {
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `Expand this raw thought into a structured content idea for a LinkedIn post. The thought might be a sentence, a bullet point, a question, or a vague concept.

RAW THOUGHT: ${rawThought}

Return ONLY valid JSON:
{
  "title": "A compelling post title/topic",
  "core_insight": "The key insight or takeaway",
  "full_context": "Expanded context and background for writing the post",
  "why_post_worthy": "Why this is worth posting about",
  "content_type": "One of: story, insight, tip, framework, case_study, question, listicle, contrarian"
}`,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return parseJsonResponse<IdeaContext>(textContent.text);
}

export async function quickWrite(
  rawThought: string,
  options: QuickWriteOptions = {}
): Promise<QuickWriteResult> {
  // Step 1: Expand raw thought into a structured idea
  const syntheticIdea = await expandToIdea(rawThought);

  // Step 2: Find matching template via RAG (if userId provided)
  let templateGuidance = '';
  if (options.userId) {
    const topicText = [syntheticIdea.title, syntheticIdea.core_insight, syntheticIdea.content_type].filter(Boolean).join('\n');
    const match = await findBestTemplate(topicText, options.userId);
    if (match) {
      templateGuidance = buildTemplateGuidance(match);
    }
  }

  const mergedKnowledge = [options.knowledgeContext, templateGuidance].filter(Boolean).join('\n\n');

  // Step 3: Write the post using the expanded idea
  const post = await writePostFreeform({
    idea: syntheticIdea,
    targetAudience: options.targetAudience,
    knowledgeContext: mergedKnowledge || undefined,
    voiceProfile: options.voiceProfile,
    authorName: options.authorName,
    authorTitle: options.authorTitle,
  });

  // Step 4: Polish the result
  const polish = await polishPost(post.content, { voiceProfile: options.voiceProfile });

  return {
    post,
    polish,
    syntheticIdea,
  };
}
