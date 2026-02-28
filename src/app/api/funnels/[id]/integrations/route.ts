import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, isValidUUID } from '@/lib/api/errors';
import * as funnelsService from '@/server/services/funnels.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

<<<<<<< HEAD
export async function GET(request: NextRequest, { params }: RouteParams) {
=======
// All providers accepted in funnel_integrations (email marketing + CRM)
const VALID_FUNNEL_PROVIDERS = ['kit', 'mailerlite', 'mailchimp', 'activecampaign', 'gohighlevel', 'heyreach'] as const;

function isValidFunnelProvider(s: string): boolean {
  return (VALID_FUNNEL_PROVIDERS as readonly string[]).includes(s);
}

// GET - List all integrations for this funnel page
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
>>>>>>> cd46c59795c3148789086a657c2176e3dd0f8a47
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id: funnelPageId } = await params;
    if (!isValidUUID(funnelPageId)) return ApiErrors.validationError('Invalid funnel page ID');

    const integrations = await funnelsService.getFunnelIntegrations(session.user.id, funnelPageId);
    return NextResponse.json({ integrations });
  } catch (error) {
    const status = funnelsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id: funnelPageId } = await params;
    if (!isValidUUID(funnelPageId)) return ApiErrors.validationError('Invalid funnel page ID');

    const body = await request.json();
    const integration = await funnelsService.upsertFunnelIntegration(session.user.id, funnelPageId, body);
    return NextResponse.json({ integration });
  } catch (error) {
    const status = funnelsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
