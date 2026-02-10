import { Tool } from '@modelcontextprotocol/sdk/types.js'
import { leadMagnetTools } from './lead-magnets.js'
import { ideationTools } from './ideation.js'
import { funnelTools } from './funnels.js'
import { leadTools } from './leads.js'
import { analyticsTools } from './analytics.js'
import { brandKitTools } from './brand-kit.js'
import { emailSequenceTools } from './email-sequences.js'
import { contentPipelineTools } from './content-pipeline.js'
import { swipeFileTools } from './swipe-file.js'
import { libraryTools } from './libraries.js'
import { qualificationFormTools } from './qualification-forms.js'

export const tools: Tool[] = [
  ...leadMagnetTools,
  ...ideationTools,
  ...funnelTools,
  ...leadTools,
  ...analyticsTools,
  ...brandKitTools,
  ...emailSequenceTools,
  ...contentPipelineTools,
  ...swipeFileTools,
  ...libraryTools,
  ...qualificationFormTools,
]

// Re-export individual tool arrays for selective imports
export { leadMagnetTools } from './lead-magnets.js'
export { ideationTools } from './ideation.js'
export { funnelTools } from './funnels.js'
export { leadTools } from './leads.js'
export { analyticsTools } from './analytics.js'
export { brandKitTools } from './brand-kit.js'
export { emailSequenceTools } from './email-sequences.js'
export { contentPipelineTools } from './content-pipeline.js'
export { swipeFileTools } from './swipe-file.js'
export { libraryTools } from './libraries.js'
export { qualificationFormTools } from './qualification-forms.js'

// Tool lookup by name for handler routing
export const toolsByName = new Map<string, Tool>(tools.map((tool) => [tool.name, tool]))

// Get tool names by category
export const toolCategories = {
  leadMagnets: leadMagnetTools.map((t) => t.name),
  ideation: ideationTools.map((t) => t.name),
  funnels: funnelTools.map((t) => t.name),
  leads: leadTools.map((t) => t.name),
  analytics: analyticsTools.map((t) => t.name),
  brandKit: brandKitTools.map((t) => t.name),
  emailSequences: emailSequenceTools.map((t) => t.name),
  contentPipeline: contentPipelineTools.map((t) => t.name),
  swipeFile: swipeFileTools.map((t) => t.name),
  libraries: libraryTools.map((t) => t.name),
  qualificationForms: qualificationFormTools.map((t) => t.name),
}
