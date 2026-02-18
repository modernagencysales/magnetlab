// API Route: Generate Email Sequence
// POST /api/email-sequence/generate - Generate 5-email welcome sequence

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateEmailSequence, generateDefaultEmailSequence } from '@/lib/ai/email-sequence-generator';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import type { EmailGenerationContext, EmailSequenceRow } from '@/lib/types/email';
import { emailSequenceFromRow } from '@/lib/types/email';
import { checkResourceLimit } from '@/lib/auth/plan-limits';

// POST - Generate email sequence for a lead magnet
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    // Check plan-based resource limit
    const limitCheck = await checkResourceLimit(session.user.id, 'email_sequences');
    if (!limitCheck.allowed) {
      return NextResponse.json({
        error: 'Plan limit reached',
        current: limitCheck.current,
        limit: limitCheck.limit,
        upgrade: '/settings#billing',
      }, { status: 403 });
    }

    const body = await request.json();
    const { leadMagnetId, useAI = true } = body;

    if (!leadMagnetId) {
      return ApiErrors.validationError('leadMagnetId is required');
    }

    const supabase = createSupabaseAdminClient();

    // Get the lead magnet (include team_id so we can propagate it)
    const { data: leadMagnet, error: lmError } = await supabase
      .from('lead_magnets')
      .select('id, user_id, team_id, title, archetype, concept, extracted_content')
      .eq('id', leadMagnetId)
      .eq('user_id', session.user.id)
      .single();

    if (lmError || !leadMagnet) {
      return ApiErrors.notFound('Lead magnet');
    }

    // Get brand kit for sender name and content links
    const { data: brandKit } = await supabase
      .from('brand_kits')
      .select('business_description, sender_name, best_video_url, best_video_title, content_links, community_url')
      .eq('user_id', session.user.id)
      .single();

    // Get user name as fallback for sender name
    const { data: user } = await supabase
      .from('users')
      .select('name')
      .eq('id', session.user.id)
      .single();

    const senderName = brandKit?.sender_name || user?.name || 'Your Friend';

    // Build generation context
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

    let emails;

    if (useAI) {
      try {
        emails = await generateEmailSequence({ context });
      } catch (aiError) {
        logApiError('email-sequence/generate/ai', aiError, { leadMagnetId, note: 'Falling back to default' });
        emails = generateDefaultEmailSequence(leadMagnet.title, senderName);
      }
    } else {
      emails = generateDefaultEmailSequence(leadMagnet.title, senderName);
    }

    // Use admin client for upsert to bypass RLS during insert
    const adminSupabase = createSupabaseAdminClient();

    // Upsert email sequence (update if exists, create if not)
    const { data: emailSequence, error: upsertError } = await adminSupabase
      .from('email_sequences')
      .upsert(
        {
          lead_magnet_id: leadMagnetId,
          user_id: session.user.id,
          team_id: leadMagnet.team_id || null,
          emails,
          status: 'draft',
        },
        {
          onConflict: 'lead_magnet_id',
        }
      )
      .select('id, lead_magnet_id, user_id, emails, loops_synced_at, loops_transactional_ids, status, created_at, updated_at')
      .single();

    if (upsertError || !emailSequence) {
      logApiError('email-sequence/generate/save', upsertError, { leadMagnetId });
      return ApiErrors.databaseError('Failed to save email sequence');
    }

    return NextResponse.json({
      emailSequence: emailSequenceFromRow(emailSequence as EmailSequenceRow),
      generated: true,
    });
  } catch (error) {
    logApiError('email-sequence/generate', error);
    return ApiErrors.internalError('Failed to generate email sequence');
  }
}
