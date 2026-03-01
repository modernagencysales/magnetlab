/**
 * Performance Service
 * Business logic for performance metrics and patterns.
 */

import * as performanceRepo from "@/server/repositories/performance.repo";
import {
  analyzePerformancePatterns,
  getTopPerformingAttributes,
  generatePerformanceInsights,
} from "@/lib/ai/content-pipeline/performance-analyzer";
import type { PerformanceRow, InsertPerformanceInput } from "@/server/repositories/performance.repo";

export interface SubmitPerformanceInput {
  post_id: string;
  platform?: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  clicks?: number;
  impressions?: number;
  engagement_rate?: number;
  captured_at?: string;
}

export async function submitPerformance(
  userId: string,
  input: SubmitPerformanceInput,
): Promise<PerformanceRow> {
  const post = await performanceRepo.findPostOwnership(userId, input.post_id);
  if (!post) {
    const err = Object.assign(new Error("Post not found"), { statusCode: 404 });
    throw err;
  }

  let engagementRate = input.engagement_rate;
  if (
    engagementRate === undefined &&
    input.views &&
    input.views > 0
  ) {
    const total =
      (input.likes ?? 0) +
      (input.comments ?? 0) +
      (input.shares ?? 0) +
      (input.saves ?? 0);
    engagementRate = (total / input.views) * 100;
  }

  const insert: InsertPerformanceInput = {
    user_id: userId,
    post_id: input.post_id,
    platform: input.platform ?? "linkedin",
    views: input.views ?? 0,
    likes: input.likes ?? 0,
    comments: input.comments ?? 0,
    shares: input.shares ?? 0,
    saves: input.saves ?? 0,
    clicks: input.clicks ?? 0,
    impressions: input.impressions ?? 0,
    engagement_rate: engagementRate ?? 0,
    captured_at: input.captured_at ?? new Date().toISOString(),
  };

  try {
    return await performanceRepo.insertPerformance(insert);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("23505")) {
      const conflict = Object.assign(
        new Error("Performance data already captured for this post at this timestamp"),
        { statusCode: 409 },
      );
      throw conflict;
    }
    throw err;
  }
}

export interface GetPerformanceResult {
  performance: PerformanceRow[];
  aggregates: ReturnType<typeof computeAggregates>;
}

export async function getPerformance(
  userId: string,
  filters: performanceRepo.PerformanceFilters,
): Promise<GetPerformanceResult> {
  const performance = await performanceRepo.findPerformance(userId, filters);
  const aggregates = computeAggregates(performance);
  return { performance, aggregates };
}

function computeAggregates(
  records: Array<{
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    clicks: number;
    impressions: number;
    engagement_rate: number;
  }>,
) {
  if (records.length === 0) {
    return {
      total_posts: 0,
      avg_views: 0,
      avg_likes: 0,
      avg_comments: 0,
      avg_engagement_rate: 0,
      total_views: 0,
      total_likes: 0,
      total_comments: 0,
      total_shares: 0,
    };
  }
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const avg = (arr: number[]) => (arr.length > 0 ? sum(arr) / arr.length : 0);
  return {
    total_posts: records.length,
    avg_views: Math.round(avg(records.map((r) => r.views))),
    avg_likes: Math.round(avg(records.map((r) => r.likes))),
    avg_comments: Math.round(avg(records.map((r) => r.comments))),
    avg_engagement_rate: Number(
      avg(records.map((r) => Number(r.engagement_rate))).toFixed(4),
    ),
    total_views: sum(records.map((r) => r.views)),
    total_likes: sum(records.map((r) => r.likes)),
    total_comments: sum(records.map((r) => r.comments)),
    total_shares: sum(records.map((r) => r.shares)),
  };
}

export async function getPatterns(
  userId: string,
  options: { patternType?: string; includeInsights?: boolean },
) {
  const patterns = await performanceRepo.findPatterns(
    userId,
    options.patternType,
  );
  let insights: unknown = null;
  if (options.includeInsights && patterns.length > 0) {
    try {
      insights = await generatePerformanceInsights(userId);
    } catch {
      // non-fatal
    }
  }
  const topAttributes = await getTopPerformingAttributes(userId);
  return { patterns, topAttributes, insights };
}

export async function runPatternAnalysis(userId: string) {
  return analyzePerformancePatterns(userId);
}
