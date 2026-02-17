// API Route: User Page Defaults
// GET /api/user/defaults - Get user's default page settings
// PUT /api/user/defaults - Update user's default page settings

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('users')
      .select('default_vsl_url, default_funnel_template')
      .eq('id', session.user.id)
      .single();

    if (error) {
      logApiError('user/defaults/get', error);
      return ApiErrors.databaseError('Failed to fetch defaults');
    }

    return NextResponse.json({
      defaultVslUrl: data.default_vsl_url,
      defaultFunnelTemplate: data.default_funnel_template || 'social_proof',
    });
  } catch (error) {
    logApiError('user/defaults/get', error);
    return ApiErrors.internalError('Failed to fetch defaults');
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { defaultVslUrl, defaultFunnelTemplate } = body;

    // Validate URL format if provided
    if (defaultVslUrl && typeof defaultVslUrl === 'string' && defaultVslUrl.trim()) {
      try {
        const url = new URL(defaultVslUrl);
        const validHosts = ['youtube.com', 'www.youtube.com', 'youtu.be', 'vimeo.com', 'www.vimeo.com', 'loom.com', 'www.loom.com'];
        if (!validHosts.some(host => url.hostname === host || url.hostname.endsWith('.' + host))) {
          return ApiErrors.validationError('Video URL must be from YouTube, Vimeo, or Loom');
        }
      } catch {
        return ApiErrors.validationError('Invalid video URL format');
      }
    }

    // Validate template ID if provided
    const validTemplateIds = ['minimal', 'social_proof', 'authority', 'full_suite'];
    if (defaultFunnelTemplate !== undefined && !validTemplateIds.includes(defaultFunnelTemplate)) {
      return ApiErrors.validationError('Invalid funnel template ID');
    }

    const supabase = createSupabaseAdminClient();

    const updateData: Record<string, unknown> = {
      default_vsl_url: defaultVslUrl?.trim() || null,
    };
    if (defaultFunnelTemplate !== undefined) {
      updateData.default_funnel_template = defaultFunnelTemplate;
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', session.user.id)
      .select('default_vsl_url, default_funnel_template')
      .single();

    if (error) {
      logApiError('user/defaults/update', error, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to update defaults');
    }

    return NextResponse.json({
      defaultVslUrl: data.default_vsl_url,
      defaultFunnelTemplate: data.default_funnel_template,
    });
  } catch (error) {
    logApiError('user/defaults/update', error);
    return ApiErrors.internalError('Failed to update defaults');
  }
}
