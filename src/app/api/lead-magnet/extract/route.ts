// API Route: Get Extraction Questions / Process Extraction
// GET /api/lead-magnet/extract?archetype=single-system
// GET /api/lead-magnet/extract?archetype=single-system&contextAware=true (+ body with concept + context)
// POST /api/lead-magnet/extract - Process answers

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getExtractionQuestions, getContextAwareExtractionQuestions, processContentExtraction } from '@/lib/ai/lead-magnet-generator';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import type { LeadMagnetArchetype, LeadMagnetConcept, BusinessContext, CallTranscriptInsights, InteractiveConfig } from '@/lib/types/lead-magnet';

// GET - Get extraction questions for an archetype (static, fast)
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

// POST - Process extraction answers OR get context-aware questions
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();

    // Context-aware questions mode: { action: 'contextual-questions', archetype, concept, businessContext }
    if (body.action === 'contextual-questions') {
      const { archetype, concept, businessContext } = body as {
        action: string;
        archetype: LeadMagnetArchetype;
        concept: LeadMagnetConcept;
        businessContext: BusinessContext;
      };

      if (!archetype || !concept || !businessContext) {
        return ApiErrors.validationError('Missing required fields: archetype, concept, businessContext');
      }

      const questions = await getContextAwareExtractionQuestions(archetype, concept, businessContext);
      return NextResponse.json({ questions });
    }

    // Interactive generation mode: { action: 'generate-interactive', archetype, concept, answers, businessContext, transcriptInsights }
    if (body.action === 'generate-interactive') {
      const { archetype, concept, answers, businessContext, transcriptInsights } = body as {
        action: string;
        archetype: LeadMagnetArchetype;
        concept: LeadMagnetConcept;
        answers: Record<string, string>;
        businessContext?: BusinessContext;
        transcriptInsights?: CallTranscriptInsights;
      };

      // Import helpers
      const { isInteractiveArchetype, getInteractiveType } = await import('@/lib/types/lead-magnet');

      if (!isInteractiveArchetype(archetype)) {
        return ApiErrors.validationError('Archetype is not interactive');
      }

      const interactiveType = getInteractiveType(archetype);
      const { generateCalculatorConfig, generateAssessmentConfig, generateGPTConfig } = await import('@/lib/ai/interactive-generators');

      let config: InteractiveConfig;
      switch (interactiveType) {
        case 'calculator':
          config = await generateCalculatorConfig(concept, answers, transcriptInsights);
          break;
        case 'assessment':
          config = await generateAssessmentConfig(concept, answers, transcriptInsights);
          break;
        case 'gpt':
          config = await generateGPTConfig(concept, answers, businessContext as unknown as Record<string, unknown>, transcriptInsights);
          break;
        default:
          return ApiErrors.validationError('Unknown interactive type');
      }

      return NextResponse.json({ interactiveConfig: config });
    }

    // Default: process extraction answers
    const { archetype, concept, answers, transcriptInsights } = body as {
      archetype: LeadMagnetArchetype;
      concept: LeadMagnetConcept;
      answers: Record<string, string>;
      transcriptInsights?: CallTranscriptInsights;
    };

    if (!archetype || !concept || !answers) {
      return ApiErrors.validationError('Missing required fields: archetype, concept, answers');
    }

    // Pass transcript insights and userId to enhance AI extraction with real customer data
    const extractedContent = await processContentExtraction(
      archetype,
      concept,
      answers,
      transcriptInsights,
      session.user.id
    );

    return NextResponse.json(extractedContent);
  } catch (error) {
    logApiError('lead-magnet/extract', error);
    return ApiErrors.aiError('Failed to process extraction');
  }
}
