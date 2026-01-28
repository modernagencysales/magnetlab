// API Route: Public Lead Capture
// POST /api/public/lead - Capture email from opt-in page
// PATCH /api/public/lead - Submit qualification answers
// No auth required

import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { deliverWebhook } from '@/lib/webhooks/sender';
import { triggerEmailSequenceIfActive } from '@/lib/services/email-sequence-trigger';
import { leadCaptureSchema, leadQualificationSchema, validateBody } from '@/lib/validations/api';
import { logApiError } from '@/lib/api/errors';

// Rate limiting configuration
// Uses database-based checking for serverless compatibility
const RATE_LIMIT_WINDOW_MINUTES = 1;
const RATE_LIMIT_MAX_LEADS_PER_IP = 5; // Max leads from same IP per minute

/**
 * Check rate limit using database query
 * This works in serverless environments unlike in-memory Maps
 */
async function checkRateLimitDb(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  ip: string
): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from('funnel_leads')
    .select('*', { count: 'exact', head: true })
    .eq('ip_address', ip)
    .gte('created_at', windowStart);

  if (error) {
    // On error, allow the request (fail open for availability)
    logApiError('public/lead/rate-limit', error, { note: 'Allowing request (fail open)' });
    return true;
  }

  return (count ?? 0) < RATE_LIMIT_MAX_LEADS_PER_IP;
}

// Get client IP securely - prioritize Vercel's trusted headers
function getClientIp(request: Request): string {
  // x-real-ip is set by Vercel and cannot be spoofed
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  // x-vercel-forwarded-for is Vercel-specific and trustworthy
  const vercelForwarded = request.headers.get('x-vercel-forwarded-for');
  if (vercelForwarded) return vercelForwarded.split(',')[0].trim();

  // Fallback to x-forwarded-for (less secure, can be spoofed)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  return 'unknown';
}

