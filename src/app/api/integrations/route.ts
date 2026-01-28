// User Integrations API
// GET /api/integrations - List user's integrations
// POST /api/integrations - Save/update an integration
//
// Note: API keys are encrypted at rest using Supabase Vault.
// This route uses encrypted storage utilities that handle encryption/decryption transparently.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  listUserIntegrations,
  upsertUserIntegration,
} from '@/lib/utils/encrypted-storage';

// GET - List all integrations for the user
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // List integrations without exposing API keys (decryption not performed)
    const integrations = await listUserIntegrations(session.user.id);

    return NextResponse.json({
      integrations,
    });
  } catch (error) {
    console.error('Error in integrations GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Save or update an integration
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { service, api_key, webhook_secret, metadata } = body;

    if (!service) {
      return NextResponse.json({ error: 'Service is required' }, { status: 400 });
    }

    // Upsert the integration with encrypted API key
    const integration = await upsertUserIntegration({
      userId: session.user.id,
      service,
      apiKey: api_key || null,
      webhookSecret: webhook_secret || null,
      isActive: !!api_key,
      metadata: metadata || {},
    });

    return NextResponse.json({
      integration,
      message: 'Integration saved successfully',
    });
  } catch (error) {
    console.error('Error in integrations POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
