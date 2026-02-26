/**
 * Attempt to parse JSON, repairing common truncation artifacts.
 * Used as a fallback when Claude returns truncated JSON responses.
 */
export function repairJson(raw: string): Record<string, unknown> {
  // Strip markdown code fences
  let text = raw.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '');

  // Extract the outermost JSON object
  const objStart = text.indexOf('{');
  if (objStart === -1) throw new Error('No JSON object found');
  text = text.slice(objStart);

  // Try parsing as-is first
  try {
    return JSON.parse(text);
  } catch {
    // Continue to repair
  }

  // Remove trailing commas before } or ]
  text = text.replace(/,\s*([}\]])/g, '$1');

  // Try again after comma fix
  try {
    return JSON.parse(text);
  } catch {
    // Continue to bracket repair
  }

  // Track the nesting stack so we can close in correct order
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const char of text) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') stack.push('}');
    else if (char === '[') stack.push(']');
    else if (char === '}' || char === ']') stack.pop();
  }

  // If we're inside a string, close it
  if (inString) text += '"';

  // Remove any trailing partial key-value
  text = text.replace(/,\s*"[^"]*":\s*"[^"]*$/m, '');
  text = text.replace(/,\s*"[^"]*":\s*$/m, '');
  text = text.replace(/,\s*"[^"]*$/m, '');

  // Remove trailing commas again after trimming
  text = text.replace(/,\s*$/m, '');

  // Close unclosed brackets/braces in correct nesting order
  while (stack.length > 0) {
    text += stack.pop();
  }

  // Final trailing comma cleanup
  text = text.replace(/,\s*([}\]])/g, '$1');

  return JSON.parse(text);
}
