import { toolsByName } from '../tools/index.js';
import { MagnetLabClient } from '../client.js';
import { handleToolCall, ToolResult } from '../handlers/index.js';

/**
 * Resolve a tool name — add magnetlab_ prefix if missing, validate it exists.
 */
export function resolveToolName(input: string): string | null {
  if (toolsByName.has(input)) return input;
  const prefixed = `magnetlab_${input}`;
  if (toolsByName.has(prefixed)) return prefixed;
  return null;
}

/**
 * Convert --kebab-case flag to snake_case parameter name.
 */
function flagToParam(flag: string): string {
  return flag.replace(/^--/, '').replace(/-/g, '_');
}

/**
 * Get the expected type for a parameter from the tool's inputSchema.
 */
function getParamType(toolName: string, paramName: string): string | undefined {
  const tool = toolsByName.get(toolName);
  if (!tool) return undefined;
  const schema = tool.inputSchema as { properties?: Record<string, { type?: string }> };
  return schema.properties?.[paramName]?.type;
}

/**
 * Parse CLI flags into an argument object using the tool's schema for type coercion.
 */
export function parseFlags(toolName: string, argv: string[]): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  let i = 0;

  while (i < argv.length) {
    const token = argv[i];

    if (!token.startsWith('--')) {
      i++;
      continue;
    }

    const paramName = flagToParam(token);
    const paramType = getParamType(toolName, paramName);
    const nextToken = argv[i + 1];

    // Boolean flag: no next value, or next value is another flag
    if (paramType === 'boolean' || !nextToken || nextToken.startsWith('--')) {
      args[paramName] = true;
      i++;
      continue;
    }

    const value = nextToken;
    i += 2;

    // Type coercion based on schema
    if (paramType === 'number') {
      args[paramName] = Number(value);
    } else if (paramType === 'object' || paramType === 'array') {
      try {
        args[paramName] = JSON.parse(value);
      } catch {
        args[paramName] = value;
      }
    } else {
      // Try JSON parse for values that look like JSON (starts with { or [)
      if ((value.startsWith('{') || value.startsWith('[')) && paramType !== 'string') {
        try {
          args[paramName] = JSON.parse(value);
        } catch {
          args[paramName] = value;
        }
      } else {
        args[paramName] = value;
      }
    }
  }

  return args;
}

/**
 * Execute a tool via CLI and return the result.
 * This is the core dispatch function used by the exec command.
 */
export async function execTool(
  toolName: string,
  flags: string[],
  apiKey: string,
  baseUrl?: string
): Promise<{ output: string; exitCode: number }> {
  const resolved = resolveToolName(toolName);
  if (!resolved) {
    return {
      output: JSON.stringify({ error: `Unknown tool: "${toolName}". Run: magnetlab tools` }),
      exitCode: 1,
    };
  }

  const args = parseFlags(resolved, flags);
  const client = new MagnetLabClient(apiKey, { baseUrl });
  const result: ToolResult = await handleToolCall(resolved, args, client);

  const text = result.content[0]?.text || '{}';

  // Check if result is an error
  try {
    const parsed = JSON.parse(text);
    if (parsed.error) {
      return { output: text, exitCode: 1 };
    }
  } catch {
    // Not JSON — return as-is
  }

  return { output: text, exitCode: 0 };
}
