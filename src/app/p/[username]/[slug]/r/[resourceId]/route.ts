// API Route: External Resource Redirect
// GET /p/[username]/[slug]/r/[resourceId] - Log click and redirect to external URL

import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { isValidUUID } from '@/lib/api/errors';

interface RouteParams {
  params: Promise<{ username: string; slug: string; resourceId: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  const { username, slug, resourceId } = await params;

  // Validate resourceId
  if (!isValidUUID(resourceId)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  const supabase = createSupabaseAdminClient();

  // Find user by username
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single();

  if (!user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Find published funnel
  const { data: funnel } = await supabase
    .from('funnel_pages')
    .select('id, library_id')
    .eq('user_id', user.id)
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!funnel) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Get external resource
  const { data: resource } = await supabase
    .from('external_resources')
    .select('id, url, user_id')
    .eq('id', resourceId)
    .single();

  if (!resource || resource.user_id !== user.id) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Log the click
  const clickData: Record<string, string | null> = {
    external_resource_id: resourceId,
    funnel_page_id: funnel.id,
  };

  if (funnel.library_id) {
    clickData.library_id = funnel.library_id;
  }

  // Insert click record (don't await - fire and forget)
  supabase.from('external_resource_clicks').insert(clickData).then();

  // Redirect to external URL
  return NextResponse.redirect(resource.url);
}
