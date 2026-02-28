/**
 * Subscriptions Repository (subscriptions table)
 * ALL Supabase for subscription / Stripe customer state.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export interface SubscriptionRow {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
}

export async function getByUserId(userId: string): Promise<SubscriptionRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_start, current_period_end, cancel_at_period_end')
    .eq('user_id', userId)
    .single();
  return data as SubscriptionRow | null;
}

export async function getByStripeCustomerId(customerId: string): Promise<{ user_id: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single();
  return data as { user_id: string } | null;
}

export async function getByStripeSubscriptionId(subscriptionId: string): Promise<{ user_id: string } | null> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();
  return data as { user_id: string } | null;
}

export async function setStripeCustomerId(userId: string, customerId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('subscriptions')
    .update({ stripe_customer_id: customerId })
    .eq('user_id', userId);
  if (error) throw new Error(`subscription.setStripeCustomerId: ${error.message}`);
}

export async function updateSubscription(
  userId: string,
  updates: {
    stripe_subscription_id?: string | null;
    plan?: string;
    status?: string;
    current_period_start?: string;
    current_period_end?: string;
    cancel_at_period_end?: boolean;
  },
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('subscriptions').update(updates).eq('user_id', userId);
  if (error) throw new Error(`subscription.updateSubscription: ${error.message}`);
}
