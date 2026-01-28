// API Route: Public Lead Capture
// POST /api/public/lead - Capture email from opt-in page
// POST /api/public/lead/qualify - Submit qualification answers
// No auth required

import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { deliverWebhook } from '@/lib/webhooks/sender';
import { triggerEmailSequenceIfActive } from '@/lib/services/email-sequence-trigger';

// Simple in-memory rate limiting (10 requests per minute per IP)
// Note: In-memory rate limiting is limited in serverless environments
// For production, consider using Upstash Redis or Vercel KV for distributed rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

// Clean up old entries periodically to prevent memory leaks
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
let lastCleanup = Date.now();

function cleanupRateLimitMap() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(ip);
    }
  }
}

function checkRateLimit(ip: string): boolean {
  cleanupRateLimitMap();

  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
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
    // Rate limiting
    const ip = getClientIp(request);

    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { funnelPageId, email, name, utmSource, utmMedium, utmCampaign } = body;

    // Validate required fields
    if (!funnelPageId || !email) {
      return NextResponse.json(
        { error: 'funnelPageId and email are required' },
        { status: 400 }
      );
    }

    // Validate email format (stricter regex)
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email) || email.includes('..')) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Verify funnel page exists and is published
    const { data: funnel, error: funnelError } = await supabase
      .from('funnel_pages')
      .select('id, user_id, lead_magnet_id, slug, is_published')
      .eq('id', funnelPageId)
      .single();

    if (funnelError || !funnel) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    if (!funnel.is_published) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Create lead record
    const { data: lead, error: leadError } = await supabase
      .from('funnel_leads')
      .insert({
        funnel_page_id: funnelPageId,
        lead_magnet_id: funnel.lead_magnet_id,
        user_id: funnel.user_id,
        email: email.toLowerCase().trim(),
        name: name?.trim() || null,
        utm_source: utmSource || null,
        utm_medium: utmMedium || null,
        utm_campaign: utmCampaign || null,
      })
      .select()
      .single();

    if (leadError) {
      console.error('Create lead error:', leadError);
      return NextResponse.json({ error: 'Failed to capture lead' }, { status: 500 });
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
    }).catch((err) => console.error('Webhook delivery error:', err));

    // Trigger email sequence if active (async, don't wait)
    triggerEmailSequenceIfActive({
      leadId: lead.id,
      userId: funnel.user_id,
      email: lead.email,
      name: lead.name,
      leadMagnetId: funnel.lead_magnet_id,
      leadMagnetTitle: leadMagnet?.title || '',
    }).catch((err) => console.error('Email sequence trigger error:', err));

    return NextResponse.json({
      leadId: lead.id,
      success: true,
    }, { status: 201 });
  } catch (error) {
    console.error('Lead capture error:', error);
    return NextResponse.json({ error: 'Failed to capture lead' }, { status: 500 });
  }
}

// PATCH - Update lead with qualification answers
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { leadId, answers } = body;

    if (!leadId || !answers || typeof answers !== 'object') {
      return NextResponse.json(
        { error: 'leadId and answers are required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Get lead and funnel page
    const { data: lead, error: leadError } = await supabase
      .from('funnel_leads')
      .select('id, funnel_page_id, user_id, email, name')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
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
      console.error('Update lead error:', updateError);
      return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
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
    }).catch((err) => console.error('Webhook delivery error:', err));

    return NextResponse.json({
      leadId: lead.id,
      isQualified,
      success: true,
    });
  } catch (error) {
    console.error('Qualification update error:', error);
    return NextResponse.json({ error: 'Failed to update qualification' }, { status: 500 });
  }
}
