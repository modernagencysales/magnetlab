// POST /api/stripe/webhook — Stripe webhook handler

import { NextResponse } from 'next/server';
import { logApiError } from '@/lib/api/errors';
import * as stripeService from '@/server/services/stripe.service';

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    let event;
    try {
      event = stripeService.verifyWebhookSignature(body, signature);
    } catch (err) {
      logApiError('stripe/webhook/verify', err);
      return NextResponse.json({ error: 'Invalid signature', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    await stripeService.handleWebhookEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    logApiError('stripe/webhook', error);
    return NextResponse.json(
      { error: 'Webhook handler failed', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
