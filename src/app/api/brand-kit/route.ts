// API Route: Brand Kit CRUD
// GET /api/brand-kit - Get current user's brand kit
// POST /api/brand-kit - Create/update brand kit

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { getDataScope, applyScope } from '@/lib/utils/team-context';

// GET - Get brand kit
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const scope = await getDataScope(session.user.id);
    const supabase = createSupabaseAdminClient();

    let brandKitQuery = supabase
      .from('brand_kits')
      .select('id, user_id, team_id, business_description, business_type, credibility_markers, sender_name, saved_ideation_result, ideation_generated_at, urgent_pains, templates, processes, tools, frequent_questions, results, success_example, audience_tools, preferred_tone, style_profile, best_video_url, best_video_title, content_links, community_url, logos, default_testimonial, default_steps, default_theme, default_primary_color, default_background_style, logo_url, font_family, font_url, created_at, updated_at');
    brandKitQuery = applyScope(brandKitQuery, scope);
    const { data, error } = await brandKitQuery.single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      logApiError('brand-kit/get', error, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to fetch brand kit');
    }

    // Return both brand kit and saved ideation
    // No browser caching — team context changes the response for the same URL
    return NextResponse.json({
      brandKit: data || null,
      savedIdeation: data?.saved_ideation_result || null,
      ideationGeneratedAt: data?.ideation_generated_at || null,
    });
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
    const scope = await getDataScope(session.user.id);
    const supabase = createSupabaseAdminClient();

    const brandKitData = {
      user_id: session.user.id,
      team_id: scope.teamId || null,
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
      ...(body.logos !== undefined && { logos: body.logos }),
      ...(body.defaultTestimonial !== undefined && { default_testimonial: body.defaultTestimonial }),
      ...(body.defaultSteps !== undefined && { default_steps: body.defaultSteps }),
      ...(body.defaultTheme !== undefined && { default_theme: body.defaultTheme }),
      ...(body.defaultPrimaryColor !== undefined && { default_primary_color: body.defaultPrimaryColor }),
      ...(body.defaultBackgroundStyle !== undefined && { default_background_style: body.defaultBackgroundStyle }),
      ...(body.logoUrl !== undefined && { logo_url: body.logoUrl }),
      ...(body.fontFamily !== undefined && { font_family: body.fontFamily }),
      ...(body.fontUrl !== undefined && { font_url: body.fontUrl }),
    };

    // In team mode, upsert by team_id; in personal mode, upsert by user_id
    const onConflict = scope.type === 'team' ? 'team_id' : 'user_id';

    const { data, error } = await supabase
      .from('brand_kits')
      .upsert(brandKitData, { onConflict })
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
