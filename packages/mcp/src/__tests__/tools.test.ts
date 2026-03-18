/** Tool registration tests for MCP v2. Verifies 43 tools, naming, schemas, and no old tools. */

import { describe, it, expect } from 'vitest';
import { tools, toolsByName } from '../tools/index.js';

// ─── All 43 expected tool names ────────────────────────────────────────────────

const EXPECTED_TOOL_NAMES = [
  // Lead Magnets (5)
  'magnetlab_list_lead_magnets',
  'magnetlab_get_lead_magnet',
  'magnetlab_create_lead_magnet',
  'magnetlab_update_lead_magnet',
  'magnetlab_delete_lead_magnet',
  // Funnels (7)
  'magnetlab_list_funnels',
  'magnetlab_get_funnel',
  'magnetlab_create_funnel',
  'magnetlab_update_funnel',
  'magnetlab_delete_funnel',
  'magnetlab_publish_funnel',
  'magnetlab_unpublish_funnel',
  // Knowledge (5)
  'magnetlab_search_knowledge',
  'magnetlab_browse_knowledge',
  'magnetlab_get_knowledge_clusters',
  'magnetlab_ask_knowledge',
  'magnetlab_submit_transcript',
  // Posts (6)
  'magnetlab_list_posts',
  'magnetlab_get_post',
  'magnetlab_create_post',
  'magnetlab_update_post',
  'magnetlab_delete_post',
  'magnetlab_publish_post',
  // Email Sequences (3)
  'magnetlab_get_email_sequence',
  'magnetlab_save_email_sequence',
  'magnetlab_activate_email_sequence',
  // Leads (3)
  'magnetlab_list_leads',
  'magnetlab_get_lead',
  'magnetlab_export_leads',
  // Schema / Introspection (3)
  'magnetlab_list_archetypes',
  'magnetlab_get_archetype_schema',
  'magnetlab_get_business_context',
  // Compound Actions (2)
  'magnetlab_launch_lead_magnet',
  'magnetlab_schedule_content_week',
  // Feedback / Analytics (2)
  'magnetlab_get_performance_insights',
  'magnetlab_get_recommendations',
  // Account (1)
  'magnetlab_list_teams',
  // Content Queue (6)
  'magnetlab_list_content_queue',
  'magnetlab_update_queue_post',
  'magnetlab_submit_queue_batch',
  'magnetlab_review_lead_magnet',
  'magnetlab_review_funnel',
  'magnetlab_submit_asset_review',
] as const;

// ─── Old tools that must NOT exist ────────────────────────────────────────────

