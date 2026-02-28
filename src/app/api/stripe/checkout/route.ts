// POST /api/stripe/checkout — create checkout session

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import type { SubscriptionPlan } from '@/lib/types/integrations';
import * as stripeService from '@/server/services/stripe.service';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) return ApiErrors.unauthorized();

    const body = await request.json();
    const { plan } = body as { plan: SubscriptionPlan };

    if (!plan || plan === 'free') return ApiErrors.validationError('Invalid plan');

    const result = await stripeService.createCheckout(
      session.user.id,
      session.user.email,
      session.user.name ?? undefined,
      plan,
    );
    return NextResponse.json(result);
  } catch (error) {
    logApiError('stripe/checkout', error);
    return ApiErrors.internalError('Failed to create checkout session');
  }
}
