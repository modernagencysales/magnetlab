/** Schema handler. Serves static archetype data + dispatches business context to client. Self-contained — no main app imports. */

import type { MagnetLabClient } from '../client.js';
import type { Archetype } from '../constants.js';
import { ARCHETYPES } from '../constants.js';

// ─── Archetype Definitions (embedded for MCP package isolation) ─────────────

interface ArchetypeInfo {
  archetype: Archetype;
  description: string;
  content_fields: Record<string, FieldSpec>;
  guidelines: string;
}

interface FieldSpec {
  type: string;
  required: boolean;
  description: string;
  min_length?: number;
  min_items?: number;
  nested_fields?: Record<string, FieldSpec>;
}

// ─── Shared base fields present on every archetype ──────────────────────────

const BASE_FIELDS: Record<string, FieldSpec> = {
  headline: {
    type: 'string',
    required: true,
    description: 'Main headline — name the pain or outcome, not your product',
    min_length: 10,
  },
  subheadline: { type: 'string', required: false, description: 'Optional supporting subheadline' },
  problem_statement: {
    type: 'string',
    required: true,
    description: '2-3 sentences making the reader feel understood',
    min_length: 20,
  },
  proof_points: {
    type: 'string[]',
    required: false,
    description: 'Quantified proof — "Used by 500 agencies" over "Trusted by many"',
  },
  call_to_action: {
    type: 'string',
    required: true,
    description: 'Clear next step for the reader after consuming the content',
    min_length: 5,
  },
};

// ─── Per-archetype registry ─────────────────────────────────────────────────

