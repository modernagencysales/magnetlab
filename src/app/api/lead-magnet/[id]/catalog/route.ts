import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  const { id } = await params;
  if (!isValidUUID(id)) {
    return ApiErrors.validationError('Invalid lead magnet ID');
  }

  let body: { pain_point?: string; target_audience?: string; short_description?: string };
  try {
    body = await request.json();
  } catch {
    return ApiErrors.validationError('Invalid JSON');
  }

  const updates: Record<string, string | null> = {};
  if ('pain_point' in body) updates.pain_point = body.pain_point?.trim() || null;
  if ('target_audience' in body) updates.target_audience = body.target_audience?.trim() || null;
  if ('short_description' in body) updates.short_description = body.short_description?.trim() || null;

  if (Object.keys(updates).length === 0) {
    return ApiErrors.validationError('No fields to update');
  }

  const supabase = createSupabaseAdminClient();

  // Verify ownership
  const { data: magnet } = await supabase
    .from('lead_magnets')
    .select('id, user_id')
    .eq('id', id)
    .single();

  if (!magnet) {
    return ApiErrors.notFound('Lead magnet');
  }

  if (magnet.user_id !== session.user.id) {
    return ApiErrors.forbidden();
  }

  const { error } = await supabase
    .from('lead_magnets')
    .update(updates)
    .eq('id', id);

  if (error) {
    logApiError('catalog-update', error, { userId: session.user.id, magnetId: id });
    return ApiErrors.databaseError();
  }

  return NextResponse.json({ success: true });
}
