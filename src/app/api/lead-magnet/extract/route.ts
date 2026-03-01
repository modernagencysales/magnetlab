import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors } from '@/lib/api/errors';
import type { LeadMagnetArchetype } from '@/lib/types/lead-magnet';
import * as leadMagnetsService from '@/server/services/lead-magnets.service';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { searchParams } = new URL(request.url);
    const archetype = searchParams.get('archetype') as LeadMagnetArchetype;

    if (!archetype) return ApiErrors.validationError('Missing archetype parameter');

    const result = leadMagnetsService.getExtractionQuestionsForArchetype(archetype);
    return NextResponse.json(result);
  } catch (error) {
    const status = leadMagnetsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();

    // Context-aware questions: synchronous, no background job
    if (body.action === 'contextual-questions') {
      const { archetype, concept, businessContext } = body;
      if (!archetype || !concept || !businessContext) {
        return ApiErrors.validationError('Missing required fields: archetype, concept, businessContext');
      }
      const result = await leadMagnetsService.getContextualQuestions(archetype, concept, businessContext);
      return NextResponse.json(result);
    }

    // Background extraction job
    const result = await leadMagnetsService.startExtraction(session.user.id, body);
    return NextResponse.json(result);
  } catch (error) {
    const status = leadMagnetsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
