import { MagnetLabClient } from '../client.js'
import type { Archetype } from '../constants.js'

/**
 * Handle ideation and content generation tool calls.
 */
export async function handleIdeationTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_ideate_lead_magnets':
      return client.ideateLeadMagnets({
        businessDescription: args.business_description as string,
        businessType: args.business_type as string,
        credibilityMarkers: args.credibility_markers as string[] | undefined,
        urgentPains: args.urgent_pains as string[] | undefined,
        templates: args.templates as string[] | undefined,
        processes: args.processes as string[] | undefined,
        tools: args.tools as string[] | undefined,
        frequentQuestions: args.frequent_questions as string[] | undefined,
        results: args.results as string[] | undefined,
        successExample: args.success_example as string | undefined,
      })

    case 'magnetlab_extract_content':
      return client.extractContent(args.lead_magnet_id as string, {
        archetype: args.archetype as Archetype,
        concept: args.concept as Record<string, unknown>,
        answers: args.answers as Record<string, string>,
      })

    case 'magnetlab_generate_content':
      return client.generateContent(args.lead_magnet_id as string, {
        archetype: args.archetype as Archetype,
        concept: args.concept as Record<string, unknown>,
        answers: args.answers as Record<string, string>,
      })

    case 'magnetlab_write_linkedin_posts':
      return client.writeLinkedInPosts(args.lead_magnet_id as string, {
        leadMagnetTitle: args.lead_magnet_title as string,
        contents: args.contents as string,
        problemSolved: args.problem_solved as string,
      })

    case 'magnetlab_polish_lead_magnet':
      return client.polishLeadMagnetContent(args.lead_magnet_id as string)

    case 'magnetlab_get_job_status':
      return client.getJobStatus(args.job_id as string)

    default:
      throw new Error(`Unknown ideation tool: ${name}`)
  }
}
