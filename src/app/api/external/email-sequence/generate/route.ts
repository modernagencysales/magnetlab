// API Route: External Email Sequence Generation
// POST /api/external/email-sequence/generate
//
// Generates a 5-email welcome sequence for a lead magnet.
// Uses Bearer token auth (EXTERNAL_API_KEY) instead of session auth.
// Accepts userId in the request body instead of reading from session.

import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateEmailSequence, generateDefaultEmailSequence } from '@/lib/ai/email-sequence-generator';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import type { EmailGenerationContext, EmailSequenceRow } from '@/lib/types/email';
import { emailSequenceFromRow } from '@/lib/types/email';
import { authenticateExternalRequest } from '@/lib/api/external-auth';

export async function POST(request: Request) {
  try {
    // Step 1: Authenticate via Bearer token
    if (!authenticateExternalRequest(request)) {
      return ApiErrors.unauthorized('Invalid or missing API key');
    }

    // Step 2: Parse request body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return ApiErrors.validationError('Invalid JSON in request body');
    }

    const { userId, leadMagnetId, useAI = true } = body as {
      userId?: string;
      leadMagnetId?: string;
      useAI?: boolean;
    };

    if (!userId || typeof userId !== 'string') {
      return ApiErrors.validationError('userId is required');
    }
    if (!leadMagnetId || typeof leadMagnetId !== 'string') {
      return ApiErrors.validationError('leadMagnetId is required');
    }

    const supabase = createSupabaseAdminClient();

    // Step 3: Get the lead magnet (include team_id so we can propagate it)
    const { data: leadMagnet, error: lmError } = await supabase
      .from('lead_magnets')
      .select('id, user_id, team_id, title, archetype, concept, extracted_content')
      .eq('id', leadMagnetId)
      .eq('user_id', userId)
      .single();

    if (lmError || !leadMagnet) {
      return ApiErrors.notFound('Lead magnet');
    }

    // Step 4: Get brand kit for sender name and content links
    const { data: brandKit } = await supabase
      .from('brand_kits')
      .select('business_description, sender_name, best_video_url, best_video_title, content_links, community_url')
      .eq('user_id', userId)
      .single();

    // Step 5: Get user name as fallback for sender name
    const { data: user } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    const senderName = brandKit?.sender_name || user?.name || 'Your Friend';

    // Step 6: Build generation context
    const concept = leadMagnet.concept as { contents?: string; deliveryFormat?: string } | null;
    const extractedContent = leadMagnet.extracted_content as { title?: string; format?: string } | null;

    const context: EmailGenerationContext = {
      leadMagnetTitle: leadMagnet.title,
      leadMagnetFormat: extractedContent?.format || concept?.deliveryFormat || leadMagnet.archetype,
      leadMagnetContents: concept?.contents || extractedContent?.title || '',
      senderName,
      businessDescription: brandKit?.business_description || '',
      bestVideoUrl: brandKit?.best_video_url || undefined,
      bestVideoTitle: brandKit?.best_video_title || undefined,
      contentLinks: brandKit?.content_links as Array<{ title: string; url: string }> | undefined,
      communityUrl: brandKit?.community_url || undefined,
      audienceStyle: 'casual-direct',
    };

    // Step 7: Generate emails (AI with fallback)
    let emails;

    if (useAI) {
      try {
        emails = await generateEmailSequence({ context });
      } catch (aiError) {
        logApiError('external/email-sequence/generate/ai', aiError, { leadMagnetId, note: 'Falling back to default' });
        emails = generateDefaultEmailSequence(leadMagnet.title, senderName);
      }
    } else {
      emails = generateDefaultEmailSequence(leadMagnet.title, senderName);
    }

    // Step 8: Upsert email sequence
    const { data: emailSequence, error: upsertError } = await supabase
      .from('email_sequences')
      .upsert(
        {
          lead_magnet_id: leadMagnetId,
          user_id: userId,
          team_id: leadMagnet.team_id || null,
          emails,
          status: 'draft',
        },
        {
          onConflict: 'lead_magnet_id',
        }
      )
      .select('id, lead_magnet_id, user_id, emails, status, created_at, updated_at')
      .single();

    if (upsertError || !emailSequence) {
      logApiError('external/email-sequence/generate/save', upsertError, { leadMagnetId });
      return ApiErrors.databaseError('Failed to save email sequence');
    }

    return NextResponse.json({
      emailSequence: emailSequenceFromRow(emailSequence as EmailSequenceRow),
      generated: true,
    });
  } catch (error) {
    logApiError('external/email-sequence/generate', error);
    return ApiErrors.internalError('Failed to generate email sequence');
  }
}
