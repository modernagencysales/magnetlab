import { describe, it, expect } from 'vitest'
import { tools, toolsByName, toolCategories } from '../tools/index.js'

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

  it('every tool name is in exactly one category', () => {
    const allCategorized = Object.values(toolCategories).flat()
    const categorizedSet = new Set(allCategorized)

    // No duplicates across categories
    expect(categorizedSet.size).toBe(allCategorized.length)

    // Every tool is categorized
    for (const tool of tools) {
      expect(categorizedSet.has(tool.name), `${tool.name} not in any category`).toBe(true)
    }

    // Every categorized name is a real tool
    for (const name of allCategorized) {
      expect(toolsByName.has(name), `category references unknown tool: ${name}`).toBe(true)
    }
  })

  describe('category sizes', () => {
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
