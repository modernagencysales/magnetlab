// Resend Webhook Handler
// POST /api/webhooks/resend
// Processes Resend email events (sent, delivered, opened, clicked, bounced, complained)
// and stores them in the email_events table for analytics.

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError, logWarn, logInfo } from '@/lib/utils/logger';

// Resend webhook event types we care about
const EVENT_TYPE_MAP: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

interface ResendWebhookPayload {
  type: string;
  data: {
    email_id?: string;
    to?: string[];
    subject?: string;
    created_at?: string;
    // Bounce info
    bounce?: {
      type?: string;
      message?: string;
    };
    // Click info
    click?: {
      link?: string;
      timestamp?: string;
    };
    [key: string]: unknown;
  };
}

export async function POST(request: NextRequest) {
  try {
    const payload: ResendWebhookPayload = await request.json();

    // Map the event type
    const eventType = EVENT_TYPE_MAP[payload.type];
    if (!eventType) {
      // Unknown event type — acknowledge but skip processing
      logInfo('webhooks/resend', `Ignoring unknown event type: ${payload.type}`);
      return NextResponse.json({ received: true });
    }

    const emailId = payload.data?.email_id;
    const recipients = payload.data?.to || [];
    const subject = payload.data?.subject || null;

    if (!emailId || recipients.length === 0) {
      logWarn('webhooks/resend', 'Missing email_id or recipients', {
        type: payload.type,
        emailId,
        recipientCount: recipients.length,
      });
      return NextResponse.json({ received: true });
    }

    const supabase = createSupabaseAdminClient();

    // Process each recipient (usually just one)
    for (const recipientEmail of recipients) {
      // Look up lead by email in funnel_leads
      const { data: lead } = await supabase
        .from('funnel_leads')
        .select('id, user_id, lead_magnet_id')
        .eq('email', recipientEmail)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!lead) {
        logInfo('webhooks/resend', `No matching lead for ${recipientEmail}, skipping`, {
          emailId,
          eventType,
        });
        continue;
      }

      // Extract additional event-specific data
      let linkUrl: string | null = null;
      let bounceType: string | null = null;

      if (eventType === 'clicked' && payload.data?.click?.link) {
        linkUrl = payload.data.click.link;
      }

      if (eventType === 'bounced' && payload.data?.bounce?.type) {
        bounceType = payload.data.bounce.type;
      }

      // Insert the event
      const { error: insertError } = await supabase
        .from('email_events')
        .insert({
          email_id: emailId,
          lead_id: lead.id,
          lead_magnet_id: lead.lead_magnet_id || null,
          user_id: lead.user_id,
          event_type: eventType,
          recipient_email: recipientEmail,
          subject,
          link_url: linkUrl,
          bounce_type: bounceType,
          metadata: payload.data || {},
        });

      if (insertError) {
        logError('webhooks/resend', new Error(insertError.message), {
          step: 'insert_email_event',
          emailId,
          eventType,
          recipientEmail,
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logError('webhooks/resend', error, { step: 'resend_webhook_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
