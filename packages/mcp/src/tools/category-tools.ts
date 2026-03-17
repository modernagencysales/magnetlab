import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { discoveryCategories } from './index.js';

export type DiscoveryCategoryKey = keyof typeof discoveryCategories;

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
};

export const categoryTools: Tool[] = Object.entries(categoryDescriptions).map(
  ([key, { description }]) => ({
    name: `magnetlab_${key.replace(/([A-Z])/g, '_$1').toLowerCase()}`,
    description,
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  })
);

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
};

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
};

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
};

/**
 * Workflow recipes keyed by task name.
 */
export const workflowRecipes: Record<string, string> = {
  create_lead_magnet: `# Creating a Lead Magnet — Workflow

The AI Brain (knowledge base) contains the user's REAL expertise extracted from call transcripts.
The brand kit is for VISUAL styling only (colors, fonts) — never use it for content substance.

## Resuming an interrupted workflow?
→ magnetlab_execute({tool: "magnetlab_lead_magnet_status", arguments: {lead_magnet_id: "..."}})
Returns what exists, what's missing, and the next step. Skip to that step below.

## Steps

### 0. ASSESS READINESS — Check brain has enough knowledge
→ magnetlab_execute({tool: "magnetlab_knowledge_readiness", arguments: {topic: "<topic>", goal: "lead_magnet"}})

**Read the response fields:**
- confidence: "high" | "medium" | "low" — high/medium = proceed, low = warn the user
- entry_count: number of knowledge entries found
- gaps: string[] — what's missing from the brain on this topic
- suggestions: string[] — what the user could add (e.g., more transcripts about X)

If confidence is "low": Tell the user what's missing and ask if they want to proceed with limited
brain data or upload more transcripts first. A lead magnet with low brain data will have generic
content instead of their unique expertise.

### 1. RESEARCH — Search the AI Brain for expertise
→ magnetlab_execute({tool: "magnetlab_search_knowledge", arguments: {query: "<topic>"}})
→ magnetlab_execute({tool: "magnetlab_ask_knowledge", arguments: {question: "What are the key insights about <topic>?"}})

**Use from search response:** entries[].content, entries[].knowledge_type, entries[].topics

### 1b. SYNTHESIZE — Build the user's position on this topic
→ magnetlab_execute({tool: "magnetlab_synthesize_position", arguments: {topic: "<topic-slug>"}})

**Key response fields to use in step 3:**
- position.thesis — the user's core argument (→ becomes painSolved / headline angle)
- position.differentiators — what makes their take unique (→ becomes hook / subheadline)
- position.key_arguments — supporting points (→ becomes key takeaways)
- position.stories — real anecdotes with hook/arc/lesson (→ use in content & emails)
- position.unique_data_points — specific claims with evidence (→ social proof & email insights)
- position.specific_recommendations — actionable advice (→ CTA angle & email tips)
- position.voice_markers — how they naturally speak (→ tone for all generated copy)

### 2. IDEATE — Present findings and discuss angle with the user
Show the user what the brain has on this topic: thesis, differentiators, key stories.
Propose a specific angle for the lead magnet based on their unique position.
Agree on title, archetype, and concept before proceeding.

### 3. CREATE + FUNNEL (one call, with brain enrichment)
→ magnetlab_execute({tool: "magnetlab_create_lead_magnet", arguments: {
     title: "...",
     archetype: "single-breakdown" | "single-system" | "focused-toolkit" | etc,
     use_brain: true,
     concept: {
       hook: "...",           // from position.stories or position.unique_data_points
       painSolved: "...",     // from position.thesis
       whyNowHook: "...",     // from position.differentiators[0]
       key_takeaways: [...]   // from position.key_arguments
     },
     funnel_config: {
       slug: "my-guide",
       optin_headline: "...",       // lead with the differentiator
       optin_subline: "...",
       optin_social_proof: null,    // ONLY use real data — null if none available
       publish: false
     }
   }})

use_brain=true automatically searches the AI Brain, synthesizes the user's position, and enriches
the concept. Manual concept fields you provide take priority over brain-derived ones.

**Extract from response:**
- lead_magnet.id → needed for steps 4, 5, 6
- funnel.funnel.id → needed for step 7
- brain_entries_used, position_used → confirm brain was used

### 4. GENERATE CONTENT (slow: 30-90s)
→ magnetlab_execute({tool: "magnetlab_generate_lead_magnet_content", arguments: {lead_magnet_id: "<id from step 3>"}})

Generates 2000+ word structured content from the concept + AI Brain entries.
Brain entries, data points, and recommendations are automatically woven into the content.
Saves to extracted_content and polished_content fields.

### 5. GENERATE EMAIL SEQUENCE (slow: 30-60s)
→ magnetlab_execute({tool: "magnetlab_generate_email_sequence", arguments: {lead_magnet_id: "<id from step 3>"}})

Each email automatically features unique brain insights (stories, data points, recommendations).
The position's thesis and voice markers shape the email tone.

**Extract from response:**
- emailSequence.emails — review each for placeholder text like "[INSERT TIP]" or "[YOUR NAME]"

If placeholders found:
→ magnetlab_execute({tool: "magnetlab_update_email_sequence", arguments: {
     lead_magnet_id: "...",
     emails: [... fixed emails ...]
   }})

Then activate:
→ magnetlab_execute({tool: "magnetlab_activate_email_sequence", arguments: {lead_magnet_id: "..."}})
Activation FAILS if placeholders remain. Fix them first.

### 6. REVIEW & PUBLISH
→ magnetlab_execute({tool: "magnetlab_publish_funnel", arguments: {funnel_id: "<id from step 3>"}})

**Extract from response:**
- publicUrl — the live URL for the funnel (e.g., magnetlab.app/p/username/slug)
- warning — if email sequence is not active, a warning is included

## Rules
- A lead magnet without a funnel is NOT publicly accessible
- A lead magnet without content is an empty shell — always generate content (step 4)
- Never fabricate social proof — use real data from the brain or set to null
- Email sequences must be explicitly activated — publishing does NOT auto-activate
- The lead magnet should use the user's actual language from the AI Brain
- Steps 4 and 5 can run back-to-back — content gen must finish first since the email
  sequence uses the generated content`,

  write_linkedin_post: `# Writing a LinkedIn Post — Workflow

## Steps

1. RESEARCH — Pull relevant knowledge
   → magnetlab_execute({tool: "magnetlab_search_knowledge", arguments: {query: "<topic>"}})
   → magnetlab_execute({tool: "magnetlab_ask_knowledge", arguments: {question: "..."}})

1b. SYNTHESIZE — Get the user's structured position on the topic
   → magnetlab_execute({tool: "magnetlab_synthesize_position", arguments: {topic: "<topic-slug>"}})
   Use this to ground the post in their actual thesis, stories, data points, and voice markers.

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

1. Ensure a lead magnet, library, or external resource exists

2. CREATE FUNNEL — provide a slug and target
   → magnetlab_execute({tool: "magnetlab_create_funnel", arguments: {
       lead_magnet_id: "...",
       slug: "my-guide",
       optin_headline: "...",
       optin_subline: "...",
       optin_social_proof: null
     }})
   Defaults: headline=target title, button="Get Free Access", theme=dark, color=#8b5cf6

3. CUSTOMIZE — Edit sections, apply theme/restyle
   → magnetlab_execute({tool: "magnetlab_restyle_funnel", arguments: {funnel_id: "...", prompt: "..."}})
   → magnetlab_execute({tool: "magnetlab_apply_restyle", arguments: {funnel_id: "...", plan: {...}}})

4. QUALIFICATION (optional)
   → magnetlab_execute({tool: "magnetlab_create_qualification_form", arguments: {funnel_page_id: "...", questions: [...]}})

5. EMAIL SEQUENCE (optional but recommended)
   → magnetlab_execute({tool: "magnetlab_generate_email_sequence", arguments: {lead_magnet_id: "..."}})
   → Review emails for placeholder text like "[INSERT TIP]" — replace via magnetlab_update_email_sequence
   → magnetlab_execute({tool: "magnetlab_activate_email_sequence", arguments: {lead_magnet_id: "..."}})
   State machine: generate → draft, activate → active. Only "active" sequences send emails.
   Activation FAILS if emails contain template placeholders — fix them first.

6. PUBLISH
   → magnetlab_execute({tool: "magnetlab_publish_funnel", arguments: {funnel_id: "..."}})
   WARNING: Publishing does NOT activate the email sequence. Do step 5 first.

## Key rules
- Never fabricate social proof — omit it or use real data
- Use magnetlab_generate_funnel_content to AI-generate copy from lead magnet content
- Email sequences must be activated BEFORE publishing — publish does not auto-activate
- Use magnetlab_restyle_funnel for AI-powered visual design`,

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
};

/**
 * Maps category tool names back to their discovery category key.
 */
export const categoryToolToKey = new Map<string, DiscoveryCategoryKey>(
  Object.keys(categoryDescriptions).map((key) => [
    `magnetlab_${key.replace(/([A-Z])/g, '_$1').toLowerCase()}`,
    key as DiscoveryCategoryKey,
  ])
);

/**
 * Get human-readable label for a category.
 */
export function getCategoryLabel(key: DiscoveryCategoryKey): string {
  return categoryDescriptions[key].label;
}

/**
 * Get the count of real tools in a discovery category.
 */
export function getCategoryToolCount(key: DiscoveryCategoryKey): number {
  return discoveryCategories[key].length;
}
