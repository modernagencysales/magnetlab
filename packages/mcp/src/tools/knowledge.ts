/** Knowledge base tools (5). Semantic search, browse, clusters, ask, submit transcript. */

import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const knowledgeTools: Tool[] = [
  {
    name: 'magnetlab_search_knowledge',
    description:
      'Search the knowledge base using semantic search. Supports filtering by category, type, topic, quality, and date. Omit query to browse/filter only.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query (optional — omit to browse/filter)',
        },
        category: {
          type: 'string',
          enum: ['insight', 'question', 'product_intel'],
          description: 'Filter by knowledge category',
        },
        type: {
          type: 'string',
          enum: [
            'how_to',
            'insight',
            'story',
            'question',
            'objection',
            'mistake',
            'decision',
            'market_intel',
          ],
          description: 'Filter by knowledge type',
        },
        topic: { type: 'string', description: 'Filter by topic slug' },
        min_quality: { type: 'number', description: 'Minimum quality score (1-5)' },
        since: { type: 'string', description: 'Only entries after this ISO date' },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
    },
  },
  {
    name: 'magnetlab_browse_knowledge',
    description:
      'Browse knowledge base entries by category and tag. Returns recent entries without search. Use for exploring what the knowledge base contains.',
    inputSchema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['insight', 'question', 'product_intel'],
          description: 'Category to browse (default: insight)',
        },
        tag: { type: 'string', description: 'Filter by tag' },
        limit: { type: 'number', description: 'Max results (default: 20)' },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
    },
  },
  {
    name: 'magnetlab_get_knowledge_clusters',
    description:
      'Get topic clusters from the knowledge base. Groups related knowledge entries together to show themes and patterns across your expertise.',
    inputSchema: {
      type: 'object',
      properties: {
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
    },
  },
  {
    name: 'magnetlab_ask_knowledge',
    description:
      'Ask a question against your knowledge base. Uses AI + semantic search to find relevant answers from your transcripts and notes.',
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'Natural language question about the knowledge base',
        },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['question'],
    },
  },
  {
    name: 'magnetlab_submit_transcript',
    description:
      'Submit a call transcript for AI processing. The transcript is analyzed to extract knowledge entries and content ideas. Minimum 100 characters.',
    inputSchema: {
      type: 'object',
      properties: {
        transcript: { type: 'string', description: 'Full transcript text (min 100 characters)' },
        title: { type: 'string', description: 'Title/label for this transcript (optional)' },
        team_id: {
          type: 'string',
          description: 'Team ID to scope this operation. Omit for primary team.',
        },
      },
      required: ['transcript'],
    },
  },
];
