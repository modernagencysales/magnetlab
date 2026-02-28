// API Route: External Funnels List and Create
// GET /api/external/funnels?leadMagnetId=xxx - Get funnel for lead magnet
// POST /api/external/funnels - Create new funnel page
//
// Authenticated via withExternalAuth (service-to-service auth)

import { NextRequest, NextResponse } from 'next/server';
import { withExternalAuth, ExternalAuthContext } from '@/lib/middleware/external-auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { getFunnelByLeadMagnet, createFunnelExternal } from '@/server/services/external.service';

async function handleGet(request: NextRequest, context: ExternalAuthContext): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const leadMagnetId = searchParams.get('leadMagnetId');
    if (!leadMagnetId) return ApiErrors.validationError('leadMagnetId is required');

    const result = await getFunnelByLeadMagnet(leadMagnetId, context.userId);
    if (!result.success) {
      if (result.error === 'lead_magnet_not_found') return ApiErrors.notFound('Lead magnet');
      return ApiErrors.databaseError('Failed to fetch funnel page');
    }
    return NextResponse.json({ funnel: result.funnel });
  } catch (error) {
    logApiError('external/funnels/get', error);
    return ApiErrors.internalError('Failed to fetch funnel page');
  }
}

async function handlePost(
  _request: NextRequest,
  context: ExternalAuthContext,
  body: unknown
): Promise<NextResponse> {
  try {
    const reqBody = body as Record<string, unknown>;
    const { leadMagnetId, slug, ...funnelData } = reqBody;
    if (!leadMagnetId || !slug) return ApiErrors.validationError('leadMagnetId and slug are required');

    const result = await createFunnelExternal({
      userId: context.userId,
      leadMagnetId: leadMagnetId as string,
      slug: slug as string,
      optinHeadline: funnelData.optinHeadline as string | undefined,
      optinSubline: funnelData.optinSubline as string | undefined,
      optinButtonText: funnelData.optinButtonText as string | undefined,
      optinSocialProof: funnelData.optinSocialProof as string | undefined,
      thankyouHeadline: funnelData.thankyouHeadline as string | undefined,
      thankyouSubline: funnelData.thankyouSubline as string | undefined,
      vslUrl: funnelData.vslUrl as string | undefined,
      calendlyUrl: funnelData.calendlyUrl as string | undefined,
      qualificationPassMessage: funnelData.qualificationPassMessage as string | undefined,
      qualificationFailMessage: funnelData.qualificationFailMessage as string | undefined,
      theme: funnelData.theme as string | undefined,
      primaryColor: funnelData.primaryColor as string | undefined,
      backgroundStyle: funnelData.backgroundStyle as string | undefined,
      logoUrl: funnelData.logoUrl as string | undefined,
    });

    if (!result.success) {
      if (result.error === 'lead_magnet_not_found') return ApiErrors.notFound('Lead magnet');
      if (result.error === 'funnel_exists') return ApiErrors.conflict('Funnel page already exists for this lead magnet');
      return ApiErrors.databaseError('Failed to create funnel page');
    }
    return NextResponse.json({ funnel: result.funnel }, { status: 201 });
  } catch (error) {
    logApiError('external/funnels/create', error);
    return ApiErrors.internalError('Failed to create funnel page');
  }
}

export const GET = withExternalAuth(async (request, context) => handleGet(request, context));
export const POST = withExternalAuth(async (request, context, body) => handlePost(request, context, body));