const ARCHETYPE_REGISTRY: Record<Archetype, ArchetypeInfo> = {
  'single-breakdown': {
    archetype: 'single-breakdown',
    description: 'Deconstruct one process, framework, or system into clear, actionable steps.',
    content_fields: {
      ...BASE_FIELDS,
      sections: {
        type: 'object[]',
        required: true,
        description: 'Sequential steps — each builds on the previous',
        min_items: 3,
        nested_fields: {
          title: {
            type: 'string',
            required: true,
            description: 'Action-oriented step title',
            min_length: 3,
          },
          body: {
            type: 'string',
            required: true,
            description: 'What, why, and how — include a specific example',
            min_length: 50,
          },
          key_insight: {
            type: 'string',
            required: false,
            description: 'The non-obvious "aha" moment the reader would miss on their own',
          },
        },
      },
    },
    guidelines: `Structure: headline → problem_statement → 3+ sequential sections → proof_points → call_to_action.
Quality: Each section builds on the previous. Specific numbers and examples. Reader can take action immediately. Personal experience woven in.
Avoid: Sections that describe but don't instruct. Generic advice. Skipping the "why". Front-loading credentials.`,
  },

  'single-system': {
    archetype: 'single-system',
    description:
      'Present an interconnected system of named components that work together to produce a result.',
    content_fields: {
      ...BASE_FIELDS,
      sections: {
        type: 'object[]',
        required: true,
        description: 'System components — emphasize connections between them',
        min_items: 3,
        nested_fields: {
          title: { type: 'string', required: true, description: 'Section title', min_length: 3 },
          body: {
            type: 'string',
            required: true,
            description: 'What this component does, how to build it, why it matters',
            min_length: 50,
          },
          key_insight: {
            type: 'string',
            required: false,
            description: 'The design decision that makes this component work',
          },
          component_name: {
            type: 'string',
            required: true,
            description: 'Memorable, specific name (not "Step 1")',
            min_length: 2,
          },
          how_it_connects: {
            type: 'string',
            required: true,
            description: 'What this component feeds into or receives from',
            min_length: 10,
          },
        },
      },
    },
    guidelines: `Structure: headline → problem_statement → 3+ named components with explicit connections → call_to_action.
Quality: Each component has a named role. Connections are explicit. Removing any component breaks the system. Real examples with results.
Avoid: Listing without connecting. Vague names like "Part A". No end-to-end example. Over-engineering (8+ components).`,
  },

  'focused-toolkit': {
    archetype: 'focused-toolkit',
    description:
      'A curated collection of tools, templates, or resources designed for one specific job.',
    content_fields: {
      ...BASE_FIELDS,
      tools: {
        type: 'object[]',
        required: true,
        description: 'Curated tools — each solves a different part of the same problem',
        min_items: 3,
        nested_fields: {
          name: {
            type: 'string',
            required: true,
            description: 'Clear, descriptive tool name',
            min_length: 2,
          },
          description: {
            type: 'string',
            required: true,
            description: 'What it is, what it contains, how to use it',
            min_length: 20,
          },
          use_case: {
            type: 'string',
            required: true,
            description: 'Specific scenario or trigger for when to use this tool',
            min_length: 10,
          },
        },
      },
    },
    guidelines: `Structure: headline → problem_statement → 3+ tools with use cases → call_to_action.
Quality: No overlap between tools. Use cases are specific situations. Each tool is immediately usable. Collection covers the complete workflow.
Avoid: Redundant tools. Tools requiring heavy customization. Missing "when to use" context. Padding with mediocre entries.`,
  },

  'single-calculator': {
    archetype: 'single-calculator',
    description:
      'An interactive calculator that helps the reader quantify a business metric they care about.',
    content_fields: {
      ...BASE_FIELDS,
      inputs: {
        type: 'object[]',
        required: true,
        description: 'Calculator input variables the reader provides',
        min_items: 1,
        nested_fields: {
          label: {
            type: 'string',
            required: true,
            description: 'Plain English label — "Monthly website visitors" not "MAU"',
            min_length: 3,
          },
          type: {
            type: 'string',
            required: true,
            description: 'Input type: number, select, or slider',
            min_length: 2,
          },
          placeholder: {
            type: 'string',
            required: false,
            description: 'Realistic example value showing expected scale',
          },
        },
      },
      formula_description: {
        type: 'string',
        required: true,
        description: 'Plain English explanation of the calculation logic',
        min_length: 20,
      },
      output_format: {
        type: 'string',
        required: true,
        description: 'What the result looks like and what it means — include interpretation',
        min_length: 10,
      },
    },
    guidelines: `Structure: headline → problem_statement → 1+ inputs → formula_description → output_format → call_to_action.
Quality: Inputs are data the reader knows. Formula grounded in real benchmarks. Output creates urgency. Result leads to next conversation.
Avoid: Inputs reader doesn't know. Black-box formulas. Results without context. Too many inputs (aim 3-5). No connection to your offer.`,
  },

  'focused-directory': {
    archetype: 'focused-directory',
    description:
      'A curated, categorized directory of vetted resources that saves the reader hours of research.',
    content_fields: {
      ...BASE_FIELDS,
      resources: {
        type: 'object[]',
        required: true,
        description: 'Vetted resource entries — each personally used or thoroughly reviewed',
        min_items: 5,
        nested_fields: {
          name: { type: 'string', required: true, description: 'Resource name', min_length: 2 },
          url: {
            type: 'string',
            required: true,
            description: 'Direct link (not affiliate-only landing page)',
          },
          description: {
            type: 'string',
            required: true,
            description: 'Your honest opinion — not marketing copy',
            min_length: 15,
          },
          category: {
            type: 'string',
            required: true,
            description: 'Logical grouping matching reader workflow',
            min_length: 2,
          },
        },
      },
    },
    guidelines: `Structure: headline → problem_statement → 5+ categorized resources → call_to_action.
Quality: Every resource personally vetted. Categories match reader workflow. Honest descriptions. All links current.
Avoid: Listing every tool you've heard of. Copy-pasting website descriptions. No categorization. Missing pricing/limitations context.`,
  },

  'mini-training': {
    archetype: 'mini-training',
    description:
      'A short multi-lesson course that teaches the reader one specific skill through guided exercises.',
    content_fields: {
      ...BASE_FIELDS,
      lessons: {
        type: 'object[]',
        required: true,
        description: 'Self-contained learning units building on each other',
        min_items: 2,
        nested_fields: {
          title: {
            type: 'string',
            required: true,
            description: 'Clear lesson name — "Day 1: Your Content Positioning"',
            min_length: 3,
          },
          objective: {
            type: 'string',
            required: true,
            description: 'One sentence — what the reader can DO after this lesson',
            min_length: 10,
          },
          content: {
            type: 'string',
            required: true,
            description: 'Teaching material — concepts, frameworks, examples',
            min_length: 50,
          },
          exercise: {
            type: 'string',
            required: true,
            description: 'Specific, completable task producing a tangible output',
            min_length: 10,
          },
        },
      },
    },
    guidelines: `Structure: headline → problem_statement → 2+ lessons with exercises → call_to_action.
Quality: Each lesson teaches ONE thing. Exercises produce tangible output. Lessons build on each other. Under 1 hour total.
Avoid: All theory, no practice. Vague exercises. Too many lessons (max 5). No progressive skill building.`,
  },

  'one-story': {
    archetype: 'one-story',
    description:
      'A single compelling narrative that teaches a lesson through personal or client experience.',
    content_fields: {
      ...BASE_FIELDS,
      story_hook: {
        type: 'string',
        required: true,
        description: 'Opening line pulling reader in — start in the action',
        min_length: 20,
      },
      narrative: {
        type: 'string',
        required: true,
        description: 'Full story: situation → turning point → result → messy parts',
        min_length: 200,
      },
      lesson: {
        type: 'string',
        required: true,
        description: 'The principle or framework extracted from the story',
        min_length: 20,
      },
      takeaway: {
        type: 'string',
        required: true,
        description: 'One specific action the reader can take today',
        min_length: 20,
      },
    },
    guidelines: `Structure: headline → problem_statement → story_hook → narrative → lesson → takeaway → call_to_action.
Quality: Genuine emotional stakes. Specific details (dates, numbers, dialogue). Non-obvious lesson. Shows vulnerability.
Avoid: Starting with backstory. Sanitizing the messy parts. Forced lesson connection. No specific outcomes. Making it about you not the reader.`,
  },

  prompt: {
    archetype: 'prompt',
    description:
      'A collection of ready-to-use prompts (for AI tools, self-reflection, or action) that solve a recurring problem.',
    content_fields: {
      ...BASE_FIELDS,
      prompts: {
        type: 'object[]',
        required: true,
        description: 'Copy-paste-ready prompts with placeholders in [brackets]',
        min_items: 3,
        nested_fields: {
          title: {
            type: 'string',
            required: true,
            description: 'Memorable name hinting at outcome — "The Authority Builder"',
            min_length: 3,
          },
          prompt_text: {
            type: 'string',
            required: true,
            description: 'Complete, copy-paste-ready prompt with [bracket] placeholders',
            min_length: 20,
          },
          example_output: {
            type: 'string',
            required: true,
            description: 'Realistic sample proving the prompt works',
            min_length: 10,
          },
          when_to_use: {
            type: 'string',
            required: true,
            description: 'Specific situation or trigger for this prompt',
            min_length: 10,
          },
        },
      },
    },
    guidelines: `Structure: headline → problem_statement → 3+ prompts with examples → call_to_action.
Quality: Copy-paste ready. Clear [bracket] placeholders. Realistic example outputs. Specific when-to-use triggers. Prompts complement each other.
Avoid: Vague prompts. Missing examples. No usage context. Tool-specific without saying so. Overlapping prompts.`,
  },

  assessment: {
    archetype: 'assessment',
    description:
      'A scored self-assessment with personalized results that helps the reader diagnose where they stand.',
    content_fields: {
      ...BASE_FIELDS,
      questions: {
        type: 'object[]',
        required: true,
        description: 'Assessment questions revealing blind spots',
        min_items: 5,
        nested_fields: {
          question: {
            type: 'string',
            required: true,
            description: 'Clear, specific, answerable without research',
            min_length: 10,
          },
          options: {
            type: 'string[]',
            required: true,
            description: '2-4 options in ascending sophistication/maturity order',
          },
        },
      },
      scoring_rubric: {
        type: 'string',
        required: true,
        description: 'Plain English explanation of how answers map to scores',
        min_length: 20,
      },
      result_ranges: {
        type: 'object[]',
        required: true,
        description: 'Score brackets — every possible score maps to exactly one result',
        min_items: 1,
        nested_fields: {
          min: { type: 'number', required: true, description: 'Minimum score for this range' },
          max: { type: 'number', required: true, description: 'Maximum score for this range' },
          label: {
            type: 'string',
            required: true,
            description: 'Memorable name — "LinkedIn Ghost", "LinkedIn Pro"',
            min_length: 2,
          },
          description: {
            type: 'string',
            required: true,
            description: 'What this score means and what to focus on next',
            min_length: 20,
          },
        },
      },
    },
    guidelines: `Structure: headline → problem_statement → 5+ questions → scoring_rubric → result_ranges → call_to_action.
Quality: Questions reveal blind spots. Options clearly ordered. Honest result descriptions. Lowest result motivating, not demoralizing.
Avoid: Subjective questions. Binary yes/no only. All results say "you're doing okay". Hidden scoring. Too many questions (5-10 max). Overlapping ranges.`,
  },

  workflow: {
    archetype: 'workflow',
    description:
      'A step-by-step repeatable workflow with triggers, actions, tools, and outputs the reader can copy.',
    content_fields: {
      ...BASE_FIELDS,
      steps: {
        type: 'object[]',
        required: true,
        description: 'Operational steps — when to do what, with which tool',
        min_items: 3,
        nested_fields: {
          trigger: {
            type: 'string',
            required: true,
            description: 'When this step happens — "Monday morning", "After every client call"',
            min_length: 3,
          },
          action: {
            type: 'string',
            required: true,
            description: 'Specific, concrete action to take',
            min_length: 10,
          },
          tool: {
            type: 'string',
            required: true,
            description: 'Named tool or platform — "Notion" not "a note app"',
            min_length: 2,
          },
          output: {
            type: 'string',
            required: true,
            description: 'Tangible deliverable — "3 polished posts" not "some content"',
            min_length: 5,
          },
        },
      },
    },
    guidelines: `Structure: headline → problem_statement → 3+ steps with triggers/tools/outputs → call_to_action.
Quality: Every step has a clear trigger. Tools named specifically. Outputs tangible and measurable. Fits realistic schedule. Steps connect.
Avoid: Vague timing ("regularly"). Missing the tool. No outputs. Steps requiring 4+ hours each. No compounding over time.`,
  },
};

// ─── Handler ────────────────────────────────────────────────────────────────

export async function handleSchemaTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_list_archetypes':
      return {
        archetypes: ARCHETYPES.map((a) => ({
          archetype: a,
          description: ARCHETYPE_REGISTRY[a].description,
        })),
      };

    case 'magnetlab_get_archetype_schema': {
      const archetype = args.archetype as Archetype;
      const info = ARCHETYPE_REGISTRY[archetype];
      if (!info) throw new Error(`Unknown archetype: ${archetype}`);
      return {
        archetype: info.archetype,
        description: info.description,
        content_fields: info.content_fields,
        guidelines: info.guidelines,
      };
    }

    case 'magnetlab_get_business_context':
      return client.getBusinessContext(args.team_id as string | undefined);

    default:
      throw new Error(`Unknown schema tool: ${name}`);
  }
}
