// POST /api/accelerator/enroll — create Stripe checkout for accelerator purchase

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { getOrCreateCustomer, createCheckoutSession } from '@/lib/integrations/stripe';
import {
  hasAcceleratorAccess,
  ACCELERATOR_STRIPE_PRICE_ID,
} from '@/lib/services/accelerator-enrollment';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.email) return ApiErrors.unauthorized();

    const userId = session.user.id;

    // Check if already enrolled
    const alreadyEnrolled = await hasAcceleratorAccess(userId);
    if (alreadyEnrolled) {
      return ApiErrors.validationError('You are already enrolled in the GTM Accelerator.');
    }

    if (!ACCELERATOR_STRIPE_PRICE_ID) {
      logApiError('accelerator/enroll', new Error('ACCELERATOR_STRIPE_PRICE_ID not configured'));
      return ApiErrors.internalError('Accelerator purchase is not configured.');
    }

    // Get or create Stripe customer
    const customer = await getOrCreateCustomer(
      userId,
      session.user.email,
      session.user.name ?? undefined
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Create one-time payment checkout (mode: 'payment', not 'subscription')
    const checkoutSession = await createCheckoutSession({
      customerId: customer.id,
      priceId: ACCELERATOR_STRIPE_PRICE_ID,
      successUrl: `${appUrl}/accelerator?enrolled=success`,
      cancelUrl: `${appUrl}/accelerator?enrolled=canceled`,
      metadata: {
        userId,
        product: 'accelerator',
      },
      mode: 'payment',
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    logApiError('accelerator/enroll', error);
    return ApiErrors.internalError('Failed to create checkout session.');
  }
}
