#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { Command } from 'commander'
import { MagnetLabClient } from './client.js'
import { tools } from './tools/index.js'
import { handleToolCall } from './handlers/index.js'

// Re-export constants and types for consumers
export * from './constants.js'
export { MagnetLabClient } from './client.js'

async function startServer(apiKey: string, baseUrl: string | undefined) {
  // Create the MagnetLab client
  const client = new MagnetLabClient(apiKey, { baseUrl })

  // Create the MCP server
  const server = new Server(
    { name: 'magnetlab', version: '0.1.0' },
    { capabilities: { tools: {} } }
  )

  // Register the tools list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }))

  // Register the tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    return handleToolCall(name, (args as Record<string, unknown>) || {}, client)
  })

  // Connect via stdio transport
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

function resolveOptions(options: { apiKey?: string; baseUrl?: string }) {
  const apiKey = options.apiKey || process.env.MAGNETLAB_API_KEY
  if (!apiKey) {
    console.error('Error: API key required. Set MAGNETLAB_API_KEY or use --api-key')
    process.exit(1)
  }
  const baseUrl = options.baseUrl || process.env.MAGNETLAB_BASE_URL
  return { apiKey, baseUrl }
}

const program = new Command()

program.name('magnetlab-mcp').description('MCP server for MagnetLab').version('0.1.0')

program
  .command('serve')
  .description('Start the MCP server')
  .option('--api-key <key>', 'MagnetLab API key')
  .option('--base-url <url>', 'MagnetLab API base URL')
  .action(async (options) => {
    const { apiKey, baseUrl } = resolveOptions(options)
    await startServer(apiKey, baseUrl)
  })

// Default command (no subcommand) also starts the server for simplicity
program
  .option('--api-key <key>', 'MagnetLab API key')
  .option('--base-url <url>', 'MagnetLab API base URL')
  .action(async (options) => {
    const { apiKey, baseUrl } = resolveOptions(options)
    await startServer(apiKey, baseUrl)
  })

program.parse()
