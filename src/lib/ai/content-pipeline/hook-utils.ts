/**
 * Shared hook extraction utilities used by hook-scorer and hook-generator.
 * Preserves empty lines within the hook section (e.g., spacing between lines).
 */

export const HOOK_LINE_COUNT = 5;

/**
 * Split content into hook (first 5 non-empty lines, preserving structure) and body (rest).
 */
export function splitHookAndBody(content: string): { hook: string; body: string } {
  const lines = content.split('\n');
  const nonEmptyIndices: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length > 0) {
      nonEmptyIndices.push(i);
    }
    if (nonEmptyIndices.length === HOOK_LINE_COUNT) break;
  }

  if (nonEmptyIndices.length === 0) {
    return { hook: '', body: '' };
  }

  const lastHookLineIndex = nonEmptyIndices[nonEmptyIndices.length - 1];
  return {
    hook: lines.slice(0, lastHookLineIndex + 1).join('\n'),
    body: lines.slice(lastHookLineIndex + 1).join('\n'),
  };
}

/**
 * Extract just the hook text from content.
 */
export function extractHook(content: string): string {
  return splitHookAndBody(content).hook;
}
