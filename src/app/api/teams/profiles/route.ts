import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

// GET /api/teams/profiles — list profiles for the user's team
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  const supabase = createSupabaseAdminClient();
  const userId = session.user.id;

  // Get user's team
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('owner_id', userId)
    .single();

  if (!team) {
    return NextResponse.json({ profiles: [] });
  }

  const { data: profiles, error } = await supabase
    .from('team_profiles')
    .select('*')
    .eq('team_id', team.id)
    .neq('status', 'removed')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    logApiError('profiles-list', error, { userId, teamId: team.id });
    return ApiErrors.databaseError();
  }

  return NextResponse.json({ profiles: profiles || [] });
}

// POST /api/teams/profiles — create a new team profile
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();

  let body: {
    full_name?: string;
    email?: string;
    title?: string;
    linkedin_url?: string;
    bio?: string;
    expertise_areas?: string[];
    voice_profile?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return ApiErrors.validationError('Invalid JSON');
  }

  const fullName = body.full_name?.trim();
  if (!fullName) {
    return ApiErrors.validationError('Full name is required');
  }

  const supabase = createSupabaseAdminClient();
  const userId = session.user.id;

  // Get user's team
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('owner_id', userId)
    .single();

  if (!team) {
    return ApiErrors.notFound('Team');
  }

  const email = body.email?.trim().toLowerCase() || null;

  // Check if email already exists in team
  if (email) {
    const { data: existing } = await supabase
      .from('team_profiles')
      .select('id')
      .eq('team_id', team.id)
      .eq('email', email)
      .single();

    if (existing) {
      return ApiErrors.conflict('A profile with this email already exists');
    }
  }

  // Check if user with this email exists (auto-link)
  let linkedUserId: string | null = null;
  if (email) {
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
    if (existingUser) {
      linkedUserId = existingUser.id;
    }
  }

  const { data: profile, error } = await supabase
    .from('team_profiles')
    .insert({
      team_id: team.id,
      user_id: linkedUserId,
      email,
      full_name: fullName,
      title: body.title?.trim() || null,
      linkedin_url: body.linkedin_url?.trim() || null,
      bio: body.bio?.trim() || null,
      expertise_areas: body.expertise_areas || [],
      voice_profile: body.voice_profile || {},
      role: 'member',
      status: linkedUserId ? 'active' : 'pending',
      invited_at: new Date().toISOString(),
      accepted_at: linkedUserId ? new Date().toISOString() : null,
    })
    .select('*')
    .single();

  if (error) {
    logApiError('profiles-create', error, { userId, teamId: team.id });
    return ApiErrors.databaseError();
  }

  return NextResponse.json({ profile }, { status: 201 });
}
