import { toolsByName } from '../tools/index.js';

/** Convert snake_case parameter name to --kebab-case CLI flag. */
function toFlag(name: string): string {
  return '--' + name.replace(/_/g, '-');
}

/**
 * Format full help text for a tool, including CLI flag syntax.
 */
export function formatToolHelp(toolName: string): string {
  // Try with and without prefix
  const resolved = toolsByName.get(toolName) || toolsByName.get(`magnetlab_${toolName}`);

  if (!resolved) {
    return `Unknown tool: "${toolName}". Run: magnetlab tools`;
  }

  const schema = resolved.inputSchema as {
    properties?: Record<
      string,
      {
        type?: string;
        description?: string;
        enum?: string[];
        default?: unknown;
        items?: { type?: string };
      }
    >;
    required?: string[];
  };

  const props = schema.properties || {};
  const required = new Set(schema.required || []);

  const lines: string[] = [
    resolved.name,
    resolved.description || '',
    '',
    'Usage:',
    `  magnetlab exec ${resolved.name.replace('magnetlab_', '')} [flags]`,
    '',
    'Flags:',
  ];

  for (const [name, def] of Object.entries(props)) {
    const flag = toFlag(name);
    const req = required.has(name) ? ' REQUIRED' : '';
    const type = def.type === 'array' ? `${def.items?.type || 'string'}[]` : def.type || 'any';
    const enumStr = def.enum ? `  [${def.enum.join(' | ')}]` : '';
    const defaultStr = def.default !== undefined ? `  (default: ${def.default})` : '';
    const desc = def.description ? `  ${def.description}` : '';
    lines.push(`  ${flag} <${type}>${req}${enumStr}${defaultStr}`);
    if (desc) lines.push(`      ${desc.trim()}`);
  }

  if (Object.keys(props).length === 0) {
    lines.push('  (no parameters)');
  }

  return lines.join('\n');
}
