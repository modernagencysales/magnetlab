import { NextResponse, NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import * as teamsService from '@/server/services/teams.service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid profile ID');

    let body: {
      full_name?: string;
      title?: string;
      email?: string;
      linkedin_url?: string;
      bio?: string;
      expertise_areas?: string[];
      voice_profile?: Record<string, unknown>;
      avatar_url?: string;
    };
    try {
      body = await request.json();
    } catch {
      return ApiErrors.validationError('Invalid JSON');
    }

    const result = await teamsService.updateProfile(session.user.id, id, {
      full_name: body.full_name,
      title: body.title,
      email: body.email,
      linkedin_url: body.linkedin_url,
      bio: body.bio,
      expertise_areas: body.expertise_areas,
      voice_profile: body.voice_profile,
      avatar_url: body.avatar_url,
    });

    if (result.error === 'NOT_FOUND') return ApiErrors.notFound('Profile');
    if (result.error === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    return NextResponse.json(result);
  } catch (error) {
    logApiError('profiles-update', error, { userId: (await auth())?.user?.id });
    return ApiErrors.databaseError();
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid profile ID');

    const result = await teamsService.deleteProfile(session.user.id, id);
    if (result.error === 'NOT_FOUND') return ApiErrors.notFound('Profile');
    if (result.error === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    if (result.error === 'VALIDATION') return ApiErrors.validationError(result.message);

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('profiles-delete', error, { userId: (await auth())?.user?.id });
    return ApiErrors.databaseError();
  }
}
