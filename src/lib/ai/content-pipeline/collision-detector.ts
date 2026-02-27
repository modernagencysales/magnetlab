import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { CLAUDE_HAIKU_MODEL } from './model-config';

export interface PostForCollision {
  id: string;
  profile_name: string;
  content: string;
  scheduled_date: string; // YYYY-MM-DD
}

export interface Collision {
  post_a_id: string;
  post_b_id: string;
  overlap_description: string;
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

export interface CollisionResult {
  has_collision: boolean;
  collisions: Collision[];
}

const NO_COLLISIONS: CollisionResult = { has_collision: false, collisions: [] };

/**
 * Detect when two team members have posts about the same topic scheduled for the same day.
 * Uses Claude Haiku to check for topic overlap among same-day posts.
 * Returns no collisions on any error or when fewer than 2 posts exist.
 */
export async function detectContentCollisions(
  posts: PostForCollision[]
): Promise<CollisionResult> {
  // 1. If fewer than 2 posts, nothing to compare
  if (posts.length < 2) return NO_COLLISIONS;

  // 2. Group posts by scheduled_date
  const byDate = new Map<string, PostForCollision[]>();
  for (const post of posts) {
    const existing = byDate.get(post.scheduled_date) || [];
    existing.push(post);
    byDate.set(post.scheduled_date, existing);
  }

  // 3. Only check dates with 2+ posts
  const sameDayGroups: PostForCollision[][] = [];
  for (const group of byDate.values()) {
    if (group.length >= 2) {
      sameDayGroups.push(group);
    }
  }

  if (sameDayGroups.length === 0) return NO_COLLISIONS;

  // 4. Build a summary of same-day post groups
  const postSummaries = sameDayGroups
    .map((group) => {
      const date = group[0].scheduled_date;
      const entries = group
        .map(
          (p) =>
            `- ID: ${p.id} | Author: ${p.profile_name} | Content preview: ${p.content.slice(0, 300)}`
        )
        .join('\n');
      return `Date: ${date}\n${entries}`;
    })
    .join('\n\n');

  // 5. Call Claude Haiku to check for topic overlap
  try {
    const client = getAnthropicClient('collision-detector');

    const response = await client.messages.create({
      model: CLAUDE_HAIKU_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You're checking LinkedIn posts scheduled for the same day by different team members. Flag if any posts on the same day cover the same core topic (would look coordinated/redundant to the audience).

POSTS:
${postSummaries}

Respond in JSON only:
{
  "has_collision": boolean,
  "collisions": [
    {
      "post_a_id": "id",
      "post_b_id": "id",
      "overlap_description": "Both discuss X topic",
      "severity": "high|medium|low",
      "suggestion": "Move post B to Thursday instead"
    }
  ]
}

If no collisions, return {"has_collision": false, "collisions": []}`,
        },
      ],
    });

    // 6. Parse JSON response
    const text =
      response.content[0].type === 'text' ? response.content[0].text : '';
    const result = parseJsonResponse<CollisionResult>(text);

    // Validate result shape
    if (typeof result.has_collision !== 'boolean' || !Array.isArray(result.collisions)) {
      return NO_COLLISIONS;
    }

    return result;
  } catch {
    // 7. Default to no collisions on parse failure or any error
    return NO_COLLISIONS;
  }
}
