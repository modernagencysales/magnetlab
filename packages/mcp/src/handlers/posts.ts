/** Post handler. Dispatches 6 content pipeline post tools to MagnetLabClient methods. Never imports HTTP or DB directly. */

import type { MagnetLabClient } from '../client.js';
import type { ContentPillar, ContentType, PipelinePostStatus } from '../constants.js';

export async function handlePostTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_list_posts':
      return client.listPosts({
        status: args.status as PipelinePostStatus | undefined,
        isBuffer: args.is_buffer as boolean | undefined,
        limit: args.limit as number | undefined,
      });

    case 'magnetlab_get_post':
      return client.getPost(args.id as string);

    case 'magnetlab_create_post':
      return client.createPost({
        body: args.body as string,
        title: args.title as string | undefined,
        pillar: args.pillar as ContentPillar | undefined,
        content_type: args.content_type as ContentType | undefined,
      });

    case 'magnetlab_update_post':
      return client.updatePost(args.id as string, {
        draft_content: args.draft_content as string | undefined,
        final_content: args.final_content as string | undefined,
        status: args.status as PipelinePostStatus | undefined,
      });

    case 'magnetlab_delete_post':
      return client.deletePost(args.id as string);

    case 'magnetlab_publish_post':
      return client.publishPost(args.id as string);

    default:
      throw new Error(`Unknown post tool: ${name}`);
  }
}
