import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

// GET /api/teams — fetch the current user's team (auto-creates if none)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  const supabase = createSupabaseAdminClient();
  const userId = session.user.id;

  // Fetch existing team
  const { data: team, error } = await supabase
    .from('teams')
    .select('*')
    .eq('owner_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    logApiError('teams-get', error, { userId });
    return ApiErrors.databaseError();
  }

  if (!team) {
    return NextResponse.json({ team: null });
  }

  return NextResponse.json({ team });
}

// POST /api/teams — create the user's team
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  let body: { name?: string; description?: string; industry?: string; target_audience?: string; shared_goal?: string };
  try {
    body = await request.json();
  } catch {
    return ApiErrors.validationError('Invalid JSON');
  }

  const name = body.name?.trim();
  if (!name) {
    return ApiErrors.validationError('Team name is required');
  }

  const supabase = createSupabaseAdminClient();
  const userId = session.user.id;

  // Check if team already exists
  const { data: existing } = await supabase
    .from('teams')
    .select('id')
    .eq('owner_id', userId)
    .single();

  if (existing) {
    return ApiErrors.conflict('You already have a team');
  }

  // Create team
  const { data: team, error } = await supabase
    .from('teams')
    .insert({
      owner_id: userId,
      name,
      description: body.description?.trim() || null,
      industry: body.industry?.trim() || null,
      target_audience: body.target_audience?.trim() || null,
      shared_goal: body.shared_goal?.trim() || null,
    })
    .select('*')
    .single();

  if (error) {
    logApiError('teams-create', error, { userId });
    return ApiErrors.databaseError();
  }

  // Auto-create default profile for owner
  const { data: user } = await supabase
    .from('users')
    .select('email, name, avatar_url')
    .eq('id', userId)
    .single();

  await supabase
    .from('team_profiles')
    .insert({
      team_id: team.id,
      user_id: userId,
      email: user?.email || session.user.email,
      full_name: user?.name || session.user.name || 'Owner',
      role: 'owner',
      status: 'active',
      is_default: true,
      accepted_at: new Date().toISOString(),
    });

  return NextResponse.json({ team }, { status: 201 });
}

// PATCH /api/teams — update team settings
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  let body: { name?: string; description?: string; industry?: string; target_audience?: string; shared_goal?: string };
  try {
    body = await request.json();
  } catch {
    return ApiErrors.validationError('Invalid JSON');
  }

  const supabase = createSupabaseAdminClient();
  const userId = session.user.id;

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (body.industry !== undefined) updates.industry = body.industry?.trim() || null;
  if (body.target_audience !== undefined) updates.target_audience = body.target_audience?.trim() || null;
  if (body.shared_goal !== undefined) updates.shared_goal = body.shared_goal?.trim() || null;

  const { data: team, error } = await supabase
    .from('teams')
    .update(updates)
    .eq('owner_id', userId)
    .select('*')
    .single();

  if (error) {
    logApiError('teams-update', error, { userId });
    return ApiErrors.databaseError();
  }

  return NextResponse.json({ team });
}
