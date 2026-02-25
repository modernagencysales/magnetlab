#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { Command } from 'commander'
import { MagnetLabClient } from './client.js'
import { toolsByName, discoveryCategories } from './tools/index.js'
import { handleToolCall } from './handlers/index.js'
import {
  categoryTools,
  executeGatewayTool,
  toolHelpTool,
  guideTool,
  workflowRecipes,
  categoryToolToKey,
  getCategoryLabel,
  getCategoryToolCount,
} from './tools/category-tools.js'

const VERSION = '0.4.4'

// Re-export constants and types for consumers
export * from './constants.js'
export { MagnetLabClient } from './client.js'

/**
 * Format a tool as a slim one-liner: "- tool_name: First sentence of description"
 */
function slimToolLine(tool: { name: string; description?: string }): string {
  const firstSentence = (tool.description || '').split('.')[0]
  return `- ${tool.name}: ${firstSentence}`
}

/**
 * Format full schema for a single tool (used by tool_help).
 */
function fullToolSchema(tool: { name: string; description?: string; inputSchema: unknown }): string {
  const schema = tool.inputSchema as { properties?: Record<string, unknown>; required?: string[] }
  const props = schema.properties || {}
  const required = new Set(schema.required || [])

  const params = Object.entries(props)
    .map(([name, def]) => {
      const d = def as { type?: string; description?: string; enum?: string[]; default?: unknown }
      const req = required.has(name) ? ' REQUIRED' : ''
      const enumStr = d.enum ? ` [${d.enum.join(' | ')}]` : ''
      const defaultStr = d.default !== undefined ? ` (default: ${d.default})` : ''
      const desc = d.description ? ` — ${d.description}` : ''
      return `  ${name}: ${d.type || 'any'}${req}${enumStr}${defaultStr}${desc}`
    })
    .join('\n')

  return [
    tool.name,
    tool.description || '',
    '',
    params ? `Parameters:\n${params}` : 'Parameters: none',
    '',
    `Example: magnetlab_execute({tool: "${tool.name}"${Object.keys(props).length > 0 ? ', arguments: {...}' : ''}})`,
  ].join('\n')
}

async function startServer(apiKey: string, baseUrl: string | undefined) {
  const client = new MagnetLabClient(apiKey, { baseUrl })

  const server = new Server(
    { name: 'magnetlab', version: VERSION },
    { capabilities: { tools: {} } }
  )

  // 15 tools registered: 12 categories + execute + tool_help + guide
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [guideTool, ...categoryTools, executeGatewayTool, toolHelpTool],
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params

    // Handle category discovery — return slim tool list
    const categoryKey = categoryToolToKey.get(name)
    if (categoryKey) {
      const toolNames = discoveryCategories[categoryKey]
      const slimList = toolNames
        .map((n) => toolsByName.get(n))
        .filter(Boolean)
        .map((t) => slimToolLine(t!))
        .join('\n')

      return {
        content: [
          {
            type: 'text',
            text: `${getCategoryLabel(categoryKey)} — ${getCategoryToolCount(categoryKey)} tools:\n\n${slimList}\n\nUse magnetlab_tool_help({tool: "tool_name"}) to see parameters, then magnetlab_execute({tool: "tool_name", arguments: {...}}) to call it.`,
          },
        ],
      }
    }

    // Handle guide — return workflow recipe
    if (name === 'magnetlab_guide') {
      const task = (args as Record<string, unknown>)?.task as string
      if (!task) {
        return {
          content: [{ type: 'text', text: workflowRecipes['list_tasks'] }],
        }
      }

      const recipe = workflowRecipes[task]
      if (!recipe) {
        return {
          content: [
            {
              type: 'text',
              text: `Unknown task: "${task}". ${workflowRecipes['list_tasks']}`,
            },
          ],
        }
      }

      return {
        content: [{ type: 'text', text: recipe }],
      }
    }

    // Handle tool_help — return full schema for one tool
    if (name === 'magnetlab_tool_help') {
      const toolName = (args as Record<string, unknown>)?.tool as string
      if (!toolName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Missing required parameter: tool' }) }],
        }
      }

      const tool = toolsByName.get(toolName)
      if (!tool) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: `Unknown tool: ${toolName}. Call a category tool first to see available tools.` }),
            },
          ],
        }
      }

      return {
        content: [{ type: 'text', text: fullToolSchema(tool) }],
      }
    }

    // Handle execute gateway
    if (name === 'magnetlab_execute') {
      const toolName = (args as Record<string, unknown>)?.tool as string
      const toolArgs = ((args as Record<string, unknown>)?.arguments as Record<string, unknown>) || {}

      if (!toolName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Missing required parameter: tool' }) }],
        }
      }

      if (!toolsByName.has(toolName)) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: `Unknown tool: ${toolName}. Call a category tool first to see available tools.` }),
            },
          ],
        }
      }

      return handleToolCall(toolName, toolArgs, client)
    }

    return {
      content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
    }
  })

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

program.name('magnetlab-mcp').description('MCP server for MagnetLab').version(VERSION)

program
  .command('serve')
  .description('Start the MCP server')
  .option('--api-key <key>', 'MagnetLab API key')
  .option('--base-url <url>', 'MagnetLab API base URL')
  .action(async (options) => {
    const { apiKey, baseUrl } = resolveOptions(options)
    await startServer(apiKey, baseUrl)
  })

program
  .option('--api-key <key>', 'MagnetLab API key')
  .option('--base-url <url>', 'MagnetLab API base URL')
  .action(async (options) => {
    const { apiKey, baseUrl } = resolveOptions(options)
    await startServer(apiKey, baseUrl)
  })

program.parse()
