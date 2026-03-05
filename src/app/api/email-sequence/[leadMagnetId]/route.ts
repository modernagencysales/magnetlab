// API Route: Email Sequence CRUD
// GET, PUT /api/email-sequence/[leadMagnetId]

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getScopeForResource } from '@/lib/utils/team-context';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as emailSequenceService from '@/server/services/email-sequence.service';
import { getLeadMagnetTeamId } from '@/server/repositories/email-sequence.repo';

interface RouteParams {
  params: Promise<{ leadMagnetId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { leadMagnetId } = await params;
    const teamId = await getLeadMagnetTeamId(leadMagnetId);
    const scope = await getScopeForResource(session.user.id, teamId);
    const result = await emailSequenceService.getByLeadMagnetId(scope, leadMagnetId);

    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Lead magnet');
      if (result.error === 'database') return ApiErrors.databaseError(result.message ?? 'Failed to get');
      return ApiErrors.internalError(result.message ?? 'Failed to get email sequence');
    }

    return NextResponse.json({ emailSequence: result.emailSequence });
  } catch (error) {
    logApiError('email-sequence/get', error);
    return ApiErrors.internalError('Failed to get email sequence');
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { leadMagnetId } = await params;
    const body = await request.json();
    const { emails, status } = body;

    if (!emails && !status) {
      return ApiErrors.validationError('emails array or status is required');
    }

    if (emails) {
      if (!Array.isArray(emails)) {
        return ApiErrors.validationError('emails must be an array');
      }
      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        if (
          typeof email.day !== 'number' ||
          typeof email.subject !== 'string' ||
          typeof email.body !== 'string' ||
          typeof email.replyTrigger !== 'string'
        ) {
          return ApiErrors.validationError(`Invalid email at index ${i}`);
        }
      }
    }

    if (status && !['draft', 'synced', 'active'].includes(status)) {
      return ApiErrors.validationError('status must be draft, synced, or active');
    }

    const teamId = await getLeadMagnetTeamId(leadMagnetId);
    const scope = await getScopeForResource(session.user.id, teamId);
    const result = await emailSequenceService.update(scope, leadMagnetId, { emails, status });

    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Email sequence');
      if (result.error === 'database') return ApiErrors.databaseError(result.message ?? 'Failed to update');
      return ApiErrors.internalError(result.message ?? 'Failed to update');
    }

    return NextResponse.json({ emailSequence: result.emailSequence });
  } catch (error) {
    logApiError('email-sequence/update', error);
    return ApiErrors.internalError('Failed to update email sequence');
  }
}
