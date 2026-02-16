// API Route: Brand Kit CRUD
// GET /api/brand-kit - Get current user's brand kit
// POST /api/brand-kit - Create/update brand kit

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

// GET - Get brand kit
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('brand_kits')
      .select('id, user_id, business_description, business_type, credibility_markers, sender_name, saved_ideation_result, ideation_generated_at, urgent_pains, templates, processes, tools, frequent_questions, results, success_example, audience_tools, preferred_tone, style_profile, best_video_url, best_video_title, content_links, community_url, created_at, updated_at')
      .eq('user_id', session.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      logApiError('brand-kit/get', error, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to fetch brand kit');
    }

    // Return both brand kit and saved ideation
    const response = NextResponse.json({
      brandKit: data || null,
      savedIdeation: data?.saved_ideation_result || null,
      ideationGeneratedAt: data?.ideation_generated_at || null,
    });
    response.headers.set('Cache-Control', 'private, max-age=120, stale-while-revalidate=240');
    return response;
  } catch (error) {
    logApiError('brand-kit/get', error);
    return ApiErrors.internalError('Failed to fetch brand kit');
  }
}

// POST - Create or update brand kit
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    const brandKitData = {
      user_id: session.user.id,
      business_description: body.businessDescription,
      business_type: body.businessType,
      credibility_markers: body.credibilityMarkers || [],
      urgent_pains: body.urgentPains || [],
      templates: body.templates || [],
      processes: body.processes || [],
      tools: body.tools || [],
      frequent_questions: body.frequentQuestions || [],
      results: body.results || [],
      success_example: body.successExample,
      audience_tools: body.audienceTools || [],
      preferred_tone: body.preferredTone || 'conversational',
      style_profile: body.styleProfile,
    };

    const { data, error } = await supabase
      .from('brand_kits')
      .upsert(brandKitData, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      logApiError('brand-kit/save', error, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to save brand kit');
    }

    return NextResponse.json(data);
  } catch (error) {
    logApiError('brand-kit/save', error);
    return ApiErrors.internalError('Failed to save brand kit');
  }
}
