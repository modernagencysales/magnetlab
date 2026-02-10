import { MagnetLabClient } from '../client.js'
import type { ExtractContentType } from '../constants.js'

/**
 * Handle brand kit tool calls.
 */
export async function handleBrandKitTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_get_brand_kit':
      return client.getBrandKit()

    case 'magnetlab_update_brand_kit':
      return client.updateBrandKit({
        businessDescription: args.business_description as string | undefined,
        businessType: args.business_type as string | undefined,
        credibilityMarkers: args.credibility_markers as string[] | undefined,
        urgentPains: args.urgent_pains as string[] | undefined,
        templates: args.templates as string[] | undefined,
        processes: args.processes as string[] | undefined,
        tools: args.tools as string[] | undefined,
        frequentQuestions: args.frequent_questions as string[] | undefined,
        results: args.results as string[] | undefined,
        successExample: args.success_example as string | undefined,
        audienceTools: args.audience_tools as string[] | undefined,
        preferredTone: args.preferred_tone as string | undefined,
        styleProfile: args.style_profile as unknown,
      })

    case 'magnetlab_extract_business_context':
      return client.extractBusinessContext({
        content: args.content as string,
        contentType: args.content_type as ExtractContentType | undefined,
      })

    default:
      throw new Error(`Unknown brand kit tool: ${name}`)
  }
}
