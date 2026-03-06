/**
 * Content pipeline scraper / viral posts API (client).
 */

import { apiClient } from '../client';

export async function getScraperRunsAndPosts(): Promise<{ runs: unknown[]; posts: unknown[] }> {
  return apiClient.get<{ runs: unknown[]; posts: unknown[] }>('/content-pipeline/scraper');
}

export interface ImportPostsBody {
  posts: unknown[];
  target_url?: string | null;
}

export async function importPosts(body: ImportPostsBody): Promise<{ run: unknown; posts: unknown[] }> {
  return apiClient.post<{ run: unknown; posts: unknown[] }>('/content-pipeline/scraper', body);
}

export async function extractTemplate(body: { content: string; viral_post_id?: string }): Promise<{ template: unknown }> {
  return apiClient.post<{ template: unknown }>('/content-pipeline/scraper/extract-template', body);
}
