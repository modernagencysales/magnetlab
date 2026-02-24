import { describe, it, expect } from 'vitest'
import { tools, toolsByName, toolCategories, discoveryCategories } from '../tools/index.js'
import {
  categoryTools,
  executeGatewayTool,
  toolHelpTool,
  categoryToolToKey,
  getCategoryLabel,
  getCategoryToolCount,
  DiscoveryCategoryKey,
} from '../tools/category-tools.js'

describe('Tool Registration', () => {
  it('exports exactly 106 tools', () => {
    expect(tools).toHaveLength(106)
  })

  it('all tools have unique names', () => {
    const names = tools.map((t) => t.name)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })

  it('all tools have descriptions', () => {
    for (const tool of tools) {
      expect(tool.description, `${tool.name} missing description`).toBeTruthy()
      expect(tool.description!.length, `${tool.name} description too short`).toBeGreaterThan(10)
    }
  })

  it('all tools have valid inputSchema with type "object"', () => {
    for (const tool of tools) {
      expect(tool.inputSchema, `${tool.name} missing inputSchema`).toBeDefined()
      expect(tool.inputSchema.type, `${tool.name} inputSchema.type should be "object"`).toBe(
        'object'
      )
    }
  })

  it('all tool names start with "magnetlab_"', () => {
    for (const tool of tools) {
      expect(tool.name, `${tool.name} should start with magnetlab_`).toMatch(/^magnetlab_/)
    }
  })

  it('toolsByName map contains all tools', () => {
    expect(toolsByName.size).toBe(tools.length)
    for (const tool of tools) {
      expect(toolsByName.has(tool.name), `toolsByName missing ${tool.name}`).toBe(true)
      expect(toolsByName.get(tool.name)).toBe(tool)
    }
  })

  it('every tool name is in exactly one handler category', () => {
    const allCategorized = Object.values(toolCategories).flat()
    const categorizedSet = new Set(allCategorized)

    expect(categorizedSet.size).toBe(allCategorized.length)

    for (const tool of tools) {
      expect(categorizedSet.has(tool.name), `${tool.name} not in any handler category`).toBe(true)
    }

    for (const name of allCategorized) {
      expect(toolsByName.has(name), `handler category references unknown tool: ${name}`).toBe(true)
    }
  })

  describe('handler category sizes', () => {
    const expectedCounts: Record<string, number> = {
      leadMagnets: 7,
      ideation: 6,
      funnels: 9,
      leads: 2,
      analytics: 1,
      brandKit: 3,
      emailSequences: 4,
      contentPipeline: 44,
      swipeFile: 3,
      libraries: 7,
      qualificationForms: 5,
      emailSystem: 15,
    }

    for (const [category, expected] of Object.entries(expectedCounts)) {
      it(`${category} has ${expected} tools`, () => {
        const actual = (toolCategories as Record<string, string[]>)[category]
        expect(actual, `category ${category} not found`).toBeDefined()
        expect(actual.length).toBe(expected)
      })
    }
  })

  describe('required fields in inputSchema', () => {
    it('tools with required fields list them as arrays', () => {
      for (const tool of tools) {
        const schema = tool.inputSchema as { required?: unknown }
        if (schema.required !== undefined) {
          expect(
            Array.isArray(schema.required),
            `${tool.name} required should be an array`
          ).toBe(true)
        }
      }
    })

    it('required fields reference defined properties', () => {
      for (const tool of tools) {
        const schema = tool.inputSchema as {
          properties?: Record<string, unknown>
          required?: string[]
        }
        if (schema.required && schema.properties) {
          for (const req of schema.required) {
            expect(
              req in schema.properties,
              `${tool.name}: required field "${req}" not in properties`
            ).toBe(true)
          }
        }
      }
    })
  })
})

