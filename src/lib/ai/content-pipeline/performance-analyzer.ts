import { getAnthropicClient, parseJsonResponse } from './anthropic-client';
import { CLAUDE_SONNET_MODEL } from './model-config';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ============================================
// Types
// ============================================

export interface PerformancePattern {
  pattern_type: string;
  pattern_value: string;
  avg_engagement_rate: number;
  avg_views: number;
  avg_likes: number;
  avg_comments: number;
  sample_count: number;
  confidence: 'low' | 'medium' | 'high';
}

export interface TopAttribute {
  attribute: string;
  value: string;
  avgEngagementRate: number;
  avgViews: number;
  sampleCount: number;
  confidence: 'low' | 'medium' | 'high';
}

export interface PerformanceInsight {
  summary: string;
  topPerforming: string[];
  underperforming: string[];
  recommendations: string[];
  optimalPostingPattern: string | null;
}

export interface PatternAnalysisResult {
  patternsUpdated: number;
  patternsCreated: number;
  totalPostsAnalyzed: number;
}

interface PostWithPerformance {
  id: string;
  draft_content: string | null;
  final_content: string | null;
  variations: unknown;
  hook_score: number | null;
  status: string;
  scheduled_time: string | null;
  published_at: string | null;
  idea_id: string | null;
  created_at: string;
  // Joined performance data
  performance?: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    saves: number;
    clicks: number;
    impressions: number;
    engagement_rate: number;
    captured_at: string;
  }[];
  // Joined idea data
  idea?: {
    content_type: string | null;
    content_pillar: string | null;
    hook: string | null;
  } | null;
}

// ============================================
// Core Analysis Functions
// ============================================

/**
 * Analyze all post performance data and extract/update patterns.
 * Queries published posts with performance data and uses AI to identify patterns.
 */
export async function analyzePerformancePatterns(userId: string): Promise<PatternAnalysisResult> {
  const supabase = createSupabaseAdminClient();

  // Fetch all posts with performance data
  const { data: posts, error: postsError } = await supabase
    .from('cp_pipeline_posts')
    .select('id, draft_content, final_content, variations, hook_score, status, scheduled_time, published_at, idea_id, created_at')
    .eq('user_id', userId)
    .eq('status', 'published');

  if (postsError || !posts || posts.length === 0) {
    return { patternsUpdated: 0, patternsCreated: 0, totalPostsAnalyzed: 0 };
  }

  // Fetch performance data for these posts
  const postIds = posts.map((p) => p.id);
  const { data: perfData } = await supabase
    .from('cp_post_performance')
    .select('post_id, views, likes, comments, shares, saves, clicks, impressions, engagement_rate, captured_at')
    .eq('user_id', userId)
    .in('post_id', postIds)
    .order('captured_at', { ascending: false });

  // Fetch associated ideas for content_type and content_pillar
  const ideaIds = posts.map((p) => p.idea_id).filter(Boolean) as string[];
  const { data: ideas } = ideaIds.length > 0
    ? await supabase
        .from('cp_content_ideas')
        .select('id, content_type, content_pillar, hook')
        .in('id', ideaIds)
    : { data: [] };

  // Merge data
  const ideaMap = new Map((ideas || []).map((i) => [i.id, i]));
  const perfMap = new Map<string, typeof perfData>();
  for (const perf of perfData || []) {
    const existing = perfMap.get(perf.post_id) || [];
    existing.push(perf);
    perfMap.set(perf.post_id, existing);
  }

  const enrichedPosts: PostWithPerformance[] = posts
    .map((post) => ({
      ...post,
      performance: perfMap.get(post.id) || [],
      idea: post.idea_id ? ideaMap.get(post.idea_id) || null : null,
    }))
    .filter((p) => p.performance && p.performance.length > 0);

  if (enrichedPosts.length === 0) {
    return { patternsUpdated: 0, patternsCreated: 0, totalPostsAnalyzed: 0 };
  }

  // Extract patterns using local computation (no AI needed for aggregation)
  const patterns = extractPatternsFromData(enrichedPosts);

  // Upsert all patterns in a single DB round-trip
  const now = new Date().toISOString();
  const rows = patterns.map((pattern) => ({
    user_id: userId,
    pattern_type: pattern.pattern_type,
    pattern_value: pattern.pattern_value,
    avg_engagement_rate: pattern.avg_engagement_rate,
    avg_views: pattern.avg_views,
    avg_likes: pattern.avg_likes,
    avg_comments: pattern.avg_comments,
    sample_count: pattern.sample_count,
    confidence: getConfidence(pattern.sample_count),
    last_updated_at: now,
  }));

  const { data: upserted } = await supabase
    .from('cp_performance_patterns')
    .upsert(rows, { onConflict: 'user_id, pattern_type, pattern_value' })
    .select('id');

  return {
    patternsUpdated: 0, // upsert doesn't distinguish created vs updated
    patternsCreated: upserted?.length ?? rows.length,
    totalPostsAnalyzed: enrichedPosts.length,
  };
}

