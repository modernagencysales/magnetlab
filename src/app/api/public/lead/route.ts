// API Route: Public Lead Capture
// POST /api/public/lead - Capture email from opt-in page
// PATCH /api/public/lead - Submit qualification answers
// No auth required

import { NextResponse, after } from 'next/server';
import { leadCaptureSchema, leadQualificationSchema, validateBody } from '@/lib/validations/api';
import { logApiError } from '@/lib/api/errors';
import {
  submitLead,
  runLeadCreatedSideEffects,
  submitQualification,
  runLeadQualifiedSideEffects,
} from '@/server/services/public.service';

function getClientIp(request: Request): string {
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  const vercelForwarded = request.headers.get('x-vercel-forwarded-for');
  if (vercelForwarded) return vercelForwarded.split(',')[0].trim();
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}

// POST - Capture initial lead (email)
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || null;
    const referer = request.headers.get('referer') || undefined;
    const body = await request.json();

    const validation = validateBody(body, leadCaptureSchema);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { funnelPageId, email, name, utmSource, utmMedium, utmCampaign, fbc, fbp } = validation.data;

    const result = await submitLead(
      funnelPageId,
      email,
      name ?? null,
      ip,
      userAgent,
      utmSource ?? null,
      utmMedium ?? null,
      utmCampaign ?? null,
      fbc ?? null,
      fbp ?? null
    );

    if (!result.success) {
      if (result.error === 'rate_limited') {
        return NextResponse.json(
          { error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
          { status: 429 }
        );
      }
      if (result.error === 'not_found') {
        return NextResponse.json({ error: 'Page not found', code: 'NOT_FOUND' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to capture lead', code: 'DATABASE_ERROR' }, { status: 500 });
    }

    after(async () => {
      await runLeadCreatedSideEffects(result.payload, referer);
    });

    return NextResponse.json({ leadId: result.leadId, success: true }, { status: 201 });
  } catch (error) {
    logApiError('public/lead', error);
    return NextResponse.json({ error: 'Failed to capture lead', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// PATCH - Update lead with qualification answers
export async function PATCH(request: Request) {
  try {
    const ip = getClientIp(request);
    const userAgent = request.headers.get('user-agent') || null;
    const referer = request.headers.get('referer') || undefined;
    const body = await request.json();

    const validation = validateBody(body, leadQualificationSchema);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { leadId, answers } = validation.data;

    const result = await submitQualification(leadId, answers, ip, userAgent);

    if (!result.success) {
      if (result.error === 'not_found') {
        return NextResponse.json({ error: 'Lead not found', code: 'NOT_FOUND' }, { status: 404 });
      }
      if (result.error === 'validation') {
        return NextResponse.json(
          { error: result.validationError ?? 'Validation failed', code: 'VALIDATION_ERROR' },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: 'Failed to update qualification', code: 'DATABASE_ERROR' }, { status: 500 });
    }

    after(async () => {
      await runLeadQualifiedSideEffects(result.payload, referer);
    });

    return NextResponse.json({ leadId: result.leadId, isQualified: result.isQualified, success: true });
  } catch (error) {
    logApiError('public/lead/qualification', error);
    return NextResponse.json({ error: 'Failed to update qualification', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
