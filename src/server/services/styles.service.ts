/**
 * Writing Styles Service
 * Business logic for cp_writing_styles; calls AI and integrations.
 * Never imports from Next.js HTTP layer.
 */

import * as stylesRepo from "@/server/repositories/styles.repo";
import { extractWritingStyle } from "@/lib/ai/style-extractor";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { scrapeProfilePosts } from "@/lib/integrations/apify-engagers";
import type { WritingStyle } from "@/lib/types/content-pipeline";
import type { ExtractedStyle } from "@/lib/ai/style-extractor";

/** Normalize LinkedIn URL (slug, /in/slug, or full URL). */
export function normalizeLinkedInUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("/in/")) {
    return `https://www.linkedin.com${trimmed}`;
  }
  if (trimmed.startsWith("in/")) {
    return `https://www.linkedin.com/${trimmed}`;
  }
  if (!trimmed.includes("/") && !trimmed.includes(".")) {
    return `https://www.linkedin.com/in/${trimmed}`;
  }
  return trimmed;
}

export async function getStyles(userId: string): Promise<WritingStyle[]> {
  return stylesRepo.findStylesByUserId(userId, true);
}

export async function getStyleById(
  userId: string,
  id: string,
): Promise<WritingStyle | null> {
  return stylesRepo.findStyleById(userId, id);
}

const ALLOWED_UPDATE_FIELDS: (keyof stylesRepo.StyleUpdateInput)[] = [
  "name",
  "description",
  "style_profile",
  "example_posts",
  "is_active",
];

export async function updateStyle(
  userId: string,
  id: string,
  body: Record<string, unknown>,
): Promise<WritingStyle> {
  const updates: stylesRepo.StyleUpdateInput = {};
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (field in body) {
      (updates as Record<string, unknown>)[field] = body[field];
    }
  }
  if (Object.keys(updates).length === 0) {
    const err = Object.assign(new Error("No valid fields to update"), {
      statusCode: 400,
    });
    throw err;
  }
  updates.last_updated_at = new Date().toISOString();
  return stylesRepo.updateStyle(userId, id, updates);
}

export async function deleteStyle(userId: string, id: string): Promise<void> {
  return stylesRepo.deleteStyle(userId, id);
}

async function buildStyleRow(
  userId: string,
  extracted: ExtractedStyle,
  options: {
    source_linkedin_url?: string | null;
    source_posts_analyzed: number;
  },
): Promise<{ row: stylesRepo.StyleInsertInput; embedding: number[] | null }> {
  let embedding: number[] | null = null;
  try {
    const embeddingText = `Style: ${extracted.name}. ${extracted.description}. Tone: ${extracted.style_profile.tone}. Patterns: ${extracted.style_profile.hook_patterns.join(", ")}`;
    embedding = await generateEmbedding(embeddingText);
  } catch {
    // continue without embedding
  }

  const row: stylesRepo.StyleInsertInput = {
    user_id: userId,
    name: extracted.name,
    description: extracted.description,
    source_linkedin_url: options.source_linkedin_url ?? null,
    source_posts_analyzed: options.source_posts_analyzed,
    style_profile: extracted.style_profile,
    example_posts: extracted.example_posts,
  };
  if (embedding) {
    row.embedding = JSON.stringify(embedding);
  }
  return { row, embedding };
}

export interface ExtractFromPostsResult {
  style: WritingStyle;
  key_patterns: string[];
  recommendations: string[];
}

export async function extractFromPostsAndCreate(
  userId: string,
  input: {
    posts: string[];
    author_name?: string | null;
    author_headline?: string | null;
    source_linkedin_url?: string | null;
  },
): Promise<ExtractFromPostsResult> {
  const extracted = await extractWritingStyle({
    posts: input.posts,
    authorName: input.author_name ?? undefined,
    authorHeadline: input.author_headline ?? undefined,
  });

  const { row } = await buildStyleRow(userId, extracted, {
    source_linkedin_url: input.source_linkedin_url,
    source_posts_analyzed: input.posts.length,
  });

  const style = await stylesRepo.createStyle(row);
  return {
    style,
    key_patterns: extracted.key_patterns,
    recommendations: extracted.recommendations,
  };
}

export interface ExtractFromUrlResult {
  style: WritingStyle;
  key_patterns: string[];
  recommendations: string[];
  posts_analyzed: number;
}

export async function extractFromUrlAndCreate(
  userId: string,
  input: {
    linkedin_url: string;
    author_name?: string | null;
  },
): Promise<ExtractFromUrlResult> {
  const normalizedUrl = normalizeLinkedInUrl(input.linkedin_url);

  const { data: posts, error: scrapeError } = await scrapeProfilePosts(
    normalizedUrl,
    10,
  );
  if (scrapeError) {
    const err = Object.assign(
      new Error(`Failed to scrape profile: ${scrapeError}`),
      { statusCode: 502 },
    );
    throw err;
  }

  const textPosts = posts.filter((p) => p.text && p.text.trim().length > 50);
  if (textPosts.length < 3) {
    const err = Object.assign(
      new Error(
        `Only found ${textPosts.length} text posts (need at least 3). The profile may not have enough public posts.`,
      ),
      { statusCode: 422 },
    );
    throw err;
  }

  const firstPost = textPosts[0];
  const authorName =
    input.author_name ||
    firstPost.authorName ||
    `${firstPost.author?.firstName ?? ""} ${firstPost.author?.lastName ?? ""}`.trim();
  const authorHeadline = firstPost.author?.occupation;

  const extracted = await extractWritingStyle({
    posts: textPosts.map((p) => p.text),
    authorName: authorName || undefined,
    authorHeadline,
  });

  const { row } = await buildStyleRow(userId, extracted, {
    source_linkedin_url: normalizedUrl,
    source_posts_analyzed: textPosts.length,
  });

  const style = await stylesRepo.createStyle(row);
  return {
    style,
    key_patterns: extracted.key_patterns,
    recommendations: extracted.recommendations,
    posts_analyzed: textPosts.length,
  };
}

export function getStatusCode(err: unknown): number {
  if (err && typeof err === "object" && "statusCode" in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}
