import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import {
  analyzePerformancePatterns,
  getTopPerformingAttributes,
  generatePerformanceInsights,
} from '@/lib/ai/content-pipeline/performance-analyzer';

/**
 * GET /api/content-pipeline/performance/patterns
 * Get extracted performance patterns (what works for this user).
 * Query params: type (pattern_type filter), include_insights (boolean)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { searchParams } = request.nextUrl;
    const patternType = searchParams.get('type');
    const includeInsights = searchParams.get('include_insights') === 'true';

    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('cp_performance_patterns')
      .select('id, user_id, pattern_type, pattern_value, avg_engagement_rate, avg_views, avg_likes, avg_comments, sample_count, confidence, last_updated_at, created_at')
      .eq('user_id', session.user.id)
      .order('avg_engagement_rate', { ascending: false });

    const VALID_TYPES = ['archetype', 'hook', 'format', 'topic', 'time_of_day', 'content_pillar', 'content_type', 'length'];
    if (patternType) {
      if (!VALID_TYPES.includes(patternType)) {
        return ApiErrors.validationError(`Invalid pattern type. Must be one of: ${VALID_TYPES.join(', ')}`);
      }
      query = query.eq('pattern_type', patternType);
    }

    const { data: patterns, error } = await query;

    if (error) {
      logApiError('content-pipeline/performance/patterns', error);
      return ApiErrors.databaseError('Failed to fetch performance patterns');
    }

    // Optionally include AI-generated insights
    let insights = null;
    if (includeInsights && patterns && patterns.length > 0) {
      try {
        insights = await generatePerformanceInsights(session.user.id);
      } catch (insightsError) {
        logApiError('content-pipeline/performance/patterns/insights', insightsError);
        // Non-fatal: return patterns without insights
      }
    }

    // Group by pattern type for easier consumption
    const topAttributes = await getTopPerformingAttributes(session.user.id);

    return NextResponse.json({
      patterns: patterns || [],
      topAttributes,
      insights,
    });
  } catch (error) {
    logApiError('content-pipeline/performance/patterns', error);
    return ApiErrors.internalError();
  }
}

/**
 * POST /api/content-pipeline/performance/patterns
 * Trigger pattern re-analysis. Analyzes all performance data and updates patterns.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const result = await analyzePerformancePatterns(session.user.id);

    return NextResponse.json({
      message: 'Pattern analysis complete',
      ...result,
    });
  } catch (error) {
    logApiError('content-pipeline/performance/patterns', error);
    return ApiErrors.internalError();
  }
}
