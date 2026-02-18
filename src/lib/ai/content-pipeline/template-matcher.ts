import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateEmbedding, isEmbeddingsConfigured } from '@/lib/ai/embeddings';
import { logError } from '@/lib/utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MatchedTemplate {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  structure: string;
  example_posts: string[] | null;
  use_cases: string[] | null;
  tags: string[] | null;
  usage_count: number;
  avg_engagement_score: number | null;
  source: string;
  similarity: number;
}

export interface MatchTemplateOptions {
  count?: number;
  minSimilarity?: number;
}

// ---------------------------------------------------------------------------
// Core matching
// ---------------------------------------------------------------------------

/**
 * Generates an embedding for `topicText` and calls the `cp_match_templates`
 * RPC to find semantically similar templates for the given user.
 *
 * Returns an empty array on error or when embeddings are not configured.
 */
export async function matchTemplates(
  topicText: string,
  userId: string,
  opts?: MatchTemplateOptions
): Promise<MatchedTemplate[]> {
  try {
    if (!isEmbeddingsConfigured()) {
      return [];
    }

    const count = opts?.count ?? 5;
    const minSimilarity = opts?.minSimilarity ?? 0.3;

    const embedding = await generateEmbedding(topicText);
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase.rpc('cp_match_templates', {
      query_embedding: JSON.stringify(embedding),
      match_user_id: userId,
      match_count: count,
      min_similarity: minSimilarity,
    });

    if (error) {
      logError('ai/template-matcher', new Error('cp_match_templates RPC failed'), {
        detail: error.message,
        userId,
      });
      return [];
    }

    return (data || []) as MatchedTemplate[];
  } catch (err) {
    logError('ai/template-matcher', err, { userId, topicText: topicText.slice(0, 200) });
    return [];
  }
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

/**
 * Returns the single best-matching template for the topic, or null when
 * nothing meets the similarity threshold.
 */
export async function findBestTemplate(
  topicText: string,
  userId: string
): Promise<MatchedTemplate | null> {
  const matches = await matchTemplates(topicText, userId, { count: 3 });
  if (matches.length === 0) return null;

  // Return the match with the highest similarity (should already be sorted,
  // but we explicitly pick the max to be safe).
  return matches.reduce((best, cur) => (cur.similarity > best.similarity ? cur : best));
}

/**
 * Builds a text block that can be injected into a post-writer prompt to guide
 * the LLM toward a proven template structure.
 */
export function buildTemplateGuidance(template: MatchedTemplate): string {
  const lines: string[] = [];

  lines.push('TEMPLATE GUIDANCE (proven structure, adapt freely):');
  lines.push(`Template: ${template.name}`);

  if (template.category) {
    lines.push(`Category: ${template.category}`);
  }

  if (template.description) {
    lines.push(`Purpose: ${template.description}`);
  }

  lines.push('');
  lines.push('Structure:');
  lines.push(template.structure);

  if (template.use_cases && template.use_cases.length > 0) {
    lines.push('');
    lines.push(`Best used for: ${template.use_cases.join('; ')}`);
  }

  if (template.example_posts && template.example_posts.length > 0) {
    lines.push('');
    lines.push('Example post using this template:');
    lines.push(template.example_posts[0]);
  }

  lines.push('');
  lines.push(
    'IMPORTANT: Use this template as structural inspiration. Adapt the format to fit the specific topic and voice. Do not force content into placeholders that don\'t apply.'
  );

  return lines.join('\n');
}
