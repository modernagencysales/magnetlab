import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { analyzeCompetitorContent } from '@/lib/ai/lead-magnet-generator';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import type { BusinessContext } from '@/lib/types/lead-magnet';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string') {
      return ApiErrors.validationError('Content is required and must be a string');
    }

    if (content.length < 50) {
      return ApiErrors.validationError('Content too short. Please provide at least 50 characters.');
    }

    if (content.length > 20000) {
      return ApiErrors.validationError('Content too long. Maximum 20,000 characters.');
    }

    // Optionally fetch user's brand kit for context
    let businessContext: BusinessContext | undefined;
    try {
      const supabase = createSupabaseAdminClient();
      const { data: brandKit } = await supabase
        .from('brand_kits')
        .select('id, user_id, business_description, business_type, credibility_markers, sender_name, saved_ideation_result, ideation_generated_at, urgent_pains, templates, processes, tools, frequent_questions, results, success_example, audience_tools, preferred_tone, style_profile, best_video_url, best_video_title, content_links, community_url, created_at, updated_at')
        .eq('user_id', session.user.id)
        .single();

      if (brandKit) {
        businessContext = {
          businessDescription: brandKit.business_description || '',
          businessType: brandKit.business_type || 'coach-consultant',
          credibilityMarkers: brandKit.credibility_markers || [],
          urgentPains: brandKit.urgent_pains || [],
          templates: brandKit.templates || [],
          processes: brandKit.processes || [],
          tools: brandKit.tools || [],
          frequentQuestions: brandKit.frequent_questions || [],
          results: brandKit.results || [],
          successExample: brandKit.success_example,
        };
      }
    } catch {
      // Continue without business context
    }

    const analysis = await analyzeCompetitorContent(content, businessContext);

    return NextResponse.json({ analysis });
  } catch (error) {
    logApiError('lead-magnet/analyze-competitor', error);
    return ApiErrors.aiError('Failed to analyze content');
  }
}