const REMOVED_TOOLS = [
  'magnetlab_execute',
  'magnetlab_tool_help',
  'magnetlab_guide',
  'magnetlab_content_writing',
  'magnetlab_content_scheduling',
  'magnetlab_ideation',
  'magnetlab_brand_kit',
  'magnetlab_email_system',
  'magnetlab_email_sequences',
  'magnetlab_funnels',
  'magnetlab_lead_magnets',
  'magnetlab_libraries',
  'magnetlab_qualification_forms',
  'magnetlab_swipe_file',
  'magnetlab_knowledge',
];

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('Tool Registration', () => {
  it('exports exactly 43 tools', () => {
    expect(tools).toHaveLength(43);
  });

  it('all tools have unique names', () => {
    const names = tools.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('all tools have descriptions', () => {
    for (const tool of tools) {
      expect(tool.description, `${tool.name} missing description`).toBeTruthy();
      expect(tool.description!.length, `${tool.name} description too short`).toBeGreaterThan(10);
    }
  });

  it('all tools have valid inputSchema with type "object"', () => {
    for (const tool of tools) {
      expect(tool.inputSchema, `${tool.name} missing inputSchema`).toBeDefined();
      expect(tool.inputSchema.type, `${tool.name} inputSchema.type should be "object"`).toBe(
        'object'
      );
    }
  });

  it('all tool names start with "magnetlab_"', () => {
    for (const tool of tools) {
      expect(tool.name, `${tool.name} should start with magnetlab_`).toMatch(/^magnetlab_/);
    }
  });

  it('toolsByName map has 43 entries', () => {
    expect(toolsByName.size).toBe(43);
  });

  it('toolsByName contains all tools and references correct objects', () => {
    for (const tool of tools) {
      expect(toolsByName.has(tool.name), `toolsByName missing ${tool.name}`).toBe(true);
      expect(toolsByName.get(tool.name)).toBe(tool);
    }
  });
});

describe('Expected Tool Names', () => {
  it('every expected tool name is registered', () => {
    for (const name of EXPECTED_TOOL_NAMES) {
      expect(toolsByName.has(name), `missing expected tool: ${name}`).toBe(true);
    }
  });

  it('every registered tool is in the expected list', () => {
    const expectedSet = new Set(EXPECTED_TOOL_NAMES);
    for (const tool of tools) {
      expect(
        expectedSet.has(tool.name as (typeof EXPECTED_TOOL_NAMES)[number]),
        `unexpected tool: ${tool.name}`
      ).toBe(true);
    }
  });

  it('expected list has exactly 43 entries', () => {
    expect(EXPECTED_TOOL_NAMES).toHaveLength(43);
  });
});

describe('No Old/Removed Tools', () => {
  for (const oldTool of REMOVED_TOOLS) {
    it(`${oldTool} is not registered`, () => {
      expect(toolsByName.has(oldTool), `removed tool still present: ${oldTool}`).toBe(false);
    });
  }
});

describe('inputSchema Structure', () => {
  it('tools with required fields list them as arrays', () => {
    for (const tool of tools) {
      const schema = tool.inputSchema as { required?: unknown };
      if (schema.required !== undefined) {
        expect(Array.isArray(schema.required), `${tool.name} required should be an array`).toBe(
          true
        );
      }
    }
  });

  it('required fields reference defined properties', () => {
    for (const tool of tools) {
      const schema = tool.inputSchema as {
        properties?: Record<string, unknown>;
        required?: string[];
      };
      if (schema.required && schema.properties) {
        for (const req of schema.required) {
          expect(
            req in schema.properties,
            `${tool.name}: required field "${req}" not in properties`
          ).toBe(true);
        }
      }
    }
  });

  it('every tool has a properties key in its inputSchema', () => {
    for (const tool of tools) {
      const schema = tool.inputSchema as { properties?: unknown };
      expect(schema.properties, `${tool.name} missing properties in inputSchema`).toBeDefined();
    }
  });
});

describe('Tool Group Sizes', () => {
  // Verify group sizes by counting prefixes in sorted names
  const toolNames = tools.map((t) => t.name);

  it('has 5 lead magnet tools', () => {
    const lmTools = toolNames.filter(
      (n) =>
        n.startsWith('magnetlab_list_lead_magnets') ||
        n.startsWith('magnetlab_get_lead_magnet') ||
        n.startsWith('magnetlab_create_lead_magnet') ||
        n.startsWith('magnetlab_update_lead_magnet') ||
        n.startsWith('magnetlab_delete_lead_magnet')
    );
    expect(lmTools).toHaveLength(5);
  });

  it('has 7 funnel tools', () => {
    const funnelTools = toolNames.filter(
      (n) =>
        n === 'magnetlab_list_funnels' ||
        n === 'magnetlab_get_funnel' ||
        n === 'magnetlab_create_funnel' ||
        n === 'magnetlab_update_funnel' ||
        n === 'magnetlab_delete_funnel' ||
        n === 'magnetlab_publish_funnel' ||
        n === 'magnetlab_unpublish_funnel'
    );
    expect(funnelTools).toHaveLength(7);
  });

  it('has 5 knowledge tools', () => {
    const knowledgeTools = toolNames.filter(
      (n) =>
        n === 'magnetlab_search_knowledge' ||
        n === 'magnetlab_browse_knowledge' ||
        n === 'magnetlab_get_knowledge_clusters' ||
        n === 'magnetlab_ask_knowledge' ||
        n === 'magnetlab_submit_transcript'
    );
    expect(knowledgeTools).toHaveLength(5);
  });

  it('has 6 post tools', () => {
    const postTools = toolNames.filter(
      (n) =>
        n === 'magnetlab_list_posts' ||
        n === 'magnetlab_get_post' ||
        n === 'magnetlab_create_post' ||
        n === 'magnetlab_update_post' ||
        n === 'magnetlab_delete_post' ||
        n === 'magnetlab_publish_post'
    );
    expect(postTools).toHaveLength(6);
  });

  it('has 3 email sequence tools', () => {
    const emailTools = toolNames.filter(
      (n) =>
        n === 'magnetlab_get_email_sequence' ||
        n === 'magnetlab_save_email_sequence' ||
        n === 'magnetlab_activate_email_sequence'
    );
    expect(emailTools).toHaveLength(3);
  });

  it('has 3 lead tools', () => {
    const leadToolNames = toolNames.filter(
      (n) =>
        n === 'magnetlab_list_leads' || n === 'magnetlab_get_lead' || n === 'magnetlab_export_leads'
    );
    expect(leadToolNames).toHaveLength(3);
  });

  it('has 3 schema/introspection tools', () => {
    const schemaTools = toolNames.filter(
      (n) =>
        n === 'magnetlab_list_archetypes' ||
        n === 'magnetlab_get_archetype_schema' ||
        n === 'magnetlab_get_business_context'
    );
    expect(schemaTools).toHaveLength(3);
  });

  it('has 2 compound action tools', () => {
    const compoundTools = toolNames.filter(
      (n) => n === 'magnetlab_launch_lead_magnet' || n === 'magnetlab_schedule_content_week'
    );
    expect(compoundTools).toHaveLength(2);
  });

  it('has 2 feedback/analytics tools', () => {
    const feedbackTools = toolNames.filter(
      (n) => n === 'magnetlab_get_performance_insights' || n === 'magnetlab_get_recommendations'
    );
    expect(feedbackTools).toHaveLength(2);
  });

  it('has 1 account tool', () => {
    const accountTools = toolNames.filter((n) => n === 'magnetlab_list_teams');
    expect(accountTools).toHaveLength(1);
  });

  it('has 6 content queue tools', () => {
    const queueTools = toolNames.filter(
      (n) =>
        n === 'magnetlab_list_content_queue' ||
        n === 'magnetlab_update_queue_post' ||
        n === 'magnetlab_submit_queue_batch' ||
        n === 'magnetlab_review_lead_magnet' ||
        n === 'magnetlab_review_funnel' ||
        n === 'magnetlab_submit_asset_review'
    );
    expect(queueTools).toHaveLength(6);
  });
});
