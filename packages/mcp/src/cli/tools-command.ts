import { discoveryCategories } from '../tools/index.js';
import {
  getCategoryLabel,
  getCategoryToolCount,
  DiscoveryCategoryKey,
} from '../tools/category-tools.js';
import { toolsByName } from '../tools/index.js';

/**
 * Format all categories with their labels and tool counts.
 */
export function formatToolList(): string {
  const lines: string[] = ['MagnetLab Tools\n'];

  for (const key of Object.keys(discoveryCategories) as DiscoveryCategoryKey[]) {
    const label = getCategoryLabel(key);
    const count = getCategoryToolCount(key);
    lines.push(`  ${key} — ${label} (${count} tools)`);
  }

  lines.push('');
  lines.push('Run: magnetlab tools <category> to see tools in a category');
  lines.push('Run: magnetlab help <tool> to see tool parameters');

  return lines.join('\n');
}

/**
 * Format tools in a specific category.
 */
export function formatCategoryTools(category: string): string {
  const categories = discoveryCategories as Record<string, string[]>;
  const toolNames = categories[category];

  if (!toolNames) {
    const validKeys = Object.keys(discoveryCategories).join(', ');
    return `Unknown category: "${category}". Valid categories: ${validKeys}`;
  }

  const label = getCategoryLabel(category as DiscoveryCategoryKey);
  const lines: string[] = [`${label} — ${toolNames.length} tools\n`];

  for (const name of toolNames) {
    const tool = toolsByName.get(name);
    const firstSentence = (tool?.description || '').split('.')[0];
    lines.push(`  ${name}: ${firstSentence}`);
  }

  return lines.join('\n');
}
