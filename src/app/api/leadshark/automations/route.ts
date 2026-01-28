// LeadShark Automations API
// GET /api/leadshark/automations - List all automations
// POST /api/leadshark/automations - Create a new automation

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserLeadSharkClient } from '@/lib/integrations/leadshark';
import { ApiErrors, logApiError } from '@/lib/api/errors';

// GET - List all automations
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const client = await getUserLeadSharkClient(session.user.id);
    if (!client) {
      return ApiErrors.validationError('LeadShark not connected. Add your API key in Settings.');
    }

    const result = await client.listAutomations();

    if (result.error) {
      return ApiErrors.internalError(result.error);
    }

    return NextResponse.json({
      automations: result.data || [],
    });
  } catch (error) {
    logApiError('leadshark/automations', error);
    return ApiErrors.internalError(error instanceof Error ? error.message : 'Failed to fetch automations');
  }
}

// POST - Create a new automation
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const client = await getUserLeadSharkClient(session.user.id);
    if (!client) {
      return ApiErrors.validationError('LeadShark not connected. Add your API key in Settings.');
    }

    const body = await request.json();
    const result = await client.createAutomation(body);

    if (result.error) {
      return ApiErrors.internalError(result.error);
    }

    return NextResponse.json({
      automation: result.data,
    });
  } catch (error) {
    logApiError('leadshark/automations/create', error);
    return ApiErrors.internalError(error instanceof Error ? error.message : 'Failed to create automation');
  }
}
