/**
 * Swipe File Service
 * List (public) and submit (auth) for lead magnets and posts.
 */

import * as repo from '@/server/repositories/swipe-file.repo';

export async function listLeadMagnets(filters: {
  niche?: string;
  format?: string;
  featured?: boolean;
  limit: number;
  offset: number;
}) {
  const { data, count } = await repo.listLeadMagnets({
    ...filters,
    limit: Math.min(filters.limit || 20, 50),
    offset: filters.offset || 0,
  });
  return { leadMagnets: data, total: count, limit: filters.limit, offset: filters.offset };
}

export async function listPosts(filters: {
  niche?: string;
  type?: string;
  featured?: boolean;
  limit: number;
  offset: number;
}) {
  const { data, count } = await repo.listPosts({
    ...filters,
    postType: filters.type,
    limit: Math.min(filters.limit || 20, 50),
    offset: filters.offset || 0,
  });
  return { posts: data, total: count, limit: filters.limit, offset: filters.offset };
}

export async function submitPost(userId: string, body: Record<string, unknown>) {
  const hook = body.hook ?? (typeof body.content === 'string' ? body.content.split('\n')[0]?.slice(0, 100) : null);
  const submission = await repo.submitPost(userId, {
    content: body.content,
    hook: hook ?? null,
    post_type: body.post_type,
    niche: body.niche,
    topic_tags: body.topic_tags ?? [],
    likes_count: body.likes_count,
    comments_count: body.comments_count,
    leads_generated: body.leads_generated,
    source_url: body.source_url,
    notes: body.notes,
  });
  return { submission, message: 'Post submitted for review' };
}

export async function submitLeadMagnet(userId: string, body: Record<string, unknown>) {
  const submission = await repo.submitLeadMagnet(userId, {
    title: body.title,
    description: body.description,
    content: body.content,
    format: body.format,
    niche: body.niche,
    topic_tags: body.topic_tags ?? [],
    downloads_count: body.downloads_count,
    conversion_rate: body.conversion_rate,
    leads_generated: body.leads_generated,
    thumbnail_url: body.thumbnail_url,
    notes: body.notes,
    related_post_id: body.related_post_id,
  });
  return { submission, message: 'Lead magnet submitted for review' };
}
