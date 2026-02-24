import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { PROMPT_DEFAULTS } from '@/lib/ai/content-pipeline/prompt-defaults';

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
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from('ai_prompt_templates')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (data) {
      const template: PromptTemplate = {
        slug: data.slug,
        name: data.name,
        category: data.category,
        description: data.description,
        system_prompt: data.system_prompt,
        user_prompt: data.user_prompt,
        model: data.model,
        temperature: data.temperature,
        max_tokens: data.max_tokens,
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
export function interpolatePrompt(
  template: string,
  variables: Record<string, string>
): string {
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
  const supabase = createSupabaseAdminClient();

  // Get current prompt
  const { data: current, error: fetchError } = await supabase
    .from('ai_prompt_templates')
    .select('*')
    .eq('slug', slug)
    .single();

  if (fetchError || !current) {
    throw new Error(`Prompt not found: ${slug}`);
  }

  // Update the template
  const { error: updateError } = await supabase
    .from('ai_prompt_templates')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('slug', slug);

  if (updateError) throw new Error(`Failed to update prompt: ${updateError.message}`);

  // Get next version number
  const { data: latestVersion } = await supabase
    .from('ai_prompt_versions')
    .select('version')
    .eq('prompt_id', current.id)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  const nextVersion = (latestVersion?.version ?? 0) + 1;

  // Snapshot the NEW state (after update)
  const merged = { ...current, ...updates };
  const { error: versionError } = await supabase
    .from('ai_prompt_versions')
    .insert({
      prompt_id: current.id,
      version: nextVersion,
      system_prompt: merged.system_prompt ?? current.system_prompt,
      user_prompt: merged.user_prompt ?? current.user_prompt,
      model: merged.model ?? current.model,
      temperature: merged.temperature ?? current.temperature,
      max_tokens: merged.max_tokens ?? current.max_tokens,
      change_note: changeNote ?? null,
      changed_by: changedBy,
    });

  if (versionError) throw new Error(`Failed to create version: ${versionError.message}`);

  // Invalidate cache
  cache.delete(slug);

  return nextVersion;
}

/** Clear the entire cache (useful for tests). */
export function clearPromptCache(): void {
  cache.clear();
}
