#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { Command } from 'commander';
import { MagnetLabClient } from './client.js';
import { tools } from './tools/index.js';
import { handleToolCall } from './handlers/index.js';

const VERSION = '2.0.0';

// Re-export constants and types for consumers
export * from './constants.js';
export { MagnetLabClient } from './client.js';

async function startServer(apiKey: string, baseUrl: string | undefined) {
  const client = new MagnetLabClient(apiKey, { baseUrl });

  const server = new Server(
    { name: 'magnetlab', version: VERSION },
    { capabilities: { tools: {} } }
  );

  // Register all 37 tools directly — no indirection
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, (args as Record<string, unknown>) || {}, client);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function resolveOptions(options: { apiKey?: string; baseUrl?: string }) {
  const apiKey = options.apiKey || process.env.MAGNETLAB_API_KEY;
  if (!apiKey) {
    console.error('Error: API key required. Set MAGNETLAB_API_KEY or use --api-key');
    process.exit(1);
  }
  const baseUrl = options.baseUrl || process.env.MAGNETLAB_BASE_URL;
  return { apiKey, baseUrl };
}

// CLI setup
const program = new Command()
  .name('magnetlab-mcp')
  .version(VERSION)
  .description('MagnetLab MCP server — 37 direct tools for agent-native lead magnet creation')
  .option('--api-key <key>', 'MagnetLab API key')
  .option('--base-url <url>', 'API base URL')
  .action(async (opts) => {
    const { apiKey, baseUrl } = resolveOptions(opts);
    await startServer(apiKey, baseUrl);
  });

program.parse();
