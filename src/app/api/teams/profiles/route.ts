import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as teamsService from '@/server/services/teams.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const result = await teamsService.listProfiles(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    logApiError('profiles-list', error, { userId: (await auth())?.user?.id });
    return ApiErrors.databaseError();
  }
}

export async function POST(request: NextRequest) {
  try {
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
    if (!fullName) return ApiErrors.validationError('Full name is required');

    const result = await teamsService.createProfile(session.user.id, {
      full_name: fullName,
      email: body.email,
      title: body.title,
      linkedin_url: body.linkedin_url,
      bio: body.bio,
      expertise_areas: body.expertise_areas,
      voice_profile: body.voice_profile,
    });

    if (result.error === 'NOT_FOUND') return ApiErrors.notFound('Team');
    if (result.error === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    if (result.error === 'CONFLICT') return ApiErrors.conflict('A profile with this email already exists');

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logApiError('profiles-create', error, { userId: (await auth())?.user?.id });
    return ApiErrors.databaseError();
  }
}
