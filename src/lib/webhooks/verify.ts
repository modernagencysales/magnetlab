// Webhook signature verification utilities

import { NextRequest } from 'next/server';
import crypto from 'crypto';

export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
}

/**
 * Verify GTM System callback webhook
 * Uses a simple shared secret sent via x-webhook-secret header.
 */
/**
 * Verify Attio webhook signature (SHA256 HMAC).
 * Attio sends the signature in the `Attio-Signature` header.
 */
export function verifyAttioWebhook(
  rawBody: string,
  signature: string | null
): WebhookVerificationResult {
  const secret = process.env.ATTIO_WEBHOOK_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return { valid: false, error: 'ATTIO_WEBHOOK_SECRET not configured' };
    }
    return { valid: true };
  }

  if (!signature) {
    return { valid: false, error: 'Missing Attio-Signature header' };
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (sigBuffer.length !== expectedBuffer.length) {
    return { valid: false, error: 'Invalid webhook signature' };
  }

  const isValid = crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  return isValid ? { valid: true } : { valid: false, error: 'Invalid webhook signature' };
}

/**
 * Verify GTM System callback webhook
 * Uses a simple shared secret sent via x-webhook-secret header.
 */
export async function verifyGtmCallbackWebhook(
  request: NextRequest
): Promise<WebhookVerificationResult> {
  const secret = process.env.GTM_CALLBACK_SECRET;

  // Skip verification if no secret configured (development)
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return { valid: false, error: 'GTM_CALLBACK_SECRET not configured' };
    }
    return { valid: true };
  }

  const providedSecret = request.headers.get('x-webhook-secret');
  if (!providedSecret) {
    return { valid: false, error: 'Missing x-webhook-secret header' };
  }

  const secretBuffer = Buffer.from(secret);
  const providedBuffer = Buffer.from(providedSecret);

  if (secretBuffer.length !== providedBuffer.length) {
    return { valid: false, error: 'Invalid webhook secret' };
  }

  const isValid = crypto.timingSafeEqual(secretBuffer, providedBuffer);
  return isValid ? { valid: true } : { valid: false, error: 'Invalid webhook secret' };
}

