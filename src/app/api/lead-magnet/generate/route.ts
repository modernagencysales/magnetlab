import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors } from '@/lib/api/errors';
import type { LeadMagnetArchetype, LeadMagnetConcept } from '@/lib/types/lead-magnet';
import * as leadMagnetsService from '@/server/services/lead-magnets.service';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { archetype, concept, answers, leadMagnetId } = body as {
      archetype: LeadMagnetArchetype;
      concept: LeadMagnetConcept;
      answers: Record<string, string>;
      leadMagnetId?: string;
    };

    const extractedContent = await leadMagnetsService.generateFromExtraction(session.user.id, {
      archetype,
      concept,
      answers,
      leadMagnetId,
    });
    return NextResponse.json(extractedContent);
  } catch (error) {
    const status = leadMagnetsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
