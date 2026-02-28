/**
 * Scraper Repository (cp_scrape_runs, cp_viral_posts, cp_post_templates)
 */

import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";

const RUN_COLUMNS =
  "id, user_id, target_url, status, posts_found, error_message, started_at, completed_at, created_at";

const VIRAL_POST_COLUMNS =
  "id, user_id, scrape_run_id, author_name, author_headline, author_url, content, likes, comments, shares, views, percentile_rank, extracted_template_id, created_at";

export interface ScrapeRunRow {
  id: string;
  user_id: string;
  target_url: string | null;
  status: string;
  posts_found: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ViralPostRow {
  id: string;
  user_id: string;
  scrape_run_id: string | null;
  author_name: string | null;
  author_headline: string | null;
  author_url: string | null;
  content: string;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  percentile_rank: number | null;
  extracted_template_id: string | null;
  created_at: string;
}

export async function findRunsAndPosts(userId: string): Promise<{
  runs: ScrapeRunRow[];
  posts: ViralPostRow[];
}> {
  const supabase = createSupabaseAdminClient();
  const [runsRes, postsRes] = await Promise.all([
    supabase
      .from("cp_scrape_runs")
      .select(RUN_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("cp_viral_posts")
      .select(VIRAL_POST_COLUMNS)
      .eq("user_id", userId)
      .order("likes", { ascending: false })
      .limit(50),
  ]);
  if (runsRes.error) throw new Error(`scraper.findRuns: ${runsRes.error.message}`);
  if (postsRes.error) throw new Error(`scraper.findPosts: ${postsRes.error.message}`);
  return {
    runs: (runsRes.data ?? []) as ScrapeRunRow[],
    posts: (postsRes.data ?? []) as ViralPostRow[],
  };
}

export interface CreateRunInput {
  user_id: string;
  target_url?: string | null;
  status: string;
  posts_found: number;
  started_at: string;
  completed_at: string;
}

export interface ViralPostInput {
  user_id: string;
  scrape_run_id: string;
  author_name?: string | null;
  author_headline?: string | null;
  author_url?: string | null;
  content: string;
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
}

export async function createRun(input: CreateRunInput): Promise<ScrapeRunRow> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cp_scrape_runs")
    .insert({
      user_id: input.user_id,
      target_url: input.target_url ?? null,
      status: input.status,
      posts_found: input.posts_found,
      started_at: input.started_at,
      completed_at: input.completed_at,
    })
    .select(RUN_COLUMNS)
    .single();
  if (error) throw new Error(`scraper.createRun: ${error.message}`);
  return data as ScrapeRunRow;
}

export async function createViralPosts(
  rows: ViralPostInput[],
): Promise<ViralPostRow[]> {
  const supabase = createSupabaseAdminClient();
  const insertRows = rows.map((p) => ({
    user_id: p.user_id,
    scrape_run_id: p.scrape_run_id,
    author_name: p.author_name ?? null,
    author_headline: p.author_headline ?? null,
    author_url: p.author_url ?? null,
    content: p.content,
    likes: p.likes ?? 0,
    comments: p.comments ?? 0,
    shares: p.shares ?? 0,
    views: p.views ?? 0,
  }));
  const { data, error } = await supabase
    .from("cp_viral_posts")
    .insert(insertRows)
    .select(VIRAL_POST_COLUMNS);
  if (error) throw new Error(`scraper.createViralPosts: ${error.message}`);
  return (data ?? []) as ViralPostRow[];
}

export interface TemplateInsertInput {
  user_id: string;
  name: string;
  category: string;
  structure: unknown;
  use_cases: string[];
  tags: string[];
  embedding?: string;
}

export async function createTemplate(
  input: TemplateInsertInput,
): Promise<Record<string, unknown>> {
  const supabase = createSupabaseAdminClient();
  const row: Record<string, unknown> = {
    user_id: input.user_id,
    name: input.name,
    category: input.category,
    structure: input.structure,
    use_cases: input.use_cases,
    tags: input.tags,
  };
  if (input.embedding) row.embedding = input.embedding;
  const { data, error } = await supabase
    .from("cp_post_templates")
    .insert(row)
    .select(
      "id, user_id, name, category, description, structure, example_posts, use_cases, tags, usage_count, avg_engagement_score, is_active, created_at, updated_at",
    )
    .single();
  if (error) throw new Error(`scraper.createTemplate: ${error.message}`);
  return data as Record<string, unknown>;
}

export async function updateViralPostTemplate(
  userId: string,
  viralPostId: string,
  templateId: string,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("cp_viral_posts")
    .update({ extracted_template_id: templateId })
    .eq("id", viralPostId)
    .eq("user_id", userId);
  if (error) throw new Error(`scraper.updateViralPostTemplate: ${error.message}`);
}
