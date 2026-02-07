// API Route: Get Extraction Questions / Process Extraction
// GET /api/lead-magnet/extract?archetype=single-system
// POST /api/lead-magnet/extract - Process answers

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getExtractionQuestions, processContentExtraction } from '@/lib/ai/lead-magnet-generator';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import type { LeadMagnetArchetype, LeadMagnetConcept, CallTranscriptInsights } from '@/lib/types/lead-magnet';

// GET - Get extraction questions for an archetype
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const archetype = searchParams.get('archetype') as LeadMagnetArchetype;

    if (!archetype) {
      return ApiErrors.validationError('Missing archetype parameter');
    }

    const questions = getExtractionQuestions(archetype);

    return NextResponse.json({ questions });
  } catch (error) {
    logApiError('lead-magnet/extract/questions', error);
    return ApiErrors.internalError('Failed to get extraction questions');
  }
}

// POST - Process extraction answers
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { archetype, concept, answers, transcriptInsights } = body as {
      archetype: LeadMagnetArchetype;
      concept: LeadMagnetConcept;
      answers: Record<string, string>;
      transcriptInsights?: CallTranscriptInsights;
    };

    if (!archetype || !concept || !answers) {
      return ApiErrors.validationError('Missing required fields: archetype, concept, answers');
    }

    // Pass transcript insights to enhance AI extraction with real customer data
    const extractedContent = await processContentExtraction(
      archetype,
      concept,
      answers,
      transcriptInsights
    );

    return NextResponse.json(extractedContent);
  } catch (error) {
    logApiError('lead-magnet/extract', error);
    return ApiErrors.aiError('Failed to process extraction');
  }
}
