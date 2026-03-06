/**
 * Scraper Service
 */

import { extractTemplateFromPost } from "@/lib/ai/content-pipeline/template-extractor";
import { generateEmbedding, createTemplateEmbeddingText } from "@/lib/ai/embeddings";
import * as scraperRepo from "@/server/repositories/scraper.repo";

export async function getRunsAndPosts(userId: string) {
  return scraperRepo.findRunsAndPosts(userId);
}

export interface ImportPostsInput {
  posts: Array<{
    author_name?: string;
    author_headline?: string;
    author_url?: string;
    content: string;
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
  }>;
  target_url?: string | null;
}

export async function importPosts(
  userId: string,
  input: ImportPostsInput,
): Promise<{ run: scraperRepo.ScrapeRunRow; posts: scraperRepo.ViralPostRow[] }> {
  const now = new Date().toISOString();
  const run = await scraperRepo.createRun({
    user_id: userId,
    target_url: input.target_url ?? null,
    status: "completed",
    posts_found: input.posts.length,
    started_at: now,
    completed_at: now,
  });
  const rows: scraperRepo.ViralPostInput[] = input.posts.map((p) => ({
    user_id: userId,
    scrape_run_id: run.id,
    author_name: p.author_name ?? null,
    author_headline: p.author_headline ?? null,
    author_url: p.author_url ?? null,
    content: p.content,
    likes: p.likes ?? 0,
    comments: p.comments ?? 0,
    shares: p.shares ?? 0,
    views: p.views ?? 0,
  }));
  const posts = await scraperRepo.createViralPosts(rows);
  return { run, posts };
}

export async function extractTemplateAndSave(
  userId: string,
  content: string,
  viralPostId?: string,
): Promise<Record<string, unknown>> {
  const extracted = await extractTemplateFromPost(content);
  let embedding: number[] | null = null;
  try {
    const embeddingText = createTemplateEmbeddingText(extracted);
    embedding = await generateEmbedding(embeddingText);
  } catch {
    // continue without embedding
  }
  const template = await scraperRepo.createTemplate({
    user_id: userId,
    name: extracted.name,
    category: extracted.category,
    structure: extracted.structure,
    use_cases: extracted.use_cases,
    tags: extracted.tags,
    embedding: embedding ? JSON.stringify(embedding) : undefined,
  });
  if (viralPostId && template.id) {
    await scraperRepo.updateViralPostTemplate(userId, viralPostId, template.id as string);
  }
  return template;
}