describe('Discovery Categories', () => {
  it('every tool in discovery categories is a real tool', () => {
    for (const [cat, names] of Object.entries(discoveryCategories)) {
      for (const name of names) {
        expect(toolsByName.has(name), `${cat} references unknown tool: ${name}`).toBe(true)
      }
    }
  })

  it('every real tool appears in at least one discovery category', () => {
    const allDiscovered = new Set(Object.values(discoveryCategories).flat())
    for (const tool of tools) {
      expect(allDiscovered.has(tool.name), `${tool.name} not in any discovery category`).toBe(true)
    }
  })

  it('content pipeline is split into knowledge, writing, and scheduling', () => {
    expect(discoveryCategories.knowledge.length).toBe(14)
    expect(discoveryCategories.contentWriting.length).toBe(19)
    expect(discoveryCategories.contentScheduling.length).toBe(11)

    // Total should equal original 44
    const total =
      discoveryCategories.knowledge.length +
      discoveryCategories.contentWriting.length +
      discoveryCategories.contentScheduling.length
    expect(total).toBe(44)
  })

  it('leadMagnets discovery includes leads and analytics tools', () => {
    expect(discoveryCategories.leadMagnets).toContain('magnetlab_list_leads')
    expect(discoveryCategories.leadMagnets).toContain('magnetlab_export_leads')
    expect(discoveryCategories.leadMagnets).toContain('magnetlab_get_funnel_stats')
    // Original 7 lead magnet tools + 2 leads + 1 analytics = 10
    expect(discoveryCategories.leadMagnets.length).toBe(10)
  })

  describe('discovery category sizes', () => {
    const expectedCounts: Record<string, number> = {
      knowledge: 14,
      contentWriting: 19,
      contentScheduling: 11,
      leadMagnets: 10,
      ideation: 6,
      funnels: 9,
      brandKit: 3,
      emailSequences: 4,
      emailSystem: 15,
      swipeFile: 3,
      libraries: 7,
      qualificationForms: 5,
    }

    for (const [category, expected] of Object.entries(expectedCounts)) {
      it(`${category} has ${expected} tools`, () => {
        const actual = (discoveryCategories as Record<string, string[]>)[category]
        expect(actual, `discovery category ${category} not found`).toBeDefined()
        expect(actual.length).toBe(expected)
      })
    }
  })
})

describe('Category Discovery Tools', () => {
  it('creates exactly 12 category tools (11 categories after merging)', () => {
    // 11 discovery categories + not 12 — leads & analytics merged into leadMagnets
    expect(categoryTools).toHaveLength(Object.keys(discoveryCategories).length)
  })

  it('all category tools have unique names', () => {
    const names = categoryTools.map((t) => t.name)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })

  it('all category tool names start with "magnetlab_"', () => {
    for (const tool of categoryTools) {
      expect(tool.name).toMatch(/^magnetlab_/)
    }
  })

  it('all category tools have descriptions', () => {
    for (const tool of categoryTools) {
      expect(tool.description).toBeTruthy()
      expect(tool.description!.length).toBeGreaterThan(10)
    }
  })

  it('category tool names do not collide with real tool names', () => {
    const realNames = new Set(tools.map((t) => t.name))
    for (const tool of categoryTools) {
      expect(realNames.has(tool.name), `${tool.name} collides with a real tool`).toBe(false)
    }
  })

  it('categoryToolToKey maps every category tool to a valid discovery category', () => {
    const categoryKeys = new Set(Object.keys(discoveryCategories))
    for (const tool of categoryTools) {
      const key = categoryToolToKey.get(tool.name)
      expect(key, `${tool.name} not in categoryToolToKey`).toBeDefined()
      expect(categoryKeys.has(key!), `${tool.name} maps to unknown category: ${key}`).toBe(true)
    }
  })

  it('every discovery category has a category tool', () => {
    const mappedCategories = new Set(categoryToolToKey.values())
    for (const key of Object.keys(discoveryCategories)) {
      expect(
        mappedCategories.has(key as DiscoveryCategoryKey),
        `discovery category ${key} has no category tool`
      ).toBe(true)
    }
  })

  it('getCategoryLabel returns non-empty labels', () => {
    for (const key of Object.keys(discoveryCategories)) {
      const label = getCategoryLabel(key as DiscoveryCategoryKey)
      expect(label).toBeTruthy()
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('getCategoryToolCount matches actual category sizes', () => {
    for (const [key, names] of Object.entries(discoveryCategories)) {
      expect(getCategoryToolCount(key as DiscoveryCategoryKey)).toBe(names.length)
    }
  })
})

describe('Execute Gateway Tool', () => {
  it('has the correct name', () => {
    expect(executeGatewayTool.name).toBe('magnetlab_execute')
  })

  it('requires the "tool" parameter', () => {
    const schema = executeGatewayTool.inputSchema as { required?: string[] }
    expect(schema.required).toContain('tool')
  })

  it('has "tool" and "arguments" properties', () => {
    const schema = executeGatewayTool.inputSchema as { properties?: Record<string, unknown> }
    expect(schema.properties).toHaveProperty('tool')
    expect(schema.properties).toHaveProperty('arguments')
  })

  it('does not collide with any real or category tool name', () => {
    expect(toolsByName.has('magnetlab_execute')).toBe(false)
    const categoryNames = new Set(categoryTools.map((t) => t.name))
    expect(categoryNames.has('magnetlab_execute')).toBe(false)
  })
})

describe('Tool Help Tool', () => {
  it('has the correct name', () => {
    expect(toolHelpTool.name).toBe('magnetlab_tool_help')
  })

  it('requires the "tool" parameter', () => {
    const schema = toolHelpTool.inputSchema as { required?: string[] }
    expect(schema.required).toContain('tool')
  })

  it('does not collide with any real or category tool name', () => {
    expect(toolsByName.has('magnetlab_tool_help')).toBe(false)
    const categoryNames = new Set(categoryTools.map((t) => t.name))
    expect(categoryNames.has('magnetlab_tool_help')).toBe(false)
  })
})
