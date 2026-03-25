/** Style Rules runtime helpers. Used by generation points to inject global rules. */

import { getPrompt } from '@/lib/services/prompt-registry';
import { logError } from '@/lib/utils/logger';

/**
 * Load compiled global style rules from prompt registry.
 * Returns empty string if no rules exist or on any error.
 * Never throws — generation must not break due to style rules.
 */
export async function getGlobalStyleRules(): Promise<string> {
  try {
    const template = await getPrompt('global-style-rules');
    return template.user_prompt || '';
  } catch (err) {
    logError('style-rules', err, { slug: 'global-style-rules' });
    return '';
  }
}

/**
 * Compile approved global rules into a numbered instruction block.
 * Pure function — takes rules, returns compiled text.
 */
export function compileRuleText(rules: Array<{ rule_text: string }>): string {
  if (rules.length === 0) return '';

  const numbered = rules.map((r, i) => `${i + 1}. ${r.rule_text}`).join('\n\n');
  return `When generating any content, follow these rules learned from human editing patterns:\n\n${numbered}`;
}
