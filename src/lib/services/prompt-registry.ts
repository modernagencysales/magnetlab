import { PROMPT_DEFAULTS } from '@/lib/ai/content-pipeline/prompt-defaults';
import {
  getActivePromptBySlug,
  getPromptBySlug,
  updatePromptTemplate,
  getLatestPromptVersion,
  insertPromptVersion,
} from '@/server/repositories/admin.repo';

export interface PromptTemplate {
  slug: string;
  name: string;
  category: string;
  description: string;
  system_prompt: string;
  user_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  variables: Array<{ name: string; description: string; example: string }>;
  is_active: boolean;
  source: 'db' | 'default';
}

// In-memory cache with TTL
const cache = new Map<string, { template: PromptTemplate; expires: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch a prompt template by slug.
 * Priority: active DB row > hardcoded default.
 */
export async function getPrompt(slug: string): Promise<PromptTemplate> {
  // Check cache
  const cached = cache.get(slug);
  if (cached && Date.now() < cached.expires) {
    return cached.template;
  }

  // Try DB
  try {
    const data = await getActivePromptBySlug(slug);

    if (data) {
      const template: PromptTemplate = {
        slug: data.slug as string,
        name: data.name as string,
        category: data.category as string,
        description: data.description as string,
        system_prompt: data.system_prompt as string,
        user_prompt: data.user_prompt as string,
        model: data.model as string,
        temperature: data.temperature as number,
        max_tokens: data.max_tokens as number,
        variables: data.variables as PromptTemplate['variables'],
        is_active: true,
        source: 'db',
      };
      cache.set(slug, { template, expires: Date.now() + CACHE_TTL_MS });
      return template;
    }
  } catch {
    // DB fetch failed — fall through to default
  }

  // Fallback to hardcoded default
  const fallback = PROMPT_DEFAULTS[slug];
  if (fallback) {
    const template: PromptTemplate = { ...fallback, is_active: false, source: 'default' };
    cache.set(slug, { template, expires: Date.now() + CACHE_TTL_MS });
    return template;
  }

  throw new Error(`No prompt template found for slug: ${slug}`);
}

/**
 * Replace {{variable}} placeholders with values.
 * Unreplaced placeholders are removed (replaced with empty string).
 */
export function interpolatePrompt(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  // Remove any unreplaced placeholders
  result = result.replace(/\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}/g, '');
  return result;
}

/**
 * Save a prompt template + create a version snapshot.
 * Returns the new version number.
 */
export async function savePrompt(
  slug: string,
  updates: {
    system_prompt?: string;
    user_prompt?: string;
    model?: string;
    temperature?: number;
    max_tokens?: number;
    is_active?: boolean;
    name?: string;
    description?: string;
    variables?: PromptTemplate['variables'];
  },
  changedBy: string,
  changeNote?: string
): Promise<number> {
  // Get current prompt (any state, not just active)
  const current = await getPromptBySlug(slug);
  if (!current) {
    throw new Error(`Prompt not found: ${slug}`);
  }

  await updatePromptTemplate(slug, updates);

  const latestVersion = await getLatestPromptVersion(current.id as string);
  const nextVersion = (latestVersion?.version ?? 0) + 1;

  const merged = { ...current, ...updates };
  await insertPromptVersion({
    prompt_id: current.id as string,
    version: nextVersion,
    system_prompt: (merged.system_prompt ?? current.system_prompt) as string,
    user_prompt: (merged.user_prompt ?? current.user_prompt) as string,
    model: (merged.model ?? current.model) as string,
    temperature: (merged.temperature ?? current.temperature) as number,
    max_tokens: (merged.max_tokens ?? current.max_tokens) as number,
    change_note: changeNote ?? null,
    changed_by: changedBy,
  });

  // Invalidate cache
  cache.delete(slug);

  return nextVersion;
}

/** Clear the entire cache (useful for tests). */
export function clearPromptCache(): void {
  cache.clear();
}
