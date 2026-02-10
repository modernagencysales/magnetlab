// Verify Integration API
// POST /api/integrations/verify - Test an integration's API key
//
// Note: This endpoint verifies the provided API key before storing it encrypted.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateIntegrationVerified } from '@/lib/utils/encrypted-storage';
import { LeadSharkClient } from '@/lib/integrations/leadshark';
import { LoopsClient } from '@/lib/integrations/loops';
import { Resend } from 'resend';
import { ApiErrors, logApiError } from '@/lib/api/errors';

// POST - Verify an integration's API key
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { service, api_key, metadata } = body;

    if (!service || !api_key) {
      return ApiErrors.validationError('Service and api_key are required');
    }

    let verified = false;
    let error: string | null = null;

    // Verify based on service type
    switch (service) {
      case 'leadshark': {
        const client = new LeadSharkClient({ apiKey: api_key });
        const result = await client.verifyConnection();
        verified = result.connected;
        error = result.error || null;
        break;
      }
      case 'loops': {
        const client = new LoopsClient({ apiKey: api_key });
        const result = await client.verifyConnection();
        verified = result.connected;
        error = result.error || null;
        break;
      }
      case 'resend': {
        try {
          const resend = new Resend(api_key);
          // Verify by listing domains - this confirms the API key is valid
          const { error: resendError } = await resend.domains.list();
          if (resendError) {
            verified = false;
            error = resendError.message || 'Invalid API key';
          } else {
            verified = true;
          }
        } catch (err) {
          verified = false;
          error = err instanceof Error ? err.message : 'Failed to verify Resend API key';
        }
        break;
      }
      case 'conductor': {
        try {
          const endpointUrl = metadata?.endpointUrl;
          if (!endpointUrl || typeof endpointUrl !== 'string' || !endpointUrl.startsWith('https://')) {
            verified = false;
            error = 'A valid HTTPS Conductor endpoint URL is required';
            break;
          }
          const res = await fetch(`${endpointUrl}/api/webhooks/conductor/verify`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${api_key}` },
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) {
            verified = true;
          } else {
            verified = false;
            const errData = await res.json().catch(() => ({}));
            error = errData.error || `Verification failed (status ${res.status})`;
          }
        } catch (err) {
          verified = false;
          error = err instanceof Error ? err.message : 'Failed to verify Conductor connection';
        }
        break;
      }
      default:
        return ApiErrors.validationError(`Unknown service: ${service}`);
    }

    // If verified, update the last_verified_at timestamp
    if (verified) {
      await updateIntegrationVerified(session.user.id, service);
    }

    return NextResponse.json({
      verified,
      error,
    });
  } catch (error) {
    logApiError('integrations/verify', error);
    return ApiErrors.internalError(error instanceof Error ? error.message : 'Verification failed');
  }
}
