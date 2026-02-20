// API Route: Public Lead Capture
// POST /api/public/lead - Capture email from opt-in page
// PATCH /api/public/lead - Submit qualification answers
// No auth required

import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { deliverWebhook } from '@/lib/webhooks/sender';
import { triggerEmailSequenceIfActive, triggerEmailFlowIfActive, upsertSubscriberFromLead, getSenderInfo, getUserResendConfig } from '@/lib/services/email-sequence-trigger';
import { sendResourceEmail } from '@/trigger/send-resource-email';
import { leadCaptureSchema, leadQualificationSchema, validateBody } from '@/lib/validations/api';
import { logApiError } from '@/lib/api/errors';
import { fireGtmLeadCreatedWebhook, fireGtmLeadQualifiedWebhook } from '@/lib/webhooks/gtm-system';
import { deliverConductorWebhook } from '@/lib/webhooks/conductor';
import { resolveFullQuestionsForFunnel } from '@/lib/services/qualification';
import { fireTrackingPixelLeadEvent, fireTrackingPixelQualifiedEvent } from '@/lib/services/tracking-pixels';
import { getPostHogServerClient } from '@/lib/posthog';

/**
 * Scan qualification answers for a LinkedIn profile URL.
 * Returns the first URL matching linkedin.com/in/, or null.
 */
