// API Route: External Lead Magnet Creation Pipeline
// POST /api/external/create-lead-magnet
//
// Allows external systems (e.g., gtm-system) to programmatically create
// a complete lead magnet + funnel without manual user interaction.
// The heavy lifting is offloaded to a Trigger.dev background task.

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { timingSafeEqual } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { createLeadMagnetPipeline } from '@/trigger/create-lead-magnet';
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
    // Step 1: Authenticate
    if (!authenticateRequest(request)) {
      return ApiErrors.unauthorized('Invalid or missing API key');
    }

    // Step 2: Parse and validate request body
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
    const archetype = input.archetype as LeadMagnetArchetype;

    // Step 3: Verify user exists
    const supabase = createSupabaseAdminClient();
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, name, username')
      .eq('id', input.userId)
      .single();

    if (userError || !user) {
      return ApiErrors.notFound('User');
    }

    // Step 4: Create stub lead magnet record
    const { data: leadMagnet, error: createError } = await supabase
      .from('lead_magnets')
      .insert({
        user_id: input.userId,
        title: `${archetype} lead magnet`,
        archetype,
        status: 'draft',
      })
      .select('id')
      .single();

    if (createError || !leadMagnet) {
      logApiError('external/create-lead-magnet/db-create', createError, { userId: input.userId });
      return ApiErrors.databaseError('Failed to create lead magnet record');
    }

    // Step 5: Trigger the background pipeline
    await createLeadMagnetPipeline.trigger({
      userId: input.userId,
      userName: user.name,
      username: user.username,
      archetype,
      businessContext: input.businessContext,
      topic: input.topic,
      autoPublishFunnel: input.autoPublishFunnel,
      autoSchedulePost: input.autoSchedulePost,
      scheduledTime: input.scheduledTime,
      leadMagnetId: leadMagnet.id,
    });

    // Step 6: Return immediately
    return NextResponse.json(
      {
        success: true,
        leadMagnetId: leadMagnet.id,
        status: 'processing',
      },
      { status: 202 }
    );
  } catch (error) {
    logApiError('external/create-lead-magnet', error);
    return ApiErrors.internalError('An unexpected error occurred during lead magnet creation');
  }
}
