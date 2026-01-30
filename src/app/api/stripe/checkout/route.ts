// API Route: Create Stripe Checkout Session
// POST /api/stripe/checkout

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createCheckoutSession, getOrCreateCustomer, STRIPE_PRICE_IDS } from '@/lib/integrations/stripe';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import type { SubscriptionPlan } from '@/lib/types/integrations';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { plan } = body as { plan: SubscriptionPlan };

    if (!plan || plan === 'free') {
      return ApiErrors.validationError('Invalid plan');
    }

    const priceId = STRIPE_PRICE_IDS[plan];
    if (!priceId) {
      return ApiErrors.validationError('Plan not available');
    }

    // Get existing customer ID if any
    const supabase = createSupabaseAdminClient();
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', session.user.id)
      .single();

    // Get or create Stripe customer
    const customer = await getOrCreateCustomer(
      session.user.id,
      session.user.email,
      session.user.name || undefined,
      subscription?.stripe_customer_id || undefined
    );

    // Update subscription with customer ID if new
    if (!subscription?.stripe_customer_id) {
      await supabase
        .from('subscriptions')
        .update({ stripe_customer_id: customer.id })
        .eq('user_id', session.user.id);
    }

    // Create checkout session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const checkoutSession = await createCheckoutSession({
      customerId: customer.id,
      priceId,
      successUrl: `${appUrl}/settings?upgrade=success`,
      cancelUrl: `${appUrl}/settings?upgrade=canceled`,
      metadata: {
        userId: session.user.id,
        plan,
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    logApiError('stripe/checkout', error);
    return ApiErrors.internalError('Failed to create checkout session');
  }
}
