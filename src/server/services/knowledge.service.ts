/**
 * Knowledge Service
 * Business logic for cp_knowledge_entries.
 * Wraps knowledge.repo (direct DB) + lib/services/knowledge-brain (higher-level ops).
 * Never imports from Next.js HTTP layer.
 */

import * as knowledgeRepo from '@/server/repositories/knowledge.repo';
import {
  getAllRecentKnowledge,
  getFilteredKnowledge,
  getKnowledgeTags,
  searchKnowledgeV2,
  verifyTeamMembership,
  getRecentKnowledgeDigest,
  listKnowledgeTopics,
  getTopicDetail,
  generateAndCacheTopicSummary,
  getTagClusters,
  runTagClustering,
  exportTopicKnowledge,
  type KnowledgeSortOption,
} from '@/lib/services/knowledge-brain';
import { answerKnowledgeQuestion } from '@/lib/ai/content-pipeline/knowledge-answerer';
import {
  analyzeTopicGaps,
} from '@/lib/ai/content-pipeline/knowledge-gap-analyzer';
import {
  assessReadiness,
  type ReadinessGoal,
} from '@/lib/ai/content-pipeline/knowledge-readiness';
import type { KnowledgeCategory, KnowledgeSpeaker, KnowledgeType } from '@/lib/types/content-pipeline';
import type { KnowledgeEntry, KnowledgeUpdateInput } from '@/server/repositories/knowledge.repo';

// ─── Re-export types routes may need ──────────────────────────────────────
export type { KnowledgeSortOption, ReadinessGoal };

// ─── Validation constants ──────────────────────────────────────────────────

const ALLOWED_UPDATE_FIELDS = ['content', 'category', 'speaker', 'context'] as const;
const VALID_GOALS: ReadinessGoal[] = ['lead_magnet', 'blog_post', 'course', 'sop', 'content_week'];

// ─── Team scope helper ─────────────────────────────────────────────────────

export async function resolveEffectiveUserId(
  sessionUserId: string,
  teamId?: string,
): Promise<string> {
  return knowledgeRepo.resolveEffectiveUserId(sessionUserId, teamId);
}

export async function assertTeamMembership(userId: string, teamId?: string): Promise<void> {
  if (!teamId) return;
  const isMember = await verifyTeamMembership(userId, teamId);
  if (!isMember) throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
}

// ─── List / search operations ──────────────────────────────────────────────

export interface KnowledgeListParams {
  query?: string;
  category?: KnowledgeCategory;
  speaker?: KnowledgeSpeaker;
  tag?: string;
  view?: string;
  knowledgeType?: KnowledgeType;
  topicSlug?: string;
  minQuality?: number;
  since?: string;
  teamId?: string;
  sort?: KnowledgeSortOption;
  limit?: number;
  offset?: number;
}

export async function listKnowledge(userId: string, params: KnowledgeListParams) {
  const { query, category, speaker, tag, view, knowledgeType, topicSlug, minQuality,
    since, teamId, sort = 'newest', limit = 30, offset = 0 } = params;

  const effectiveUserId = await resolveEffectiveUserId(userId, teamId);

  if (view === 'tags') {
    return { tags: await getKnowledgeTags(effectiveUserId) };
  }

  const hasV2Filters = knowledgeType || topicSlug || minQuality || since;
  if (query || hasV2Filters) {
    const result = await searchKnowledgeV2(effectiveUserId, {
      query: query || undefined,
      knowledgeType: knowledgeType || undefined,
      topicSlug: topicSlug || undefined,
      minQuality,
      since: since || undefined,
      category: category || undefined,
      tags: tag ? [tag] : undefined,
      limit,
      threshold: 0.6,
      teamId,
      sort: query ? undefined : sort,
    });
    if (result.error) throw new Error(result.error);
    let entries = result.entries;
    if (speaker) entries = entries.filter((e) => e.speaker === speaker);
    return { entries, total_count: entries.length };
  }

  const hasFilters = category || speaker || tag;
  if (hasFilters) {
    const entries = await getFilteredKnowledge(effectiveUserId, {
      category: category || undefined,
      speaker: speaker || undefined,
      tag: tag || undefined,
      limit,
      offset,
      sort,
    });
    return { entries, total_count: entries.length };
  }

  const entries = await getAllRecentKnowledge(effectiveUserId, limit, sort);
  return { entries, total_count: entries.length };
}

export async function getKnowledgeDigest(
  userId: string,
  days: number,
  teamId?: string,
) {
  return getRecentKnowledgeDigest(userId, Math.min(days, 90), teamId);
}

export async function getTopics(
  userId: string,
  teamId?: string,
  limit = 50,
) {
  const effectiveUserId = await resolveEffectiveUserId(userId, teamId);
  return listKnowledgeTopics(effectiveUserId, { limit });
}

export async function getTopicBySlug(
  userId: string,
  slug: string,
  teamId?: string,
) {
  return getTopicDetail(userId, slug, teamId);
}

export async function getTopicSummary(
  userId: string,
  slug: string,
  force: boolean,
  teamId?: string,
) {
  return generateAndCacheTopicSummary(userId, slug, force, teamId);
}

