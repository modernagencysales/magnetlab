// API Route: Email Subscribers
// GET — List subscribers for team (with search, filter, pagination)
// POST — Add a single subscriber (upsert on team_id + email)

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireTeamScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { createSubscriberSchema } from '@/lib/types/email-system';
import type { SubscriberStatus, SubscriberSource } from '@/lib/types/email-system';
import * as emailService from '@/server/services/email.service';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) return ApiErrors.validationError('No team found for this user');

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status') as SubscriberStatus | null;
    const source = searchParams.get('source') as SubscriberSource | null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    if (status && !['active', 'unsubscribed', 'bounced'].includes(status)) {
      return ApiErrors.validationError('Invalid status filter');
    }
    if (source && !['lead_magnet', 'manual', 'import'].includes(source)) {
      return ApiErrors.validationError('Invalid source filter');
    }

    const result = await emailService.listSubscribers(scope.teamId, {
      search,
      status,
      source,
      page,
      limit,
    });
    if (!result.success) return ApiErrors.databaseError('Failed to list subscribers');
    return NextResponse.json({
      subscribers: result.subscribers,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (error) {
    logApiError('email/subscribers/list', error);
    return ApiErrors.internalError('Failed to list subscribers');
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const parsed = createSubscriberSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError(
        parsed.error.issues[0]?.message || 'Invalid subscriber data',
        parsed.error.issues
      );
    }

    const scope = await requireTeamScope(session.user.id);
    if (!scope?.teamId) return ApiErrors.validationError('No team found for this user');

    const result = await emailService.createSubscriber(scope.teamId, {
      email: parsed.data.email,
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
    });
    if (!result.success) return ApiErrors.databaseError('Failed to create subscriber');
    return NextResponse.json({ subscriber: result.subscriber }, { status: 201 });
  } catch (error) {
    logApiError('email/subscribers/create', error);
    return ApiErrors.internalError('Failed to create subscriber');
  }
}
