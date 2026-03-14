import { Tool } from '@modelcontextprotocol/sdk/types.js'

export const contentPipelineTools: Tool[] = [
  // ============================================================
  // Transcripts
  // ============================================================
  {
    name: 'magnetlab_list_transcripts',
    description:
      'List all call transcripts in the AI Brain. Shows source (paste/grain/fireflies), title, date, duration, and whether ideas/knowledge have been extracted from each transcript.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'magnetlab_submit_transcript',
    description:
      'Submit a call transcript for AI processing. The transcript is analyzed to extract knowledge entries (insights, questions, pain points) and content ideas. Minimum 100 characters.',
    inputSchema: {
      type: 'object',
      properties: {
        transcript: { type: 'string', description: 'Full transcript text (min 100 characters)' },
        title: { type: 'string', description: 'Title/label for this transcript (optional)' },
      },
      required: ['transcript'],
    },
  },
  {
    name: 'magnetlab_delete_transcript',
    description: 'Delete a transcript and all its extracted knowledge entries and content ideas (cascading delete).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Transcript UUID' },
      },
      required: ['id'],
    },
  },

  // ============================================================
  // Knowledge Base (AI Brain)
  // ============================================================
  {
    name: 'magnetlab_search_knowledge',
    description:
      'Search the AI Brain knowledge base. Supports semantic search via query, plus filtering by category, type, topic, quality, and date. All parameters are optional — omit query to browse/filter only.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search query (optional — omit to browse/filter)' },
        category: {
          type: 'string',
          enum: ['insight', 'question', 'pain_point', 'success_story', 'objection', 'framework', 'quote', 'market_intel'],
          description: 'Filter by knowledge category',
        },
        type: {
          type: 'string',
          enum: ['how_to', 'insight', 'story', 'question', 'objection', 'mistake', 'decision', 'market_intel'],
          description: 'Filter by knowledge type',
        },
        topic: { type: 'string', description: 'Filter by topic slug' },
        min_quality: { type: 'number', description: 'Minimum quality score (1-5)' },
        since: { type: 'string', description: 'Only entries after this ISO date' },
      },
    },
  },
  {
    name: 'magnetlab_browse_knowledge',
    description:
      'Browse knowledge base entries by category. Returns recent entries without search. Use for exploring what the AI Brain contains.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['insight', 'question', 'pain_point', 'success_story', 'objection', 'framework', 'quote', 'market_intel'],
          description: 'Category to browse (default: insight)',
        },
      },
    },
  },
  {
    name: 'magnetlab_get_knowledge_tags',
    description:
      'Get all tags used in the knowledge base with their usage counts. Useful for understanding what topics are covered.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'magnetlab_get_knowledge_clusters',
    description:
      'Get topic clusters from the knowledge base. Groups related knowledge entries together to show themes and patterns.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'magnetlab_ask_knowledge',
    description:
      'Ask a natural language question and get an AI-synthesized answer from the knowledge base. Uses RAG to retrieve relevant entries and generate a comprehensive answer.',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Natural language question about the knowledge base' },
      },
      required: ['question'],
    },
  },
  {
    name: 'magnetlab_knowledge_gaps',
    description:
      'Analyze knowledge gaps across all topics. Returns coverage scores, missing knowledge types, and gap patterns like "asked but not answered" or "theory without proof".',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'magnetlab_knowledge_readiness',
    description:
      'Assess whether there is enough knowledge on a topic for a specific goal (lead magnet, blog post, course, SOP, or content week).',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'The topic to assess readiness for' },
        goal: {
          type: 'string',
          enum: ['lead_magnet', 'blog_post', 'course', 'sop', 'content_week'],
          description: 'What the knowledge will be used for',
        },
      },
      required: ['topic', 'goal'],
    },
  },
  {
    name: 'magnetlab_recent_knowledge',
    description:
      'Get a digest of recently extracted knowledge. Shows entries added, new topics, most active topics, and quality 4+ highlights.',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Number of days to look back (default: 7, max: 90)' },
      },
    },
  },
  {
    name: 'magnetlab_export_knowledge',
    description:
      'Export knowledge for a topic organized by type (how-to processes, insights, stories, FAQs, objection handling, lessons, decisions, market context).',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Topic slug to export' },
        format: {
          type: 'string',
          enum: ['structured', 'markdown', 'json'],
          description: 'Export format (default: structured)',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'magnetlab_list_topics',
    description:
      'List all knowledge topics with entry counts, average quality, and freshness. Shows what subjects the knowledge base covers.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max topics to return (default: 50)' },
      },
    },
  },
  {
    name: 'magnetlab_topic_detail',
    description:
      'Get detailed coverage for a specific topic: type breakdown (how many how-tos, insights, stories, etc.), top entries per type, and corroboration count.',
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Topic slug' },
      },
      required: ['slug'],
    },
  },

  // ============================================================
  // Content Ideas
  // ============================================================
  {
    name: 'magnetlab_list_ideas',
    description:
      'List content ideas extracted from transcripts. Filter by status, content pillar, or content type. Ideas have title, core insight, why they are post-worthy, and a relevance score.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['extracted', 'selected', 'writing', 'written', 'scheduled', 'published', 'archived'],
          description: 'Filter by idea status',
        },
        pillar: {
          type: 'string',
          enum: ['moments_that_matter', 'teaching_promotion', 'human_personal', 'collaboration_social_proof'],
          description: 'Filter by content pillar',
        },
        content_type: {
          type: 'string',
          enum: ['story', 'insight', 'tip', 'framework', 'case_study', 'question', 'listicle', 'contrarian'],
          description: 'Filter by content type',
        },
        limit: { type: 'number', default: 50, description: 'Max results' },
      },
    },
  },
  {
    name: 'magnetlab_get_idea',
    description: 'Get full details of a content idea including its transcript context and writing status.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Content idea UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_update_idea_status',
    description:
      'Update the status of a content idea. Use to mark ideas as selected for writing, archive them, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        idea_id: { type: 'string', description: 'Content idea UUID' },
        status: {
          type: 'string',
          enum: ['extracted', 'selected', 'writing', 'written', 'scheduled', 'published', 'archived'],
          description: 'New status',
        },
      },
      required: ['idea_id', 'status'],
    },
  },
  {
    name: 'magnetlab_delete_idea',
    description: 'Delete a content idea.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Content idea UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_write_post_from_idea',
    description:
      'Generate a LinkedIn post draft from a content idea using AI. The idea\'s insight, context, and pillar are used to write an engaging post.',
    inputSchema: {
      type: 'object',
      properties: {
        idea_id: { type: 'string', description: 'Content idea UUID to write from' },
      },
      required: ['idea_id'],
    },
  },

  // ============================================================
  // Pipeline Posts
  // ============================================================
  {
    name: 'magnetlab_list_posts',
    description:
      'List posts in the content pipeline. Filter by status (draft, review, approved, scheduled, published, archived) or buffer status.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'review', 'approved', 'scheduled', 'published', 'archived'],
          description: 'Filter by post status',
        },
        is_buffer: {
          type: 'boolean',
          description: 'Filter for buffer posts only (true) or non-buffer (false)',
        },
        limit: { type: 'number', default: 50, description: 'Max results' },
      },
    },
  },
  {
    name: 'magnetlab_get_post',
    description: 'Get full details of a pipeline post including draft and final content, hook score, polish notes, and scheduling info.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Pipeline post UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_update_post',
    description: 'Update a pipeline post. Can change content, status, scheduling, or other fields.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Pipeline post UUID' },
        draft_content: { type: 'string', description: 'Updated draft content' },
        final_content: { type: 'string', description: 'Updated final content' },
        status: {
          type: 'string',
          enum: ['draft', 'review', 'approved', 'scheduled', 'published', 'archived'],
        },
        dm_template: { type: 'string', description: 'DM template text' },
        cta_word: { type: 'string', description: 'CTA keyword' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_delete_post',
    description: 'Delete a pipeline post.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Pipeline post UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_polish_post',
    description:
      'Run AI polish on a pipeline post. Detects AI patterns, improves hook strength, and refines the writing. Returns changes made and a hook score.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Pipeline post UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_publish_post',
    description: 'Publish a pipeline post immediately (marks as published, triggers LeadShark if connected).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Pipeline post UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_schedule_post',
    description: 'Schedule a pipeline post for future publishing.',
    inputSchema: {
      type: 'object',
      properties: {
        post_id: { type: 'string', description: 'Pipeline post UUID' },
        scheduled_time: {
          type: 'string',
          format: 'date-time',
          description: 'ISO 8601 datetime for publishing',
        },
      },
      required: ['post_id', 'scheduled_time'],
    },
  },
  {
    name: 'magnetlab_get_posts_by_date_range',
    description: 'Get all pipeline posts within a date range. Useful for viewing the content calendar.',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', format: 'date', description: 'Start date (YYYY-MM-DD)' },
        end_date: { type: 'string', format: 'date', description: 'End date (YYYY-MM-DD)' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'magnetlab_quick_write',
    description:
      'Quickly write a LinkedIn post on any topic using AI. Optionally specify a writing style or template to follow.',
    inputSchema: {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Topic or prompt for the post' },
        style: { type: 'string', description: 'Writing style ID to use (optional)' },
        template: { type: 'string', description: 'Template ID to follow (optional)' },
      },
      required: ['topic'],
    },
  },

  // ============================================================
  // Schedule & Autopilot
  // ============================================================
  {
    name: 'magnetlab_list_posting_slots',
    description: 'List all posting time slots. These define when autopilot publishes posts (day of week + time).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'magnetlab_create_posting_slot',
    description: 'Create a new posting time slot for the autopilot schedule.',
    inputSchema: {
      type: 'object',
      properties: {
        day_of_week: {
          type: 'number',
          description: 'Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)',
        },
        time: { type: 'string', description: 'Time in HH:mm format (24h)' },
      },
      required: ['day_of_week', 'time'],
    },
  },
  {
    name: 'magnetlab_delete_posting_slot',
    description: 'Delete a posting time slot.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Posting slot UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_get_autopilot_status',
    description:
      'Get current autopilot status: buffer size (how many posts ready), next scheduled slot, and content pillar distribution.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'magnetlab_trigger_autopilot',
    description:
      'Trigger the autopilot to generate new posts. It draws from content ideas and the knowledge base to fill the buffer. Configure batch size and buffer target.',
    inputSchema: {
      type: 'object',
      properties: {
        posts_per_batch: {
          type: 'number',
          description: 'How many posts to generate (1-10, default: 3)',
        },
        buffer_target: {
          type: 'number',
          description: 'Target buffer size to maintain (1-20, default: 5)',
        },
        auto_publish: {
          type: 'boolean',
          description: 'Auto-publish generated posts (default: false)',
        },
      },
    },
  },
  {
    name: 'magnetlab_get_buffer',
    description:
      'Get the current content buffer (posts queued for publishing). Review and approve/reject these before they auto-publish.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // ============================================================
  // Writing Styles & Templates
  // ============================================================
  {
    name: 'magnetlab_list_writing_styles',
    description:
      'List active writing styles. These are AI-extracted style profiles from LinkedIn creators that guide how posts are written.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'magnetlab_extract_writing_style',
    description:
      'Extract a writing style profile from a LinkedIn creator\'s URL. Analyzes their posts to capture tone, formatting, hook patterns, and voice characteristics.',
    inputSchema: {
      type: 'object',
      properties: {
        linkedin_url: {
          type: 'string',
          description: 'LinkedIn profile URL to extract style from',
        },
      },
      required: ['linkedin_url'],
    },
  },
  {
    name: 'magnetlab_get_writing_style',
    description: 'Get full details of a writing style profile including analyzed posts and style characteristics.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Writing style UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'magnetlab_list_templates',
    description:
      'List post templates. Templates provide reusable structures (hooks, frameworks, CTAs) for consistent post writing.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 50, description: 'Max results' },
      },
    },
  },
  {
    name: 'magnetlab_match_template',
    description:
      'Find the best matching templates for a content idea. Uses semantic similarity to suggest templates that fit the idea\'s topic and style.',
    inputSchema: {
      type: 'object',
      properties: {
        idea_id: { type: 'string', description: 'Content idea UUID to match against' },
      },
      required: ['idea_id'],
    },
  },

  // ============================================================
  // Content Planner
  // ============================================================
  {
    name: 'magnetlab_get_plan',
    description: 'Get the current content plan. Shows the planned content calendar with assigned ideas, templates, and statuses.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'magnetlab_generate_plan',
    description:
      'Generate a new content plan using AI. Creates a balanced mix of content types and pillars across the specified number of weeks.',
    inputSchema: {
      type: 'object',
      properties: {
        week_count: { type: 'number', description: 'Number of weeks to plan (default: 1)' },
      },
    },
  },
  {
    name: 'magnetlab_approve_plan',
    description: 'Approve a generated content plan. Converts planned items into pipeline posts ready for writing.',
    inputSchema: {
      type: 'object',
      properties: {
        plan_id: { type: 'string', description: 'Content plan UUID to approve' },
      },
      required: ['plan_id'],
    },
  },

  // ============================================================
  // Business Context (Content Pipeline)
  // ============================================================
  {
    name: 'magnetlab_get_business_context',
    description:
      'Get the content pipeline business context. This is separate from the brand kit and focuses on content strategy (pillars, audience, topics).',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'magnetlab_update_business_context',
    description: 'Update the content pipeline business context used for AI content generation.',
    inputSchema: {
      type: 'object',
      properties: {
        context: {
          type: 'object',
          description: 'Business context fields to update',
        },
      },
      required: ['context'],
    },
  },
]