// POST - Capture initial lead (email)
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const body = await request.json();

    // Validate input with Zod schema
    const validation = validateBody(body, leadCaptureSchema);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { funnelPageId, email, name, utmSource, utmMedium, utmCampaign } = validation.data;
    const supabase = createSupabaseAdminClient();

    // Database-based rate limiting (serverless-compatible)
    const isAllowed = await checkRateLimitDb(supabase, ip);
    if (!isAllowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
        { status: 429 }
      );
    }

    // Verify funnel page exists and is published
    const { data: funnel, error: funnelError } = await supabase
      .from('funnel_pages')
      .select('id, user_id, lead_magnet_id, slug, is_published')
      .eq('id', funnelPageId)
      .single();

    if (funnelError || !funnel) {
      return NextResponse.json({ error: 'Page not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    if (!funnel.is_published) {
      return NextResponse.json({ error: 'Page not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    // Create lead record (email already normalized by schema)
    const { data: lead, error: leadError } = await supabase
      .from('funnel_leads')
      .insert({
        funnel_page_id: funnelPageId,
        lead_magnet_id: funnel.lead_magnet_id,
        user_id: funnel.user_id,
        email, // Already lowercased and trimmed by schema
        name: name || null,
        utm_source: utmSource || null,
        utm_medium: utmMedium || null,
        utm_campaign: utmCampaign || null,
        ip_address: ip !== 'unknown' ? ip : null,
      })
      .select()
      .single();

    if (leadError) {
      logApiError('public/lead/create', leadError, { funnelPageId, email });
      return NextResponse.json({ error: 'Failed to capture lead', code: 'DATABASE_ERROR' }, { status: 500 });
    }

    // Get lead magnet title for webhook
    const { data: leadMagnet } = await supabase
      .from('lead_magnets')
      .select('title')
      .eq('id', funnel.lead_magnet_id)
      .single();

    // Deliver webhook (async, don't wait)
    deliverWebhook(funnel.user_id, 'lead.created', {
      leadId: lead.id,
      email: lead.email,
      name: lead.name,
      isQualified: null,
      qualificationAnswers: null,
      leadMagnetTitle: leadMagnet?.title || '',
      funnelPageSlug: funnel.slug,
      utmSource: lead.utm_source,
      utmMedium: lead.utm_medium,
      utmCampaign: lead.utm_campaign,
      createdAt: lead.created_at,
    }).catch((err) => logApiError('public/lead/webhook', err, { leadId: lead.id }));

    // Trigger email sequence if active (async, don't wait)
    triggerEmailSequenceIfActive({
      leadId: lead.id,
      userId: funnel.user_id,
      email: lead.email,
      name: lead.name,
      leadMagnetId: funnel.lead_magnet_id,
      leadMagnetTitle: leadMagnet?.title || '',
    }).catch((err) => logApiError('public/lead/email-sequence', err, { leadId: lead.id }));

    return NextResponse.json({
      leadId: lead.id,
      success: true,
    }, { status: 201 });
  } catch (error) {
    logApiError('public/lead', error);
    return NextResponse.json({ error: 'Failed to capture lead', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}

// PATCH - Update lead with qualification answers
export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    // Validate input with Zod schema
    const validation = validateBody(body, leadQualificationSchema);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { leadId, answers } = validation.data;
    const supabase = createSupabaseAdminClient();

    // Get lead and funnel page
    const { data: lead, error: leadError } = await supabase
      .from('funnel_leads')
      .select('id, funnel_page_id, user_id, email, name')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found', code: 'NOT_FOUND' }, { status: 404 });
    }

    // Get qualifying answers for questions
    const { data: questions } = await supabase
      .from('qualification_questions')
      .select('id, qualifying_answer')
      .eq('funnel_page_id', lead.funnel_page_id);

    // Validate answers if there are questions
    if (questions && questions.length > 0) {
      const questionIds = new Set(questions.map(q => q.id));
      const answerKeys = Object.keys(answers);

      // Validate all answer keys are valid question IDs
      for (const key of answerKeys) {
        if (!questionIds.has(key)) {
          return NextResponse.json(
            { error: 'Invalid question ID in answers' },
            { status: 400 }
          );
        }
      }

      // Validate all answer values are 'yes' or 'no'
      for (const value of Object.values(answers)) {
        if (value !== 'yes' && value !== 'no') {
          return NextResponse.json(
            { error: 'Answer values must be "yes" or "no"' },
            { status: 400 }
          );
        }
      }

      // Validate all questions are answered
      for (const q of questions) {
        if (!(q.id in answers)) {
          return NextResponse.json(
            { error: 'All questions must be answered' },
            { status: 400 }
          );
        }
      }
    }

    // Calculate if qualified (all answers must match qualifying_answer)
    let isQualified = true;
    if (questions && questions.length > 0) {
      for (const q of questions) {
        const userAnswer = answers[q.id];
        if (userAnswer !== q.qualifying_answer) {
          isQualified = false;
          break;
        }
      }
    }

    // Update lead with answers
    const { data: updatedLead, error: updateError } = await supabase
      .from('funnel_leads')
      .update({
        qualification_answers: answers,
        is_qualified: isQualified,
      })
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      logApiError('public/lead/qualification', updateError, { leadId });
      return NextResponse.json({ error: 'Failed to update lead', code: 'DATABASE_ERROR' }, { status: 500 });
    }

    // Get funnel and lead magnet for webhook
    const { data: funnel } = await supabase
      .from('funnel_pages')
      .select('slug, lead_magnet_id')
      .eq('id', lead.funnel_page_id)
      .single();

    const { data: leadMagnet } = await supabase
      .from('lead_magnets')
      .select('title')
      .eq('id', funnel?.lead_magnet_id)
      .single();

    // Deliver webhook with updated info
    deliverWebhook(lead.user_id, 'lead.created', {
      leadId: lead.id,
      email: lead.email,
      name: lead.name,
      isQualified,
      qualificationAnswers: answers,
      leadMagnetTitle: leadMagnet?.title || '',
      funnelPageSlug: funnel?.slug || '',
      utmSource: updatedLead.utm_source,
      utmMedium: updatedLead.utm_medium,
      utmCampaign: updatedLead.utm_campaign,
      createdAt: updatedLead.created_at,
    }).catch((err) => logApiError('public/lead/webhook', err, { leadId: lead.id }));

    return NextResponse.json({
      leadId: lead.id,
      isQualified,
      success: true,
    });
  } catch (error) {
    logApiError('public/lead/qualification', error);
    return NextResponse.json({ error: 'Failed to update qualification', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