/**
 * Get which archetypes, hooks, formats, and topics perform best for a user.
 */
export async function getTopPerformingAttributes(userId: string): Promise<Record<string, TopAttribute[]>> {
  const supabase = createSupabaseAdminClient();

  const { data: patterns, error } = await supabase
    .from('cp_performance_patterns')
    .select('pattern_type, pattern_value, avg_engagement_rate, avg_views, avg_likes, avg_comments, sample_count, confidence')
    .eq('user_id', userId)
    .order('avg_engagement_rate', { ascending: false });

  if (error || !patterns) {
    return {};
  }

  const grouped: Record<string, TopAttribute[]> = {};

  for (const pattern of patterns) {
    const type = pattern.pattern_type;
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push({
      attribute: type,
      value: pattern.pattern_value,
      avgEngagementRate: Number(pattern.avg_engagement_rate),
      avgViews: pattern.avg_views,
      sampleCount: pattern.sample_count,
      confidence: pattern.confidence as 'low' | 'medium' | 'high',
    });
  }

  return grouped;
}

/**
 * Generate AI-powered performance insights summarizing what works and what doesn't.
 */
export async function generatePerformanceInsights(userId: string): Promise<PerformanceInsight> {
  const supabase = createSupabaseAdminClient();

  // Fetch patterns
  const { data: patterns } = await supabase
    .from('cp_performance_patterns')
    .select('pattern_type, pattern_value, avg_engagement_rate, avg_views, avg_likes, avg_comments, sample_count, confidence')
    .eq('user_id', userId)
    .order('avg_engagement_rate', { ascending: false });

  if (!patterns || patterns.length === 0) {
    return {
      summary: 'Not enough data yet. Submit performance metrics for your published posts to get insights.',
      topPerforming: [],
      underperforming: [],
      recommendations: ['Start tracking post performance to build your feedback loop.'],
      optimalPostingPattern: null,
    };
  }

  // Fetch recent post count for context
  const { count: totalPosts } = await supabase
    .from('cp_pipeline_posts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'published');

  const patternSummary = patterns.map((p) =>
    `${p.pattern_type}="${p.pattern_value}": engagement=${p.avg_engagement_rate}%, views=${p.avg_views}, likes=${p.avg_likes}, comments=${p.avg_comments} (n=${p.sample_count}, confidence=${p.confidence})`
  ).join('\n');

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: `Analyze these content performance patterns and generate actionable insights. Be specific and data-driven.

TOTAL PUBLISHED POSTS: ${totalPosts || 0}

PATTERNS:
${patternSummary}

Return ONLY valid JSON:
{
  "summary": "2-3 sentence overview of the user's content performance",
  "topPerforming": ["Specific insight about what works best", "Another insight"],
  "underperforming": ["What's not working and why"],
  "recommendations": ["Actionable next step 1", "Actionable next step 2", "Actionable next step 3"],
  "optimalPostingPattern": "Description of the ideal post formula based on the data, or null if not enough data"
}`,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  return parseJsonResponse<PerformanceInsight>(textContent.text);
}

/**
 * Inject performance data into ideation/writing prompts to bias toward what works.
 * Returns a prompt section to prepend/append to existing prompts.
 */
export async function biasIdeationPrompt(
  basePrompt: string,
  userId: string
): Promise<string> {
  const topAttributes = await getTopPerformingAttributes(userId);

  // Only use medium/high confidence patterns
  const reliablePatterns: string[] = [];

  for (const [type, attrs] of Object.entries(topAttributes)) {
    const reliable = attrs.filter((a) => a.confidence !== 'low');
    if (reliable.length > 0) {
      const best = reliable[0];
      reliablePatterns.push(
        `Best performing ${type}: "${best.value}" (avg ${best.avgEngagementRate.toFixed(2)}% engagement, ${best.sampleCount} posts)`
      );
    }
  }

  if (reliablePatterns.length === 0) {
    return basePrompt;
  }

  const performanceSection = `
PERFORMANCE DATA (bias toward these proven patterns):
${reliablePatterns.join('\n')}

Use this data to inform your content choices. Lean toward formats, hooks, and topics that have demonstrated strong engagement for this creator. Do not blindly repeat — use these patterns as a starting point and add variety.

`;

  return performanceSection + basePrompt;
}

// ============================================
// Internal Helper Functions
// ============================================

function getConfidence(sampleCount: number): 'low' | 'medium' | 'high' {
  if (sampleCount >= 15) return 'high';
  if (sampleCount >= 5) return 'medium';
  return 'low';
}

interface AggregatedPattern {
  pattern_type: string;
  pattern_value: string;
  avg_engagement_rate: number;
  avg_views: number;
  avg_likes: number;
  avg_comments: number;
  sample_count: number;
}

function extractPatternsFromData(posts: PostWithPerformance[]): AggregatedPattern[] {
  const buckets = new Map<string, { views: number[]; likes: number[]; comments: number[]; engagement: number[] }>();

  function addToBucket(key: string, perf: { views: number; likes: number; comments: number; engagement_rate: number }) {
    if (!buckets.has(key)) {
      buckets.set(key, { views: [], likes: [], comments: [], engagement: [] });
    }
    const bucket = buckets.get(key)!;
    bucket.views.push(perf.views);
    bucket.likes.push(perf.likes);
    bucket.comments.push(perf.comments);
    bucket.engagement.push(Number(perf.engagement_rate));
  }

  for (const post of posts) {
    // Use the most recent performance snapshot
    const perf = post.performance?.[0];
    if (!perf) continue;

    // Content type pattern
    if (post.idea?.content_type) {
      addToBucket(`content_type:${post.idea.content_type}`, perf);
    }

    // Content pillar pattern
    if (post.idea?.content_pillar) {
      addToBucket(`content_pillar:${post.idea.content_pillar}`, perf);
    }

    // Post length pattern
    const content = post.final_content || post.draft_content || '';
    const wordCount = content.split(/\s+/).length;
    const lengthBucket = wordCount < 100 ? 'short' : wordCount < 300 ? 'medium' : 'long';
    addToBucket(`length:${lengthBucket}`, perf);

    // Time of day pattern (from scheduled_time or published_at)
    const timestamp = post.published_at || post.scheduled_time;
    if (timestamp) {
      const hour = new Date(timestamp).getUTCHours();
      const timeBucket = hour < 6 ? 'early_morning' : hour < 10 ? 'morning' : hour < 14 ? 'midday' : hour < 18 ? 'afternoon' : 'evening';
      addToBucket(`time_of_day:${timeBucket}`, perf);
    }

    // Hook type detection (simple heuristic)
    const firstLine = content.split('\n')[0] || '';
    const hookType = detectHookType(firstLine);
    if (hookType) {
      addToBucket(`hook:${hookType}`, perf);
    }

    // Format detection
    const format = detectFormat(content);
    if (format) {
      addToBucket(`format:${format}`, perf);
    }
  }

  // Convert buckets to patterns
  const patterns: AggregatedPattern[] = [];

  for (const [key, data] of buckets) {
    const [type, value] = key.split(':');
    const count = data.views.length;
    if (count === 0) continue;

    patterns.push({
      pattern_type: type,
      pattern_value: value,
      avg_engagement_rate: avg(data.engagement),
      avg_views: Math.round(avg(data.views)),
      avg_likes: Math.round(avg(data.likes)),
      avg_comments: Math.round(avg(data.comments)),
      sample_count: count,
    });
  }

  return patterns;
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, v) => sum + v, 0) / arr.length;
}

function detectHookType(firstLine: string): string | null {
  const lower = firstLine.toLowerCase().trim();
  if (!lower) return null;

  if (/^\d/.test(lower)) return 'number_hook';
  if (lower.endsWith('?')) return 'question';
  if (/^i\s/.test(lower)) return 'personal_story';
  if (/^(stop|don't|never|the biggest|the real|most people)/.test(lower)) return 'bold_statement';
  if (/\$[\d,]+/.test(lower) || /\d+%/.test(lower)) return 'statistic';

  return 'other';
}

function detectFormat(content: string): string | null {
  const lines = content.split('\n').filter((l) => l.trim());
  if (lines.length === 0) return null;

  // Check for numbered list
  const numberedLines = lines.filter((l) => /^\d+[\.\)]\s/.test(l.trim()));
  if (numberedLines.length >= 3) return 'numbered_list';

  // Check for bullet points
  const bulletLines = lines.filter((l) => /^[\-\*\u2022]\s/.test(l.trim()));
  if (bulletLines.length >= 3) return 'bullet_list';

  // Short vs long
  const wordCount = content.split(/\s+/).length;
  if (wordCount < 80) return 'short_form';
  if (wordCount > 300) return 'long_form';

  return 'paragraph';
}
