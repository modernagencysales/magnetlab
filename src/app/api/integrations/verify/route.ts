// Verify Integration API
// POST /api/integrations/verify - Test an integration's API key
//
// Note: This endpoint verifies the provided API key before storing it encrypted.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { updateIntegrationVerified } from '@/lib/utils/encrypted-storage';
import { LeadSharkClient } from '@/lib/integrations/leadshark';

// POST - Verify an integration's API key
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { service, api_key } = body;

    if (!service || !api_key) {
      return NextResponse.json(
        { error: 'Service and api_key are required' },
        { status: 400 }
      );
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
      default:
        return NextResponse.json(
          { error: `Unknown service: ${service}` },
          { status: 400 }
        );
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
    console.error('Error verifying integration:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Verification failed' },
      { status: 500 }
    );
  }
}
