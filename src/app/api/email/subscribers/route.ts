// API Route: Email Subscribers
// GET — List subscribers for team (with search, filter, pagination)
// POST — Add a single subscriber (upsert on team_id + email)

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { createSubscriberSchema } from '@/lib/types/email-system';
import type { SubscriberStatus, SubscriberSource } from '@/lib/types/email-system';

const SUBSCRIBER_COLUMNS =
  'id, team_id, email, first_name, last_name, status, source, source_id, subscribed_at, unsubscribed_at';

// GET — List subscribers with optional search, status, source, pagination
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const supabase = createSupabaseAdminClient();
    const scope = await getDataScope(session.user.id);

    if (scope.type !== 'team' || !scope.teamId) {
      return ApiErrors.validationError('No team found for this user');
    }

    const teamId = scope.teamId;
    const { searchParams } = new URL(request.url);

    const search = searchParams.get('search')?.trim() || '';
    const status = searchParams.get('status') as SubscriberStatus | null;
    const source = searchParams.get('source') as SubscriberSource | null;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    // Validate filter values if provided
    if (status && !['active', 'unsubscribed', 'bounced'].includes(status)) {
      return ApiErrors.validationError('Invalid status filter');
    }
    if (source && !['lead_magnet', 'manual', 'import'].includes(source)) {
      return ApiErrors.validationError('Invalid source filter');
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Build the data query
    let query = supabase
      .from('email_subscribers')
      .select(SUBSCRIBER_COLUMNS)
      .eq('team_id', teamId)
      .order('subscribed_at', { ascending: false })
      .range(from, to);

    // Build a matching count query
    let countQuery = supabase
      .from('email_subscribers')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId);

    // Apply filters to both queries
    if (search) {
      const ilike = `%${search}%`;
      const searchFilter = `email.ilike.${ilike},first_name.ilike.${ilike},last_name.ilike.${ilike}`;
      query = query.or(searchFilter);
      countQuery = countQuery.or(searchFilter);
    }

    if (status) {
      query = query.eq('status', status);
      countQuery = countQuery.eq('status', status);
    }

    if (source) {
      query = query.eq('source', source);
      countQuery = countQuery.eq('source', source);
    }

    // Execute both queries in parallel
    const [dataResult, countResult] = await Promise.all([query, countQuery]);

    if (dataResult.error) {
      logApiError('email/subscribers/list', dataResult.error, { teamId });
      return ApiErrors.databaseError('Failed to list subscribers');
    }

    if (countResult.error) {
      logApiError('email/subscribers/count', countResult.error, { teamId });
      return ApiErrors.databaseError('Failed to count subscribers');
    }

    return NextResponse.json({
      subscribers: dataResult.data ?? [],
      total: countResult.count ?? 0,
      page,
      limit,
    });
  } catch (error) {
    logApiError('email/subscribers/list', error);
    return ApiErrors.internalError('Failed to list subscribers');
  }
}

// POST — Add a single subscriber (upsert, don't overwrite existing names)
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const parsed = createSubscriberSchema.safeParse(body);
    if (!parsed.success) {
      return ApiErrors.validationError(
        parsed.error.issues[0]?.message || 'Invalid subscriber data',
        parsed.error.issues
      );
    }

    const { email, first_name, last_name } = parsed.data;

    const supabase = createSupabaseAdminClient();
    const scope = await getDataScope(session.user.id);

    if (scope.type !== 'team' || !scope.teamId) {
      return ApiErrors.validationError('No team found for this user');
    }

    const teamId = scope.teamId;

    // Check for existing subscriber to preserve their names
    const { data: existing } = await supabase
      .from('email_subscribers')
      .select(SUBSCRIBER_COLUMNS)
      .eq('team_id', teamId)
      .eq('email', email)
      .maybeSingle();

    // Build the upsert data — don't overwrite existing names
    const upsertData: Record<string, unknown> = {
      team_id: teamId,
      email,
      source: 'manual',
      status: 'active',
    };

    if (existing) {
      // Preserve existing names if the new values are empty/undefined
      upsertData.first_name = first_name || existing.first_name || null;
      upsertData.last_name = last_name || existing.last_name || null;
    } else {
      upsertData.first_name = first_name || null;
      upsertData.last_name = last_name || null;
    }

    const { data: subscriber, error } = await supabase
      .from('email_subscribers')
      .upsert(upsertData, { onConflict: 'team_id,email' })
      .select(SUBSCRIBER_COLUMNS)
      .single();

    if (error) {
      logApiError('email/subscribers/create', error, { teamId, email });
      return ApiErrors.databaseError('Failed to create subscriber');
    }

    return NextResponse.json({ subscriber }, { status: 201 });
  } catch (error) {
    logApiError('email/subscribers/create', error);
    return ApiErrors.internalError('Failed to create subscriber');
  }
}
