import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { discoveryCategories } from './index.js'

export type DiscoveryCategoryKey = keyof typeof discoveryCategories

/**
 * Category discovery tools + execute gateway + tool help.
 *
 * Only 14 tools registered with the client (11 categories + execute + tool_help + overview).
 * Category tools return slim lists (name + one-line description).
 * tool_help returns full schema for a single tool on demand.
 * execute dispatches to any real tool by name.
 */

const categoryDescriptions: Record<DiscoveryCategoryKey, { label: string; description: string }> = {
  knowledge: {
    label: 'Knowledge & AI Brain',
    description:
      'Your expertise and knowledge base. Use this to access transcripts, search the AI Brain for insights/stories/frameworks, explore topics, find knowledge gaps, and assess content readiness. START HERE when creating any content — this is where your real expertise lives.',
  },
  contentWriting: {
    label: 'Content Writing',
    description:
      'Write and edit LinkedIn posts. Use this to browse content ideas, write posts from ideas or topics, polish drafts, manage writing styles, match templates, and update business context for AI writing.',
  },
  contentScheduling: {
    label: 'Content Scheduling',
    description:
      'Schedule and automate posting. Use this to manage posting slots, schedule posts, run autopilot, review the content buffer, and plan content calendars.',
  },
  leadMagnets: {
    label: 'Lead Magnets & Leads',
    description:
      'Create and manage lead magnets, view captured leads, and check funnel analytics. Use this when building new lead magnets, checking lead performance, or exporting lead data.',
  },
  ideation: {
    label: 'Ideation & Analysis',
    description:
      'Generate lead magnet concepts, extract content from transcripts, analyze competitors, and write posts from ideas. Use this for brainstorming and research before creating content.',
  },
  funnels: {
    label: 'Funnels & Pages',
    description:
      'Build and manage opt-in funnels. Use this for creating funnel pages, editing sections, applying themes, publishing funnels, and running A/B tests.',
  },
  brandKit: {
    label: 'Visual Branding',
    description:
      'Visual brand styles ONLY — colors, logos, fonts, and design preferences. This does NOT contain your expertise or content knowledge. Use the Knowledge category for that.',
  },
  emailSequences: {
    label: 'Email Sequences',
    description:
      'Drip email campaigns. Use this to create, edit, trigger, and publish automated email sequences that nurture leads after opt-in.',
  },
  emailSystem: {
    label: 'Email System',
    description:
      'Email infrastructure. Use this for managing ESP integrations, subscriber lists, email templates, broadcast sends, and subscriber preferences.',
  },
  swipeFile: {
    label: 'Swipe File',
    description:
      'Content inspiration library. Use this to browse community-shared posts, save posts for reference, and manage your swipe file collection.',
  },
  libraries: {
    label: 'Libraries',
    description:
      'Organize lead magnets into shareable collections. Use this to create, manage, and share curated libraries of your lead magnets.',
  },
  qualificationForms: {
    label: 'Qualification Forms',
    description:
      'Lead qualification surveys. Use this to create and manage the survey questions shown on thank-you pages to qualify and segment leads.',
  },
}

export const categoryTools: Tool[] = Object.entries(categoryDescriptions).map(
  ([key, { description }]) => ({
    name: `magnetlab_${key.replace(/([A-Z])/g, '_$1').toLowerCase()}`,
    description,
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  })
)

/**
 * The gateway tool that executes any real tool by name.
 */
export const executeGatewayTool: Tool = {
  name: 'magnetlab_execute',
  description:
    'Execute any MagnetLab tool by name. First call a category tool to see available tools, then use magnetlab_tool_help to get parameters for a specific tool, then call this to execute it.',
  inputSchema: {
    type: 'object',
    properties: {
      tool: {
        type: 'string',
        description: 'The tool name to execute (e.g., "magnetlab_search_knowledge")',
      },
      arguments: {
        type: 'object',
        description: 'The arguments to pass to the tool, matching its schema',
      },
    },
    required: ['tool'],
  },
}

/**
 * On-demand schema lookup for a single tool.
 */
export const toolHelpTool: Tool = {
  name: 'magnetlab_tool_help',
  description:
    'Get the full parameter schema for a specific tool. Use this after browsing a category to see exactly what arguments a tool accepts before calling magnetlab_execute.',
  inputSchema: {
    type: 'object',
    properties: {
      tool: {
        type: 'string',
        description: 'The tool name to get help for (e.g., "magnetlab_search_knowledge")',
      },
    },
    required: ['tool'],
  },
}

/**
 * Maps category tool names back to their discovery category key.
 */
export const categoryToolToKey = new Map<string, DiscoveryCategoryKey>(
  Object.keys(categoryDescriptions).map((key) => [
    `magnetlab_${key.replace(/([A-Z])/g, '_$1').toLowerCase()}`,
    key as DiscoveryCategoryKey,
  ])
)

/**
 * Get human-readable label for a category.
 */
export function getCategoryLabel(key: DiscoveryCategoryKey): string {
  return categoryDescriptions[key].label
}

/**
 * Get the count of real tools in a discovery category.
 */
export function getCategoryToolCount(key: DiscoveryCategoryKey): number {
  return discoveryCategories[key].length
}