function extractLinkedInUrl(answers: Record<string, string>): string | null {
  const linkedInRegex = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/i;
  for (const value of Object.values(answers)) {
    const match = value?.match(linkedInRegex);
    if (match) return match[0];
  }
  return null;
}

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
    const userAgent = request.headers.get('user-agent') || null;
    const body = await request.json();

    // Validate input with Zod schema
    const validation = validateBody(body, leadCaptureSchema);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { funnelPageId, email, name, utmSource, utmMedium, utmCampaign, fbc, fbp } = validation.data;
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
      .select('id, user_id, lead_magnet_id, slug, is_published, team_id, send_resource_email')
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
        team_id: funnel.team_id || null,
        email, // Already lowercased and trimmed by schema
        name: name || null,
        utm_source: utmSource || null,
        utm_medium: utmMedium || null,
        utm_campaign: utmCampaign || null,
        ip_address: ip !== 'unknown' ? ip : null,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (leadError) {
      logApiError('public/lead/create', leadError, { funnelPageId, email });
      return NextResponse.json({ error: 'Failed to capture lead', code: 'DATABASE_ERROR' }, { status: 500 });
    }

    // Get lead magnet title + external_url for webhook
    const { data: leadMagnet } = await supabase
      .from('lead_magnets')
      .select('title, external_url, polished_content, extracted_content')
      .eq('id', funnel.lead_magnet_id)
      .single();

    // Get username to construct content URL
    const { data: funnelOwner } = await supabase
      .from('users')
      .select('username')
      .eq('id', funnel.user_id)
      .single();

    // Build resource URL: external_url takes priority, then hosted content page
    let resourceUrl: string | null = leadMagnet?.external_url || null;
    if (!resourceUrl && funnelOwner?.username && (leadMagnet?.polished_content || leadMagnet?.extracted_content)) {
      resourceUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://www.magnetlab.app'}/p/${funnelOwner.username}/${funnel.slug}/content`;
    }

    // Deliver webhook (async, don't wait)
    deliverWebhook(funnel.user_id, 'lead.created', {
      leadId: lead.id,
      email: lead.email,
      name: lead.name,
      isQualified: null,
      qualificationAnswers: null,
      surveyAnswers: null,
      leadMagnetTitle: leadMagnet?.title || '',
      funnelPageSlug: funnel.slug,
      utmSource: lead.utm_source,
      utmMedium: lead.utm_medium,
      utmCampaign: lead.utm_campaign,
      createdAt: lead.created_at,
    }).catch((err) => logApiError('public/lead/webhook', err, { leadId: lead.id }));

    // Fire GTM system webhook (async, don't wait — only for GTM system owner's leads)
    fireGtmLeadCreatedWebhook({
      email: lead.email,
      name: lead.name,
      leadMagnetId: funnel.lead_magnet_id,
      leadMagnetTitle: leadMagnet?.title || '',
      funnelPageId: funnel.id,
      funnelPageSlug: funnel.slug,
      resourceUrl,
      isQualified: false,
      utmSource: lead.utm_source,
      utmMedium: lead.utm_medium,
      utmCampaign: lead.utm_campaign,
      createdAt: lead.created_at,
    }, funnel.user_id).catch((err) => logApiError('public/lead/gtm-webhook', err, { leadId: lead.id }));

    // Deliver to user's Conductor instance (async, don't wait)
    deliverConductorWebhook(funnel.user_id, 'lead.created', {
      email: lead.email,
      name: lead.name,
      leadMagnetTitle: leadMagnet?.title || '',
      funnelPageSlug: funnel.slug,
      utmSource: lead.utm_source,
      utmMedium: lead.utm_medium,
      utmCampaign: lead.utm_campaign,
      createdAt: lead.created_at,
    }).catch((err) => logApiError('public/lead/conductor-webhook', err, { leadId: lead.id }));

    // ALWAYS upsert subscriber for the team (non-blocking)
    if (funnel.team_id) {
      upsertSubscriberFromLead({
        teamId: funnel.team_id,
        email: lead.email,
        name: lead.name,
        leadMagnetId: funnel.lead_magnet_id,
      }).catch(() => {}); // fire and forget
    }

    // Try new email flow system first, then fall back to old sequences, then resource email
    triggerEmailFlowIfActive({
      teamId: funnel.team_id || '',
      userId: funnel.user_id,
      email: lead.email,
      name: lead.name,
      leadMagnetId: funnel.lead_magnet_id,
    }).then(async (flowResult) => {
      if (flowResult.triggered) return;

      // Fall back to old email sequence system
      return triggerEmailSequenceIfActive({
        leadId: lead.id,
        userId: funnel.user_id,
        email: lead.email,
        name: lead.name,
        leadMagnetId: funnel.lead_magnet_id,
        leadMagnetTitle: leadMagnet?.title || '',
      }).then(async (seqResult) => {
        if (seqResult.triggered) return;

        // No active flow or sequence — check if default resource email is enabled
        if (!funnel.send_resource_email || !resourceUrl) return;

        try {
          const [senderInfo, resendConfig] = await Promise.all([
            getSenderInfo(funnel.user_id),
            getUserResendConfig(funnel.user_id),
          ]);

          await sendResourceEmail.trigger({
            leadEmail: lead.email,
            leadName: lead.name,
            leadMagnetTitle: leadMagnet?.title || '',
            resourceUrl,
            senderName: resendConfig?.fromName || senderInfo.senderName,
            senderEmail: resendConfig?.fromEmail || senderInfo.senderEmail,
            resendConfig,
          });
        } catch (err) {
          logApiError('public/lead/resource-email', err, { leadId: lead.id });
        }
      });
    }).catch((err) => logApiError('public/lead/email', err, { leadId: lead.id }));

    // Fire tracking pixel events (Meta CAPI, LinkedIn CAPI) — async, non-blocking
    fireTrackingPixelLeadEvent({
      userId: funnel.user_id,
      leadId: lead.id,
      email: lead.email,
      firstName: lead.name || null,
      ipAddress: ip !== 'unknown' ? ip : null,
      userAgent,
      sourceUrl: request.headers.get('referer') || undefined,
      fbc: fbc || null,
      fbp: fbp || null,
      utmSource: lead.utm_source,
      utmMedium: lead.utm_medium,
      utmCampaign: lead.utm_campaign,
      leadMagnetTitle: leadMagnet?.title || null,
    }).catch((err) => logApiError('public/lead/tracking-pixels', err, { leadId: lead.id }));

    try { getPostHogServerClient()?.capture({ distinctId: funnel.user_id, event: 'lead_captured', properties: { funnel_page_id: funnelPageId, lead_magnet_title: leadMagnet?.title || '', utm_source: utmSource || null, utm_medium: utmMedium || null, utm_campaign: utmCampaign || null } }); } catch {}

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
    const patchIp = getClientIp(request);
    const patchUserAgent = request.headers.get('user-agent') || null;
    const patchReferer = request.headers.get('referer') || undefined;
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

    // Get funnel to check for shared form
    const { data: funnelForForm } = await supabase
      .from('funnel_pages')
      .select('qualification_form_id')
      .eq('id', lead.funnel_page_id)
      .single();

    // Get questions with full data for qualification logic (form-aware)
    const { questions } = await resolveFullQuestionsForFunnel(
      supabase,
      lead.funnel_page_id,
      funnelForForm?.qualification_form_id || null
    );

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

      // Validate required questions are answered
      for (const q of questions) {
        if (q.is_required && !(q.id in answers)) {
          return NextResponse.json(
            { error: 'All required questions must be answered' },
            { status: 400 }
          );
        }
      }

      // Validate yes_no answers are valid
      for (const q of questions) {
        if (q.answer_type === 'yes_no' && q.id in answers) {
          const val = answers[q.id];
          if (val !== 'yes' && val !== 'no') {
            return NextResponse.json(
              { error: 'Yes/No answer values must be "yes" or "no"' },
              { status: 400 }
            );
          }
        }
      }
    }

    // Calculate qualification: only is_qualifying questions affect the result
    let isQualified = true;
    if (questions && questions.length > 0) {
      const qualifyingQuestions = questions.filter(q => q.is_qualifying);
      for (const q of qualifyingQuestions) {
        const userAnswer = answers[q.id];
        if (!userAnswer) {
          isQualified = false;
          break;
        }

        const qualAnswer = q.qualifying_answer;
        if (q.answer_type === 'yes_no') {
          // JSONB stored as string: compare directly
          if (userAnswer !== qualAnswer) {
            isQualified = false;
            break;
          }
        } else if (q.answer_type === 'multiple_choice') {
          // qualifying_answer is an array of acceptable options
          const acceptableOptions = Array.isArray(qualAnswer) ? qualAnswer : [];
          if (!acceptableOptions.includes(userAnswer)) {
            isQualified = false;
            break;
          }
        }
        // text and textarea are never qualifying (enforced by design)
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

    // Get funnel with lead magnet title for webhook (single query with join)
    const { data: funnel } = await supabase
      .from('funnel_pages')
      .select('slug, lead_magnets(title)')
      .eq('id', lead.funnel_page_id)
      .single();

    // Build flat surveyAnswers using slugified question text as keys
    let surveyAnswers: Record<string, string> | null = null;
    if (questions && questions.length > 0) {
      surveyAnswers = {};
      for (const q of questions) {
        if (q.id in answers) {
          const key = q.question_text
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .slice(0, 60);
          surveyAnswers[key] = answers[q.id];
        }
      }
    }

    // Deliver webhook with updated info
    const leadMagnets = funnel?.lead_magnets as { title: string } | { title: string }[] | null;
    const leadMagnetTitle = Array.isArray(leadMagnets) ? leadMagnets[0]?.title || '' : leadMagnets?.title || '';
    deliverWebhook(lead.user_id, 'lead.created', {
      leadId: lead.id,
      email: lead.email,
      name: lead.name,
      isQualified,
      qualificationAnswers: answers,
      surveyAnswers,
      leadMagnetTitle,
      funnelPageSlug: funnel?.slug || '',
      utmSource: updatedLead.utm_source,
      utmMedium: updatedLead.utm_medium,
      utmCampaign: updatedLead.utm_campaign,
      createdAt: updatedLead.created_at,
    }).catch((err) => logApiError('public/lead/webhook', err, { leadId: lead.id }));

    // Fire tracking pixel qualified events (async, non-blocking)
    fireTrackingPixelQualifiedEvent({
      userId: lead.user_id,
      leadId: lead.id,
      email: lead.email,
      firstName: lead.name || null,
      ipAddress: patchIp !== 'unknown' ? patchIp : null,
      userAgent: patchUserAgent,
      sourceUrl: patchReferer,
      utmSource: updatedLead.utm_source,
      utmMedium: updatedLead.utm_medium,
      utmCampaign: updatedLead.utm_campaign,
      leadMagnetTitle: leadMagnetTitle || null,
      isQualified,
      qualificationAnswers: answers,
    }).catch((err) => logApiError('public/lead/tracking-pixels-qualified', err, { leadId: lead.id }));

    // Fire GTM system webhook for lead qualification (async, don't wait — only for GTM system owner's leads)
    fireGtmLeadQualifiedWebhook({
      email: lead.email,
      name: lead.name,
      leadMagnetTitle: leadMagnetTitle || null,
      funnelPageSlug: funnel?.slug || null,
      isQualified,
      qualificationAnswers: answers,
      utmSource: updatedLead.utm_source,
      utmMedium: updatedLead.utm_medium,
      utmCampaign: updatedLead.utm_campaign,
    }, lead.user_id).catch((err) => logApiError('public/lead/gtm-webhook-qualified', err, { leadId: lead.id }));

    // Deliver to user's Conductor instance (async, don't wait)
    deliverConductorWebhook(lead.user_id, 'lead.qualified', {
      email: lead.email,
      name: lead.name,
      funnelLeadId: lead.id,
      leadMagnetTitle: leadMagnetTitle || null,
      funnelPageSlug: funnel?.slug || null,
      isQualified,
      qualificationAnswers: answers,
      surveyAnswers,
      linkedinUrl: extractLinkedInUrl(answers),
      utmSource: updatedLead.utm_source,
      utmMedium: updatedLead.utm_medium,
      utmCampaign: updatedLead.utm_campaign,
    }).catch((err) => logApiError('public/lead/conductor-webhook-qualified', err, { leadId: lead.id }));

    try { getPostHogServerClient()?.capture({ distinctId: lead.user_id, event: 'lead_qualified', properties: { is_qualified: isQualified, question_count: questions?.length || 0 } }); } catch {}

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
