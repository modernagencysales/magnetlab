import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { CLAUDE_SONNET_MODEL } from './model-config';

interface TagInput {
  tag_name: string;
  usage_count: number;
}

interface ClusterResult {
  clusters: Array<{
    name: string;
    description: string;
    tags: string[];
  }>;
}

export async function clusterTags(tags: TagInput[]): Promise<ClusterResult> {
  if (tags.length === 0) return { clusters: [] };

  // For very few tags, put them all in one cluster
  if (tags.length <= 3) {
    return {
      clusters: [
        {
          name: 'General',
          description: 'All knowledge tags',
          tags: tags.map((t) => t.tag_name),
        },
      ],
    };
  }

  const client = getAnthropicClient();

  const tagList = tags
    .map((t) => `- "${t.tag_name}" (used ${t.usage_count}x)`)
    .join('\n');

  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: `You are organizing knowledge base tags into semantic clusters. Group these tags into 3-8 meaningful categories based on topic similarity.

TAGS:
${tagList}

Rules:
- Every tag must be assigned to exactly one cluster
- Cluster names should be short (2-4 words), clear, and descriptive
- Each cluster should have a one-sentence description
- Aim for balanced clusters (avoid putting most tags in one cluster)
- If tags are very diverse, use broader category names

Respond with ONLY valid JSON in this format:
{
  "clusters": [
    {
      "name": "Category Name",
      "description": "What this category covers",
      "tags": ["tag1", "tag2"]
    }
  ]
}`,
      },
    ],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  return parseJsonResponse<ClusterResult>(text);
}
