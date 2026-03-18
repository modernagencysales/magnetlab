/**
 * Teams Members API — GET, POST, DELETE /api/teams/members
 * GET: List active members of a team (requires team access).
 * POST: Add a member to a team (owner only).
 * DELETE: Remove a member from a team (owner only).
 * Access is controlled via team_members table — never team_profiles.
 */

import { NextResponse, NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import {
  hasTeamAccess,
  listMembers,
  addMember,
  removeMember,
} from '@/server/repositories/team.repo';

// ─── Validation schemas ─────────────────────────────────────────────────────

const AddMemberSchema = z.object({
  team_id: z.string().uuid('Invalid team_id'),
  user_id: z.string().uuid('Invalid user_id'),
  role: z.enum(['member']).optional().default('member'),
});

// ─── GET — List members ─────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const teamId = request.nextUrl.searchParams.get('team_id');
    if (!teamId) return ApiErrors.validationError('team_id query param is required');
    if (!isValidUUID(teamId)) return ApiErrors.validationError('Invalid team_id');

    const access = await hasTeamAccess(session.user.id, teamId);
    if (!access.access) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const members = await listMembers(teamId);
    return NextResponse.json({ members });
  } catch (error) {
    logApiError('teams-members-list', error);
    return ApiErrors.internalError();
  }
}

// ─── POST — Add a member ─────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return ApiErrors.validationError('Invalid JSON');
    }

    const parsed = AddMemberSchema.safeParse(rawBody);
    if (!parsed.success) {
      return ApiErrors.validationError(parsed.error.errors[0]?.message ?? 'Invalid input');
    }

    const { team_id: teamId, user_id: newUserId, role } = parsed.data;

    // Only team owners can add members
    const callerAccess = await hasTeamAccess(session.user.id, teamId);
    if (!callerAccess.access || callerAccess.role !== 'owner') {
      return NextResponse.json({ error: 'Only team owners can add members' }, { status: 403 });
    }

    const member = await addMember(teamId, newUserId, role);
    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    logApiError('teams-members-add', error);
    return ApiErrors.databaseError();
  }
}

// ─── DELETE — Remove a member ───────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const teamId = request.nextUrl.searchParams.get('team_id');
    const userId = request.nextUrl.searchParams.get('user_id');

    if (!teamId || !userId) {
      return ApiErrors.validationError('team_id and user_id query params are required');
    }

    if (!isValidUUID(teamId) || !isValidUUID(userId)) {
      return ApiErrors.validationError('Invalid team_id or user_id');
    }

    // Only team owners can remove members
    const access = await hasTeamAccess(session.user.id, teamId);
    if (!access.access || access.role !== 'owner') {
      return NextResponse.json({ error: 'Only team owners can remove members' }, { status: 403 });
    }

    // Can't remove the team owner
    if (userId === session.user.id) {
      return NextResponse.json({ error: 'Cannot remove team owner' }, { status: 400 });
    }

    await removeMember(teamId, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('teams-members-remove', error);
    return ApiErrors.databaseError();
  }
}
