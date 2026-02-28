// API Route: External Lead Magnet Creation Pipeline
// POST /api/external/create-lead-magnet
//
// Allows external systems (e.g., gtm-system) to programmatically create
// a complete lead magnet + funnel without manual user interaction.
// The heavy lifting is offloaded to a Trigger.dev background task.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { timingSafeEqual } from 'crypto';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { createLeadMagnetPipelineRun } from '@/server/services/external.service';
import { LEAD_MAGNET_ARCHETYPES } from '@/lib/types/lead-magnet';
import type { LeadMagnetArchetype } from '@/lib/types/lead-magnet';

// ============================================
// VALIDATION SCHEMA
// ============================================

const VALID_ARCHETYPES = LEAD_MAGNET_ARCHETYPES;

const requestSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  archetype: z.enum(VALID_ARCHETYPES, {
    errorMap: () => ({ message: `archetype must be one of: ${VALID_ARCHETYPES.join(', ')}` }),
  }),
  businessContext: z.object({
    businessDescription: z.string().min(1, 'businessDescription is required'),
    credibilityMarkers: z.array(z.string()).optional().default([]),
    urgentPains: z.array(z.string()).optional().default([]),
    processes: z.array(z.string()).optional().default([]),
    tools: z.array(z.string()).optional().default([]),
    results: z.array(z.string()).optional().default([]),
    frequentQuestions: z.array(z.string()).optional().default([]),
    successExample: z.string().optional(),
  }),
  topic: z.string().optional(),
  autoPublishFunnel: z.boolean().optional().default(true),
  autoSchedulePost: z.boolean().optional().default(false),
  scheduledTime: z.string().optional(),
});

// ============================================
// AUTHENTICATION
// ============================================

function authenticateRequest(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice(7);
  const expectedKey = process.env.EXTERNAL_API_KEY;

  if (!expectedKey) {
    logApiError('external/create-lead-magnet/auth', new Error('EXTERNAL_API_KEY env var is not set'));
    return false;
  }

  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expectedKey);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(tokenBuf, expectedBuf);
}

// ============================================
// MAIN HANDLER
// ============================================

export async function POST(request: Request) {
  try {
    if (!authenticateRequest(request)) {
      return ApiErrors.unauthorized('Invalid or missing API key');
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return ApiErrors.validationError('Invalid JSON in request body');
    }

    const parseResult = requestSchema.safeParse(body);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      return ApiErrors.validationError('Validation failed', errors);
    }

    const input = parseResult.data;
    const result = await createLeadMagnetPipelineRun({
      userId: input.userId,
      archetype: input.archetype as LeadMagnetArchetype,
      businessContext: input.businessContext,
      topic: input.topic,
      autoPublishFunnel: input.autoPublishFunnel,
      autoSchedulePost: input.autoSchedulePost,
      scheduledTime: input.scheduledTime,
    });

    if (!result.success) {
      if (result.error === 'user_not_found') return ApiErrors.notFound('User');
      return ApiErrors.databaseError('Failed to create lead magnet record');
    }

    return NextResponse.json(
      {
        success: true,
        leadMagnetId: result.leadMagnetId,
        status: result.status,
      },
      { status: 202 }
    );
  } catch (error) {
    logApiError('external/create-lead-magnet', error);
    return ApiErrors.internalError('An unexpected error occurred during lead magnet creation');
  }
}
