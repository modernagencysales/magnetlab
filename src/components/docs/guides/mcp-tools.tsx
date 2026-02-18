'use client';

import Link from 'next/link';

function ToolTable({
  tools,
}: {
  tools: { name: string; description: string; params: string }[];
}) {
  return (
    <div className="overflow-x-auto my-2">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left py-2 px-3 border-b font-medium text-muted-foreground">
              Tool
            </th>
            <th className="text-left py-2 px-3 border-b font-medium text-muted-foreground">
              Description
            </th>
            <th className="text-left py-2 px-3 border-b font-medium text-muted-foreground">
              Required Params
            </th>
          </tr>
        </thead>
        <tbody>
          {tools.map((tool) => (
            <tr key={tool.name}>
              <td className="py-2 px-3 border-b">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                  {tool.name}
                </code>
              </td>
              <td className="py-2 px-3 border-b">{tool.description}</td>
              <td className="py-2 px-3 border-b">
                <code className="text-xs font-mono">{tool.params}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function McpTools() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">MCP Tool Reference</h1>
      <p className="text-muted-foreground mb-8">
        All available tools when using the MagnetLab MCP server with Claude. 81 tools across 11
        categories.
      </p>

      <div className="rounded-lg border bg-muted/30 p-4 my-4">
        <p className="text-sm">
          New to MCP? Start with the{' '}
          <Link
            href="/docs/mcp-setup"
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            setup guide
          </Link>{' '}
          first. For real-world examples, see{' '}
          <Link
            href="/docs/mcp-workflows"
            className="text-violet-600 dark:text-violet-400 hover:underline"
          >
            Example Workflows
          </Link>
          .
        </p>
      </div>

      {/* Lead Magnets */}
      <details className="my-4 rounded-lg border">
        <summary className="cursor-pointer text-lg font-semibold py-3 px-4">
          Lead Magnets (7 tools)
        </summary>
        <div className="px-4 pb-4">
          <ToolTable
            tools={[
              {
                name: 'magnetlab_list_lead_magnets',
                description: 'List all lead magnets with status and archetype',
                params: 'none',
              },
              {
                name: 'magnetlab_get_lead_magnet',
                description: 'Get full details including content, posts, and DM template',
                params: 'id',
              },
              {
                name: 'magnetlab_create_lead_magnet',
                description: 'Create a new lead magnet with a chosen archetype',
                params: 'title, archetype',
              },
              {
                name: 'magnetlab_delete_lead_magnet',
                description: 'Delete a lead magnet and its associated funnels/leads',
                params: 'id',
              },
              {
                name: 'magnetlab_get_lead_magnet_stats',
                description: 'Get page views, leads captured, and conversion rate',
                params: 'lead_magnet_id',
              },
              {
                name: 'magnetlab_analyze_competitor',
                description: 'Analyze a competitor URL for lead magnet ideas',
                params: 'url',
              },
              {
                name: 'magnetlab_analyze_transcript',
                description: 'Extract lead magnet ideas from a transcript',
                params: 'transcript',
              },
            ]}
          />
        </div>
      </details>

      {/* Ideation */}
      <details className="my-4 rounded-lg border">
        <summary className="cursor-pointer text-lg font-semibold py-3 px-4">
          Ideation (6 tools)
        </summary>
        <div className="px-4 pb-4">
          <ToolTable
            tools={[
              {
                name: 'magnetlab_ideate_lead_magnets',
                description: 'Generate lead magnet ideas from your business context',
                params: 'business_description, business_type',
              },
              {
                name: 'magnetlab_extract_content',
                description: 'Run AI content extraction from Q&A answers',
                params: 'lead_magnet_id, archetype, concept, answers',
              },
              {
                name: 'magnetlab_generate_content',
                description: 'Generate final content structure from extraction data',
                params: 'lead_magnet_id, archetype, concept, answers',
              },
              {
                name: 'magnetlab_write_linkedin_posts',
                description: 'Write 3 LinkedIn post variations to promote a lead magnet',
                params: 'lead_magnet_id, lead_magnet_title, contents, problem_solved',
              },
              {
                name: 'magnetlab_polish_lead_magnet',
                description: 'AI-polish lead magnet content for readability and impact',
                params: 'lead_magnet_id',
              },
              {
                name: 'magnetlab_get_job_status',
                description: 'Check status of a background job (ideation, generation)',
                params: 'job_id',
              },
            ]}
          />
        </div>
      </details>

      {/* Funnels */}
      <details className="my-4 rounded-lg border">
        <summary className="cursor-pointer text-lg font-semibold py-3 px-4">
          Funnels (9 tools)
        </summary>
        <div className="px-4 pb-4">
          <ToolTable
            tools={[
              {
                name: 'magnetlab_list_funnels',
                description: 'List all funnel pages with status and target',
                params: 'none',
              },
              {
                name: 'magnetlab_get_funnel',
                description: 'Get full funnel details including copy, theme, and qualification',
                params: 'id',
              },
              {
                name: 'magnetlab_get_funnel_by_target',
                description: 'Find funnel by its target lead magnet, library, or external resource',
                params: 'lead_magnet_id or library_id or external_resource_id',
              },
              {
                name: 'magnetlab_create_funnel',
                description: 'Create a new funnel/opt-in page with slug, copy, and theme',
                params: 'slug',
              },
              {
                name: 'magnetlab_update_funnel',
                description: 'Update funnel copy, theme, colors, or qualification form',
                params: 'id',
              },
              {
                name: 'magnetlab_delete_funnel',
                description: 'Delete a funnel and all its leads',
                params: 'id',
              },
              {
                name: 'magnetlab_publish_funnel',
                description: 'Publish a funnel (returns the live URL)',
                params: 'id',
              },
              {
                name: 'magnetlab_unpublish_funnel',
                description: 'Take a funnel offline',
                params: 'id',
              },
              {
                name: 'magnetlab_generate_funnel_content',
                description: 'AI-generate opt-in page copy from lead magnet content',
                params: 'lead_magnet_id',
              },
            ]}
          />
        </div>
      </details>

      {/* Leads */}
      <details className="my-4 rounded-lg border">
        <summary className="cursor-pointer text-lg font-semibold py-3 px-4">
          Leads (2 tools)
        </summary>
        <div className="px-4 pb-4">
          <ToolTable
            tools={[
              {
                name: 'magnetlab_list_leads',
                description:
                  'List captured leads with filters (funnel, qualification, search)',
                params: 'none (optional: funnel_id, qualified, search, limit)',
              },
              {
                name: 'magnetlab_export_leads',
                description: 'Export leads as CSV with email, name, UTM, and qualification data',
                params: 'none (optional: funnel_id, qualified)',
              },
            ]}
          />
        </div>
      </details>

      {/* Analytics */}
      <details className="my-4 rounded-lg border">
        <summary className="cursor-pointer text-lg font-semibold py-3 px-4">
          Analytics (1 tool)
        </summary>
        <div className="px-4 pb-4">
          <ToolTable
            tools={[
              {
                name: 'magnetlab_get_funnel_stats',
                description:
                  'Get per-funnel views, leads, conversion rate, and qualification rate',
                params: 'none',
              },
            ]}
          />
        </div>
      </details>

      {/* Brand Kit */}
      <details className="my-4 rounded-lg border">
        <summary className="cursor-pointer text-lg font-semibold py-3 px-4">
          Brand Kit (3 tools)
        </summary>
        <div className="px-4 pb-4">
          <ToolTable
            tools={[
              {
                name: 'magnetlab_get_brand_kit',
                description:
                  'Get your brand context (business description, pains, credibility, tone)',
                params: 'none',
              },
              {
                name: 'magnetlab_update_brand_kit',
                description:
                  'Update brand context fields used for AI ideation and generation',
                params: 'none (fields to update)',
              },
              {
                name: 'magnetlab_extract_business_context',
                description:
                  'Extract business context from raw text (about page, offer doc, bio)',
                params: 'content',
              },
            ]}
          />
        </div>
      </details>

      {/* Email Sequences */}
      <details className="my-4 rounded-lg border">
        <summary className="cursor-pointer text-lg font-semibold py-3 px-4">
          Email Sequences (4 tools)
        </summary>
        <div className="px-4 pb-4">
          <ToolTable
            tools={[
              {
                name: 'magnetlab_get_email_sequence',
                description: 'Get the email drip sequence for a lead magnet',
                params: 'lead_magnet_id',
              },
              {
                name: 'magnetlab_generate_email_sequence',
                description: 'AI-generate a 5-email welcome sequence',
                params: 'lead_magnet_id',
              },
              {
                name: 'magnetlab_update_email_sequence',
                description: 'Edit emails in a sequence (subject, body, timing)',
                params: 'lead_magnet_id',
              },
              {
                name: 'magnetlab_activate_email_sequence',
                description: 'Activate a sequence to start sending to new leads',
                params: 'lead_magnet_id',
              },
            ]}
          />
        </div>
      </details>

      {/* Content Pipeline */}
      <details className="my-4 rounded-lg border">
        <summary className="cursor-pointer text-lg font-semibold py-3 px-4">
          Content Pipeline (34 tools)
        </summary>
        <div className="px-4 pb-4">
          <h3 className="text-lg font-medium mt-4 mb-3">Transcripts</h3>
          <ToolTable
            tools={[
              {
                name: 'magnetlab_list_transcripts',
                description: 'List all call transcripts in the AI Brain',
                params: 'none',
              },
              {
                name: 'magnetlab_submit_transcript',
                description: 'Submit a transcript for AI processing (extracts knowledge and ideas)',
                params: 'transcript',
              },
              {
                name: 'magnetlab_delete_transcript',
                description: 'Delete a transcript and all extracted knowledge/ideas',
                params: 'id',
              },
            ]}
          />

          <h3 className="text-lg font-medium mt-6 mb-3">Knowledge Base (AI Brain)</h3>
          <ToolTable
            tools={[
              {
                name: 'magnetlab_search_knowledge',
                description: 'Semantic search across the AI Brain using pgvector embeddings',
                params: 'query',
              },
              {
                name: 'magnetlab_browse_knowledge',
                description: 'Browse knowledge entries by category',
                params: 'none (optional: category)',
              },
              {
                name: 'magnetlab_get_knowledge_tags',
                description: 'Get all tags with usage counts',
                params: 'none',
              },
              {
                name: 'magnetlab_get_knowledge_clusters',
                description: 'Get topic clusters showing themes and patterns',
                params: 'none',
              },
            ]}
          />

          <h3 className="text-lg font-medium mt-6 mb-3">Content Ideas</h3>
          <ToolTable
            tools={[
              {
                name: 'magnetlab_list_ideas',
                description: 'List content ideas with filters (status, pillar, content type)',
                params: 'none (optional: status, pillar, content_type)',
              },
              {
                name: 'magnetlab_get_idea',
                description: 'Get full details of a content idea with transcript context',
                params: 'id',
              },
              {
                name: 'magnetlab_update_idea_status',
                description: 'Update idea status (selected, writing, archived, etc.)',
                params: 'idea_id, status',
              },
              {
                name: 'magnetlab_delete_idea',
                description: 'Delete a content idea',
                params: 'id',
              },
              {
                name: 'magnetlab_write_post_from_idea',
                description: 'Generate a LinkedIn post draft from a content idea',
                params: 'idea_id',
              },
            ]}
          />

          <h3 className="text-lg font-medium mt-6 mb-3">Pipeline Posts</h3>
          <ToolTable
            tools={[
              {
                name: 'magnetlab_list_posts',
                description: 'List posts in the pipeline (draft, review, approved, scheduled, published)',
                params: 'none (optional: status, is_buffer)',
              },
              {
                name: 'magnetlab_get_post',
                description: 'Get full post details (content, hook score, scheduling)',
                params: 'id',
              },
              {
                name: 'magnetlab_update_post',
                description: 'Update post content, status, DM template, or CTA',
                params: 'id',
              },
              {
                name: 'magnetlab_delete_post',
                description: 'Delete a pipeline post',
                params: 'id',
              },
              {
                name: 'magnetlab_polish_post',
                description: 'AI polish: detect patterns, improve hooks, refine writing',
                params: 'id',
              },
              {
                name: 'magnetlab_publish_post',
                description: 'Publish a post immediately',
                params: 'id',
              },
              {
                name: 'magnetlab_schedule_post',
                description: 'Schedule a post for future publishing',
                params: 'post_id, scheduled_time',
              },
              {
                name: 'magnetlab_get_posts_by_date_range',
                description: 'Get posts within a date range (content calendar view)',
                params: 'start_date, end_date',
              },
              {
                name: 'magnetlab_quick_write',
                description: 'Quickly write a LinkedIn post on any topic using AI',
                params: 'topic',
              },
            ]}
          />

          <h3 className="text-lg font-medium mt-6 mb-3">Schedule &amp; Autopilot</h3>
          <ToolTable
            tools={[
              {
                name: 'magnetlab_list_posting_slots',
                description: 'List all posting time slots (day + time)',
                params: 'none',
              },
              {
                name: 'magnetlab_create_posting_slot',
                description: 'Create a new posting time slot for the autopilot schedule',
                params: 'day_of_week, time',
              },
              {
                name: 'magnetlab_delete_posting_slot',
                description: 'Delete a posting time slot',
                params: 'id',
              },
              {
                name: 'magnetlab_get_autopilot_status',
                description: 'Get buffer size, next slot, and pillar distribution',
                params: 'none',
              },
              {
                name: 'magnetlab_trigger_autopilot',
                description: 'Generate new posts from ideas and knowledge to fill the buffer',
                params: 'none (optional: posts_per_batch, buffer_target, auto_publish)',
              },
              {
                name: 'magnetlab_get_buffer',
                description: 'Get the content buffer (posts queued for publishing)',
                params: 'none',
              },
            ]}
          />

          <h3 className="text-lg font-medium mt-6 mb-3">Writing Styles &amp; Templates</h3>
          <ToolTable
            tools={[
              {
                name: 'magnetlab_list_writing_styles',
                description: 'List active writing style profiles',
                params: 'none',
              },
              {
                name: 'magnetlab_extract_writing_style',
                description: 'Extract a writing style from a LinkedIn creator URL',
                params: 'linkedin_url',
              },
              {
                name: 'magnetlab_get_writing_style',
                description: 'Get full details of a writing style profile',
                params: 'id',
              },
              {
                name: 'magnetlab_list_templates',
                description: 'List reusable post templates (hooks, frameworks, CTAs)',
                params: 'none',
              },
              {
                name: 'magnetlab_match_template',
                description: 'Find best-matching templates for a content idea (semantic match)',
                params: 'idea_id',
              },
            ]}
          />

          <h3 className="text-lg font-medium mt-6 mb-3">Content Planner</h3>
          <ToolTable
            tools={[
              {
                name: 'magnetlab_get_plan',
                description: 'Get the current content plan/calendar',
                params: 'none',
              },
              {
                name: 'magnetlab_generate_plan',
                description: 'AI-generate a content plan with balanced pillars and types',
                params: 'none (optional: week_count)',
              },
              {
                name: 'magnetlab_approve_plan',
                description: 'Approve a plan, converting items to pipeline posts',
                params: 'plan_id',
              },
            ]}
          />

          <h3 className="text-lg font-medium mt-6 mb-3">Business Context</h3>
          <ToolTable
            tools={[
              {
                name: 'magnetlab_get_business_context',
                description: 'Get content pipeline business context (pillars, audience, topics)',
                params: 'none',
              },
              {
                name: 'magnetlab_update_business_context',
                description: 'Update the business context used for AI content generation',
                params: 'context',
              },
            ]}
          />
        </div>
      </details>

      {/* Swipe File */}
      <details className="my-4 rounded-lg border">
        <summary className="cursor-pointer text-lg font-semibold py-3 px-4">
          Swipe File (3 tools)
        </summary>
        <div className="px-4 pb-4">
          <ToolTable
            tools={[
              {
                name: 'magnetlab_browse_swipe_posts',
                description: 'Browse community LinkedIn posts for inspiration',
                params: 'none (optional: niche, type, featured)',
              },
              {
                name: 'magnetlab_browse_swipe_lead_magnets',
                description: 'Browse community lead magnet examples',
                params: 'none (optional: niche, format, featured)',
              },
              {
                name: 'magnetlab_submit_to_swipe_file',
                description: 'Submit your content to the community swipe file',
                params: 'content, type, niche',
              },
            ]}
          />
        </div>
      </details>

      {/* Libraries */}
      <details className="my-4 rounded-lg border">
        <summary className="cursor-pointer text-lg font-semibold py-3 px-4">
          Libraries (7 tools)
        </summary>
        <div className="px-4 pb-4">
          <ToolTable
            tools={[
              {
                name: 'magnetlab_list_libraries',
                description: 'List all content libraries',
                params: 'none',
              },
              {
                name: 'magnetlab_get_library',
                description: 'Get library details (name, description, metadata)',
                params: 'id',
              },
              {
                name: 'magnetlab_create_library',
                description: 'Create a new content library',
                params: 'name',
              },
              {
                name: 'magnetlab_update_library',
                description: 'Update a library name or description',
                params: 'id',
              },
              {
                name: 'magnetlab_delete_library',
                description: 'Delete a library and all its items',
                params: 'id',
              },
              {
                name: 'magnetlab_list_library_items',
                description: 'List all items in a library',
                params: 'library_id',
              },
              {
                name: 'magnetlab_create_library_item',
                description: 'Add an item (link, file, video) to a library',
                params: 'library_id, title',
              },
            ]}
          />
        </div>
      </details>

      {/* Qualification Forms */}
      <details className="my-4 rounded-lg border">
        <summary className="cursor-pointer text-lg font-semibold py-3 px-4">
          Qualification Forms (5 tools)
        </summary>
        <div className="px-4 pb-4">
          <ToolTable
            tools={[
              {
                name: 'magnetlab_list_qualification_forms',
                description: 'List all qualification forms',
                params: 'none',
              },
              {
                name: 'magnetlab_get_qualification_form',
                description: 'Get form details',
                params: 'id',
              },
              {
                name: 'magnetlab_create_qualification_form',
                description: 'Create a new qualification form',
                params: 'name',
              },
              {
                name: 'magnetlab_list_questions',
                description: 'List all questions in a form',
                params: 'form_id',
              },
              {
                name: 'magnetlab_create_question',
                description: 'Add a question (text, single_choice, or multi_choice)',
                params: 'form_id, question_text, question_type',
              },
            ]}
          />
        </div>
      </details>
    </div>
  );
}
