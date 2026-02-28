import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors } from '@/lib/api/errors';
import type { BusinessContext, CallTranscriptInsights, CompetitorAnalysis } from '@/lib/types/lead-magnet';
import * as leadMagnetsService from '@/server/services/lead-magnets.service';

interface IdeateRequestBody extends BusinessContext {
  sources?: {
    callTranscriptInsights?: CallTranscriptInsights;
    competitorAnalysis?: CompetitorAnalysis;
  };
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json() as IdeateRequestBody;
    const result = await leadMagnetsService.startIdeation(session.user.id, body);
    return NextResponse.json(result);
  } catch (error) {
    const status = leadMagnetsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
