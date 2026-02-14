// API Route: Stripe Webhook Handler
// POST /api/stripe/webhook

import { NextResponse } from 'next/server';
import { constructWebhookEvent, parseSubscriptionEvent } from '@/lib/integrations/stripe';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logApiError } from '@/lib/api/errors';
import Stripe from 'stripe';
import { getPostHogServerClient } from '@/lib/posthog';

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = constructWebhookEvent(body, signature);
    } catch (err) {
      logApiError('stripe/webhook/verify', err);
      return NextResponse.json({ error: 'Invalid signature', code: 'VALIDATION_ERROR' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode === 'subscription' && session.subscription) {
          // Handled by subscription.created
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const data = parseSubscriptionEvent(subscription);

        // Find user by customer ID
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', data.customerId)
          .single();

        if (existingSub) {
          await supabase
            .from('subscriptions')
            .update({
              stripe_subscription_id: data.subscriptionId,
              plan: data.plan,
              status: data.status === 'active' ? 'active' :
                     data.status === 'canceled' ? 'canceled' :
                     data.status === 'past_due' ? 'past_due' : 'active',
              current_period_start: data.currentPeriodStart.toISOString(),
              current_period_end: data.currentPeriodEnd.toISOString(),
              cancel_at_period_end: data.cancelAtPeriodEnd,
            })
            .eq('user_id', existingSub.user_id);

          try { getPostHogServerClient()?.capture({ distinctId: existingSub.user_id, event: 'subscription_updated', properties: { plan: data.plan, status: data.status } }); } catch {}
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        // Downgrade to free
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (existingSub) {
          await supabase
            .from('subscriptions')
            .update({
              plan: 'free',
              status: 'canceled',
              stripe_subscription_id: null,
            })
            .eq('user_id', existingSub.user_id);

          try { getPostHogServerClient()?.capture({ distinctId: existingSub.user_id, event: 'subscription_canceled' }); } catch {}
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        // Stripe API 2026-01-28.clover moved subscription to parent.subscription_details
        const subscriptionId = (invoice.parent?.subscription_details?.subscription as string) || '';

        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscriptionId)
          .single();

        if (existingSub) {
          await supabase
            .from('subscriptions')
            .update({ status: 'past_due' })
            .eq('user_id', existingSub.user_id);

          try { getPostHogServerClient()?.capture({ distinctId: existingSub.user_id, event: 'payment_failed' }); } catch {}
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    logApiError('stripe/webhook', error);
    return NextResponse.json(
      { error: 'Webhook handler failed', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
