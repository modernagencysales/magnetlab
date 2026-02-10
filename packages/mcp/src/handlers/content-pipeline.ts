import { MagnetLabClient } from '../client.js'
import type {
  IdeaStatus,
  ContentPillar,
  ContentType,
  KnowledgeCategory,
  PipelinePostStatus,
} from '../constants.js'

/**
 * Handle content pipeline tool calls.
 */
export async function handleContentPipelineTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    // Transcripts
    case 'magnetlab_list_transcripts':
      return client.listTranscripts()

    case 'magnetlab_submit_transcript':
      return client.submitTranscript({
        transcript: args.transcript as string,
        title: args.title as string | undefined,
      })

    case 'magnetlab_delete_transcript':
      return client.deleteTranscript(args.id as string)

    // Knowledge base
    case 'magnetlab_search_knowledge':
      return client.searchKnowledge({
        query: args.query as string,
        category: args.category as KnowledgeCategory | undefined,
      })

    case 'magnetlab_browse_knowledge':
      return client.searchKnowledge({
        category: args.category as KnowledgeCategory | undefined,
      })

    case 'magnetlab_get_knowledge_tags':
      return client.searchKnowledge({ view: 'tags' })

    case 'magnetlab_get_knowledge_clusters':
      return client.getKnowledgeClusters()

    // Ideas
    case 'magnetlab_list_ideas':
      return client.listIdeas({
        status: args.status as IdeaStatus | undefined,
        pillar: args.pillar as ContentPillar | undefined,
        contentType: args.content_type as ContentType | undefined,
        limit: args.limit as number | undefined,
      })

    case 'magnetlab_get_idea':
      return client.getIdea(args.id as string)

    case 'magnetlab_update_idea_status':
      return client.updateIdeaStatus(args.idea_id as string, args.status as IdeaStatus)

    case 'magnetlab_delete_idea':
      return client.deleteIdea(args.id as string)

    case 'magnetlab_write_post_from_idea':
      return client.writePostFromIdea(args.idea_id as string)

    // Posts
    case 'magnetlab_list_posts':
      return client.listPosts({
        status: args.status as PipelinePostStatus | undefined,
        isBuffer: args.is_buffer as boolean | undefined,
        limit: args.limit as number | undefined,
      })

    case 'magnetlab_get_post':
      return client.getPost(args.id as string)

    case 'magnetlab_update_post': {
      const { id, ...rest } = args
      return client.updatePost(id as string, rest)
    }

    case 'magnetlab_delete_post':
      return client.deletePost(args.id as string)

    case 'magnetlab_polish_post':
      return client.polishPost(args.id as string)

    case 'magnetlab_publish_post':
      return client.publishPost(args.id as string)

    case 'magnetlab_schedule_post':
      return client.schedulePost({
        postId: args.post_id as string,
        scheduledTime: args.scheduled_time as string,
      })

    case 'magnetlab_get_posts_by_date_range':
      return client.getPostsByDateRange({
        startDate: args.start_date as string,
        endDate: args.end_date as string,
      })

    case 'magnetlab_quick_write':
      return client.quickWritePost({
        topic: args.topic as string,
        style: args.style as string | undefined,
        template: args.template as string | undefined,
      })

    // Schedule & Autopilot
    case 'magnetlab_list_posting_slots':
      return client.listPostingSlots()

    case 'magnetlab_create_posting_slot':
      return client.createPostingSlot({
        dayOfWeek: args.day_of_week as number,
        time: args.time as string,
      })

    case 'magnetlab_delete_posting_slot':
      return client.deletePostingSlot(args.id as string)

    case 'magnetlab_get_autopilot_status':
      return client.getAutopilotStatus()

    case 'magnetlab_trigger_autopilot':
      return client.triggerAutopilot({
        postsPerBatch: args.posts_per_batch as number | undefined,
        bufferTarget: args.buffer_target as number | undefined,
        autoPublish: args.auto_publish as boolean | undefined,
      })

    case 'magnetlab_get_buffer':
      return client.getBuffer()

    // Writing Styles & Templates
    case 'magnetlab_list_writing_styles':
      return client.listWritingStyles()

    case 'magnetlab_extract_writing_style':
      return client.extractWritingStyle({ linkedinUrl: args.linkedin_url as string })

    case 'magnetlab_get_writing_style':
      return client.getWritingStyle(args.id as string)

    case 'magnetlab_list_templates':
      return client.listTemplates({ limit: args.limit as number | undefined })

    case 'magnetlab_match_template':
      return client.matchTemplate({ ideaId: args.idea_id as string })

    // Content Planner
    case 'magnetlab_get_plan':
      return client.getPlan()

    case 'magnetlab_generate_plan':
      return client.generatePlan({ weekCount: args.week_count as number | undefined })

    case 'magnetlab_approve_plan':
      return client.approvePlan({ planId: args.plan_id as string })

    // Business Context
    case 'magnetlab_get_business_context':
      return client.getBusinessContext()

    case 'magnetlab_update_business_context':
      return client.updateBusinessContext(args.context as Record<string, unknown>)

    default:
      throw new Error(`Unknown content pipeline tool: ${name}`)
  }
}