export async function getClusters(userId: string, teamId?: string) {
  const effectiveUserId = await resolveEffectiveUserId(userId, teamId);
  return getTagClusters(effectiveUserId);
}

export async function triggerClustering(userId: string, teamId?: string) {
  const effectiveUserId = await resolveEffectiveUserId(userId, teamId);
  return runTagClustering(effectiveUserId);
}

export async function exportKnowledge(
  userId: string,
  topic: string,
  format: string,
  teamId?: string,
) {
  const detail = await exportTopicKnowledge(userId, topic, teamId);
  if (!detail.topic) throw Object.assign(new Error('Topic not found'), { statusCode: 404 });

  if (format === 'markdown') {
    const lines: string[] = [`# ${detail.topic.display_name}\n`];
    for (const [type, entries] of Object.entries(detail.entries_by_type)) {
      if ((entries as unknown[]).length === 0) continue;
      lines.push(`## ${type} (${(entries as unknown[]).length})\n`);
      for (const entry of entries as { content: string }[]) {
        lines.push(`- ${entry.content}\n`);
      }
    }
    return { export: lines.join('\n'), format: 'markdown', total_count: detail.total_count };
  }

  return {
    export: { topic: detail.topic, entries_by_type: detail.entries_by_type, total_count: detail.total_count },
    format: 'structured',
  };
}

export async function getKnowledgeGaps(
  userId: string,
  teamId?: string,
  limit = 20,
) {
  const topics = await listKnowledgeTopics(userId, { teamId, limit });
  const gaps = await Promise.all(
    topics.map(async (topic) => {
      const detail = await getTopicDetail(userId, topic.slug, teamId);
      return analyzeTopicGaps(
        topic.slug,
        topic.display_name,
        detail.type_breakdown,
        topic.avg_quality,
        topic.last_seen,
      );
    }),
  );
  gaps.sort((a, b) => a.coverage_score - b.coverage_score);
  return { gaps, total_topics: topics.length };
}

export async function assessKnowledgeReadiness(
  userId: string,
  topic: string,
  goal: ReadinessGoal,
  teamId?: string,
) {
  if (!VALID_GOALS.includes(goal)) {
    throw Object.assign(
      new Error(`goal must be one of: ${VALID_GOALS.join(', ')}`),
      { statusCode: 400 },
    );
  }
  return assessReadiness(userId, topic, goal, teamId);
}

export async function askKnowledge(userId: string, question: string, teamId?: string) {
  if (!question || typeof question !== 'string' || question.length < 3) {
    throw Object.assign(new Error('Question must be at least 3 characters'), { statusCode: 400 });
  }
  return answerKnowledgeQuestion(userId, question, teamId);
}

// ─── Entry mutation operations ─────────────────────────────────────────────

export async function updateKnowledgeEntry(
  userId: string,
  id: string,
  body: Record<string, unknown>,
): Promise<KnowledgeEntry> {
  const filtered: Record<string, unknown> = {};
  for (const key of ALLOWED_UPDATE_FIELDS) {
    if (key in body) filtered[key] = body[key];
  }

  const newTags: string[] | undefined = Array.isArray(body.tags) ? (body.tags as string[]) : undefined;

  if (Object.keys(filtered).length === 0 && !newTags) {
    throw Object.assign(new Error('No valid fields provided'), { statusCode: 400 });
  }

  const current = await knowledgeRepo.findKnowledgeEntrySnapshot(userId, id);
  if (!current) throw Object.assign(new Error('Entry not found'), { statusCode: 404 });

  // Handle tag count updates
  if (newTags) {
    const oldTags: string[] = current.tags || [];
    const removedTags = oldTags.filter((t) => !newTags.includes(t));
    const addedTags = newTags.filter((t) => !oldTags.includes(t));
    await Promise.all([
      ...removedTags.map((t) => knowledgeRepo.decrementTagCount(userId, t)),
      ...addedTags.map((t) => knowledgeRepo.incrementTagCount(userId, t)),
    ]);
    filtered.tags = newTags;
  }

  // Regenerate embedding if content or context changed
  const contentChanged = 'content' in filtered && filtered.content !== current.content;
  const contextChanged = 'context' in filtered && filtered.context !== current.context;
  if (contentChanged || contextChanged) {
    const newContent = (filtered.content as string) || current.content;
    const newContext = (filtered.context as string | null) || current.context;
    const embedding = await knowledgeRepo.buildEmbeddingUpdate(newContent, newContext);
    if (embedding) filtered.embedding = embedding;
  }

  filtered.updated_at = new Date().toISOString();
  return knowledgeRepo.updateKnowledgeEntry(userId, id, filtered);
}

export async function deleteKnowledgeEntry(userId: string, id: string): Promise<void> {
  const current = await knowledgeRepo.findKnowledgeEntrySnapshot(userId, id);
  if (!current) throw Object.assign(new Error('Entry not found'), { statusCode: 404 });

  // Decrement all tag counts before deleting
  await Promise.all(
    (current.tags || []).map((t) => knowledgeRepo.decrementTagCount(userId, t)),
  );

  await knowledgeRepo.deleteKnowledgeEntry(userId, id);
}

// ─── Error helper used by routes ───────────────────────────────────────────

export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}
