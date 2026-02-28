// Resend Webhook Handler
// POST /api/webhooks/resend - Processes Resend email events, stores in email_events.

import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { logError, logWarn } from '@/lib/utils/logger';
import * as webhooksIncomingService from '@/server/services/webhooks-incoming.service';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (webhookSecret) {
      const svixId = request.headers.get('svix-id');
      const svixTimestamp = request.headers.get('svix-timestamp');
      const svixSignature = request.headers.get('svix-signature');

      if (!svixId || !svixTimestamp || !svixSignature) {
        logWarn('webhooks/resend', 'Missing Svix signature headers');
        return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 });
      }

      try {
        const wh = new Webhook(webhookSecret);
        wh.verify(rawBody, {
          'svix-id': svixId,
          'svix-timestamp': svixTimestamp,
          'svix-signature': svixSignature,
        });
      } catch (verifyError) {
        logError('webhooks/resend', verifyError, { step: 'signature_verification' });
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    } else {
      logWarn('webhooks/resend', 'RESEND_WEBHOOK_SECRET not set — skipping signature verification');
    }

    const payload = JSON.parse(rawBody);
    const result = await webhooksIncomingService.handleResend(payload);
    return NextResponse.json(result);
  } catch (error) {
    logError('webhooks/resend', error, { step: 'resend_webhook_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
