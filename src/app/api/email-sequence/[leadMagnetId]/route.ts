// API Route: Email Sequence CRUD
// GET, PUT /api/email-sequence/[leadMagnetId]
//
// PUT accepts two body shapes:
//   Legacy:  { emails: [{day, subject, body, replyTrigger}], status? }
//   MCP:     { emails: [{subject, body, delay_days, replyTrigger?}], subject_lines?, from_name?, reply_to? }
//
// Both shapes produce full-replace semantics — all existing emails are
// replaced by the new array. `from_name` and `reply_to` are accepted but
// not stored (sender config lives in brand_kits).

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getScopeForResource } from '@/lib/utils/team-context';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as emailSequenceService from '@/server/services/email-sequence.service';
import { getLeadMagnetTeamId } from '@/server/repositories/email-sequence.repo';

interface RouteParams {
  params: Promise<{ leadMagnetId: string }>;
}

// ─── Body shape helpers ──────────────────────────────────────────────────────

/** Both the legacy shape and the MCP shape for a single email item. */
interface RawEmailItem {
  // Legacy field (day offset from opt-in)
  day?: number;
  // MCP field (alias for `day`)
  delay_days?: number;
  subject: string;
  body: string;
  replyTrigger?: string;
  reply_trigger?: string;
}

/**
 * Normalise an email item from either body shape into the canonical
 * `{ day, subject, body, replyTrigger }` used by the service layer.
 */
function normaliseEmail(item: RawEmailItem) {
  const day = typeof item.day === 'number' ? item.day : (item.delay_days ?? 0);
  return {
    day,
    subject: item.subject,
    body: item.body,
    replyTrigger: item.replyTrigger ?? item.reply_trigger ?? '',
  };
}

/**
 * Returns true when the raw item has the minimum fields required in EITHER
 * the legacy shape OR the MCP shape.
 */
function isValidEmailItem(item: unknown): item is RawEmailItem {
  if (!item || typeof item !== 'object') return false;
  const e = item as Record<string, unknown>;
  const hasDay = typeof e.day === 'number' || typeof e.delay_days === 'number';
  const hasSubject = typeof e.subject === 'string';
  const hasBody = typeof e.body === 'string';
  return hasDay && hasSubject && hasBody;
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
      if (result.error === 'database')
        return ApiErrors.databaseError(result.message ?? 'Failed to get');
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
    // `from_name`, `reply_to`, and `subject_lines` are accepted for MCP
    // compatibility but not persisted — sender config lives in brand_kits.
    const { emails: rawEmails, status } = await request.json();

    const hasEmails = rawEmails !== undefined;
    if (!hasEmails && !status) {
      return ApiErrors.validationError('emails array or status is required');
    }

    if (status && !['draft', 'synced', 'active'].includes(status)) {
      return ApiErrors.validationError('status must be draft, synced, or active');
    }

    let normalised:
      | Array<{ day: number; subject: string; body: string; replyTrigger: string }>
      | undefined;
    if (hasEmails) {
      if (!Array.isArray(rawEmails)) {
        return ApiErrors.validationError('emails must be an array');
      }
      for (let i = 0; i < rawEmails.length; i++) {
        if (!isValidEmailItem(rawEmails[i])) {
          return ApiErrors.validationError(
            `Invalid email at index ${i}: subject, body, and day/delay_days are required`
          );
        }
      }
      normalised = rawEmails.map(normaliseEmail);
    }

    const teamId = await getLeadMagnetTeamId(leadMagnetId);
    const scope = await getScopeForResource(session.user.id, teamId);
    const result = await emailSequenceService.update(scope, leadMagnetId, {
      emails: normalised,
      status,
    });

    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Email sequence');
      if (result.error === 'database')
        return ApiErrors.databaseError(result.message ?? 'Failed to update');
      return ApiErrors.internalError(result.message ?? 'Failed to update');
    }

    return NextResponse.json({ emailSequence: result.emailSequence });
  } catch (error) {
    logApiError('email-sequence/update', error);
    return ApiErrors.internalError('Failed to update email sequence');
  }
}
