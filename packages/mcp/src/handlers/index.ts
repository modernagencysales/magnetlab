import { MagnetLabClient } from '../client.js'
import { handleLeadMagnetTools } from './lead-magnets.js'
import { handleIdeationTools } from './ideation.js'
import { handleFunnelTools } from './funnels.js'
import { handleLeadTools } from './leads.js'
import { handleAnalyticsTools } from './analytics.js'
import { handleBrandKitTools } from './brand-kit.js'
import { handleEmailSequenceTools } from './email-sequences.js'
import { handleContentPipelineTools } from './content-pipeline.js'
import { handleSwipeFileTools } from './swipe-file.js'
import { handleLibraryTools } from './libraries.js'
import { handleQualificationFormTools } from './qualification-forms.js'
import { handleEmailSystemTools } from './email-system.js'
import { toolCategories } from '../tools/index.js'
import { validateToolArgs } from '../validation.js'

export type ToolResult = {
  content: Array<{ type: 'text'; text: string }>
}

// 800KB safety limit — well under the 1MB MCP tool response cap
const MAX_RESPONSE_BYTES = 800_000

/**
 * If the serialized result exceeds MAX_RESPONSE_BYTES, find the first array
 * property and truncate it to fit, appending pagination metadata.
 */
function truncateIfNeeded(result: unknown): unknown {
  const json = JSON.stringify(result)
  if (json.length <= MAX_RESPONSE_BYTES) return result

  if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>
    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 1) {
        const arr = obj[key] as unknown[]
        // Binary search for max items that fit under the size limit
        let lo = 1
        let hi = arr.length
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2)
          const test = { ...obj, [key]: arr.slice(0, mid), _truncated: true, _total: arr.length }
          if (JSON.stringify(test).length <= MAX_RESPONSE_BYTES) lo = mid
          else hi = mid - 1
        }
        return {
          ...obj,
          [key]: arr.slice(0, lo),
          _truncated: true,
          _total: arr.length,
          _returned: lo,
          _hint: 'Use limit and offset parameters to paginate through results',
        }
      }
    }
  }
  return result
}

/**
 * Main dispatcher for MCP tool calls.
 * Routes tool calls to the appropriate category handler based on tool name.
 * Validates required arguments before dispatching to handlers.
 */
export async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<ToolResult> {
  try {
    // Validate args before calling handler
    const validation = validateToolArgs(name, args)
    if (!validation.success) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: validation.error }),
          },
        ],
      }
    }

    let result: unknown

    // Route to appropriate handler based on tool category
    if (toolCategories.leadMagnets.includes(name)) {
      result = await handleLeadMagnetTools(name, args, client)
    } else if (toolCategories.ideation.includes(name)) {
      result = await handleIdeationTools(name, args, client)
    } else if (toolCategories.funnels.includes(name)) {
      result = await handleFunnelTools(name, args, client)
    } else if (toolCategories.leads.includes(name)) {
      result = await handleLeadTools(name, args, client)
    } else if (toolCategories.analytics.includes(name)) {
      result = await handleAnalyticsTools(name, args, client)
    } else if (toolCategories.brandKit.includes(name)) {
      result = await handleBrandKitTools(name, args, client)
    } else if (toolCategories.emailSequences.includes(name)) {
      result = await handleEmailSequenceTools(name, args, client)
    } else if (toolCategories.contentPipeline.includes(name)) {
      result = await handleContentPipelineTools(name, args, client)
    } else if (toolCategories.swipeFile.includes(name)) {
      result = await handleSwipeFileTools(name, args, client)
    } else if (toolCategories.libraries.includes(name)) {
      result = await handleLibraryTools(name, args, client)
    } else if (toolCategories.qualificationForms.includes(name)) {
      result = await handleQualificationFormTools(name, args, client)
    } else if (toolCategories.emailSystem.includes(name)) {
      result = await handleEmailSystemTools(name, args, client)
    } else {
      throw new Error(`Unknown tool: ${name}`)
    }

    // Truncate if response exceeds size limit, then use compact JSON
    const safeResult = truncateIfNeeded(result)

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(safeResult),
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        },
      ],
    }
  }
}

// Re-export individual handlers for testing
export { handleLeadMagnetTools } from './lead-magnets.js'
export { handleIdeationTools } from './ideation.js'
export { handleFunnelTools } from './funnels.js'
export { handleLeadTools } from './leads.js'
export { handleAnalyticsTools } from './analytics.js'
export { handleBrandKitTools } from './brand-kit.js'
export { handleEmailSequenceTools } from './email-sequences.js'
export { handleContentPipelineTools } from './content-pipeline.js'
export { handleSwipeFileTools } from './swipe-file.js'
export { handleLibraryTools } from './libraries.js'
export { handleQualificationFormTools } from './qualification-forms.js'
export { handleEmailSystemTools } from './email-system.js'
