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
 * Workflow guide tool — returns step-by-step recipes for common tasks.
 * IMPORTANT: Call this FIRST before starting any multi-step task.
 */
export const guideTool: Tool = {
  name: 'magnetlab_guide',
  description:
    'CALL THIS FIRST before any task. Returns the step-by-step workflow for common tasks like creating lead magnets, writing posts, or setting up funnels. Always check the guide before starting work to ensure you follow the correct sequence.',
  inputSchema: {
    type: 'object',
    properties: {
      task: {
        type: 'string',
        description: 'What you want to do',
        enum: [
          'create_lead_magnet',
          'write_linkedin_post',
          'setup_funnel',
          'analyze_content_gaps',
          'plan_content_week',
          'list_tasks',
        ],
      },
    },
    required: ['task'],
  },
}

/**
 * Workflow recipes keyed by task name.
 */
export const workflowRecipes: Record<string, string> = {
  create_lead_magnet: `# Creating a Lead Magnet — Workflow

The AI Brain (knowledge base) contains the user's REAL expertise extracted from call transcripts.
The brand kit is for VISUAL styling only (colors, fonts) — never use it for content substance.

## Steps

1. RESEARCH — Search the AI Brain for expertise on the topic
   → magnetlab_execute({tool: "magnetlab_search_knowledge", arguments: {query: "<topic>"}})
   → magnetlab_execute({tool: "magnetlab_ask_knowledge", arguments: {question: "What are the key insights about <topic>?"}})
   → magnetlab_execute({tool: "magnetlab_list_topics", arguments: {}})

2. ASSESS — Check if there's enough knowledge for this lead magnet
   → magnetlab_execute({tool: "magnetlab_knowledge_readiness", arguments: {topic: "<topic>", goal: "lead_magnet"}})
   If readiness is low, tell the user they may need to add more transcripts first.

3. IDEATE — Present research findings to the user, discuss the angle
   Share what you found in the AI Brain. Let the user confirm the direction.
   Use specific insights, stories, and frameworks from step 1.

4. CREATE — Build the lead magnet with research-informed input
   → magnetlab_execute({tool: "magnetlab_create_lead_magnet", arguments: {
       title: "...",
       archetype: "...",  // e.g. single-breakdown, focused-toolkit, assessment
       business_context: "..."  // Include specific insights from the AI Brain here
     }})

5. POLISH — Review and refine the content
   → magnetlab_execute({tool: "magnetlab_get_lead_magnet", arguments: {id: "..."}})

## Key principle
The lead magnet should sound like the user — use their actual language, stories, and frameworks from the AI Brain. Never generate generic content when real expertise is available.`,

  write_linkedin_post: `# Writing a LinkedIn Post — Workflow

## Steps

1. RESEARCH — Pull relevant knowledge
   → magnetlab_execute({tool: "magnetlab_search_knowledge", arguments: {query: "<topic>"}})
   → magnetlab_execute({tool: "magnetlab_ask_knowledge", arguments: {question: "..."}})

2. CHECK IDEAS — See if there are existing content ideas on this topic
   → magnetlab_execute({tool: "magnetlab_list_ideas", arguments: {status: "extracted"}})

3a. WRITE FROM IDEA (if matching idea exists)
   → magnetlab_execute({tool: "magnetlab_write_post_from_idea", arguments: {idea_id: "..."}})

3b. QUICK WRITE (if no matching idea)
   → magnetlab_execute({tool: "magnetlab_quick_write", arguments: {topic: "..."}})

4. POLISH
   → magnetlab_execute({tool: "magnetlab_polish_post", arguments: {id: "..."}})

5. REVIEW with user, then schedule or publish
   → magnetlab_execute({tool: "magnetlab_schedule_post", arguments: {post_id: "...", scheduled_time: "..."}})

## Key principle
Always ground posts in real insights from the AI Brain. The user's actual stories and frameworks make posts authentic.`,

  setup_funnel: `# Setting Up a Funnel — Workflow

## Steps

1. Ensure a lead magnet exists (create one first if needed — use create_lead_magnet workflow)

2. CREATE FUNNEL
   → magnetlab_execute({tool: "magnetlab_create_funnel", arguments: {lead_magnet_id: "...", title: "..."}})

3. CUSTOMIZE PAGES — Edit sections, apply theme
   → magnetlab_execute({tool: "magnetlab_list_funnel_sections", arguments: {funnel_id: "..."}})
   → magnetlab_execute({tool: "magnetlab_update_funnel_section", arguments: {id: "...", ...}})

4. SET UP QUALIFICATION (optional)
   → magnetlab_execute({tool: "magnetlab_create_qualification_form", arguments: {funnel_page_id: "...", questions: [...]}})

5. SET UP EMAIL SEQUENCE (optional)
   → magnetlab_execute({tool: "magnetlab_create_email_sequence", arguments: {funnel_page_id: "...", ...}})

6. PUBLISH
   → magnetlab_execute({tool: "magnetlab_publish_funnel", arguments: {funnel_id: "..."}})`,

  analyze_content_gaps: `# Analyzing Content Gaps — Workflow

## Steps

1. LIST TOPICS — See what's in the knowledge base
   → magnetlab_execute({tool: "magnetlab_list_topics", arguments: {}})

2. CHECK GAPS — Find what's missing
   → magnetlab_execute({tool: "magnetlab_knowledge_gaps", arguments: {}})

3. ASSESS READINESS for specific goals
   → magnetlab_execute({tool: "magnetlab_knowledge_readiness", arguments: {topic: "...", goal: "content_week"}})

4. REVIEW RECENT — What's been added lately?
   → magnetlab_execute({tool: "magnetlab_recent_knowledge", arguments: {days: 14}})

5. Present findings to user with recommendations:
   - Which topics are strong (ready for lead magnets/posts)
   - Which topics have gaps (need more transcripts)
   - Suggested next transcripts to upload`,

  plan_content_week: `# Planning a Content Week — Workflow

## Steps

1. CHECK KNOWLEDGE — What topics have strong coverage?
   → magnetlab_execute({tool: "magnetlab_list_topics", arguments: {}})
   → magnetlab_execute({tool: "magnetlab_knowledge_gaps", arguments: {}})

2. REVIEW IDEAS — What content ideas are ready?
   → magnetlab_execute({tool: "magnetlab_list_ideas", arguments: {status: "extracted"}})

3. CHECK CURRENT SCHEDULE
   → magnetlab_execute({tool: "magnetlab_get_autopilot_status", arguments: {}})
   → magnetlab_execute({tool: "magnetlab_list_posting_slots", arguments: {}})

4. GENERATE PLAN
   → magnetlab_execute({tool: "magnetlab_generate_plan", arguments: {week_count: 1}})

5. REVIEW with user, then approve
   → magnetlab_execute({tool: "magnetlab_approve_plan", arguments: {plan_id: "..."}})

6. Optionally TRIGGER AUTOPILOT to write drafts
   → magnetlab_execute({tool: "magnetlab_trigger_autopilot", arguments: {posts_per_batch: 5}})`,

  list_tasks: `# Available Workflows

Call magnetlab_guide with one of these tasks:

- create_lead_magnet — Research expertise, then create a knowledge-grounded lead magnet
- write_linkedin_post — Write an authentic post using AI Brain insights
- setup_funnel — Build an opt-in funnel with pages, qualification, and email sequence
- analyze_content_gaps — Find knowledge gaps and content opportunities
- plan_content_week — Plan and schedule a week of content

For any task: the AI Brain (magnetlab_knowledge category) contains the user's real expertise from call transcripts. ALWAYS search it before creating content.`,
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
