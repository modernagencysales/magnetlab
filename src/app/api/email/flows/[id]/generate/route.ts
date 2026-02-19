// API Route: AI-Generate Email Steps for a Flow
// POST /api/email/flows/[id]/generate — Generate email steps using Claude AI

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import { generateEmailSequence, generateDefaultEmailSequence } from '@/lib/ai/email-sequence-generator';
import type { EmailGenerationContext } from '@/lib/types/email';

const STEP_COLUMNS =
  'id, flow_id, step_number, subject, body, delay_days, created_at, updated_at';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST — AI-generate email flow steps
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id: flowId } = await params;
    if (!isValidUUID(flowId)) {
      return ApiErrors.validationError('Invalid flow ID');
    }

    // Parse optional body (stepCount)
    let stepCount = 5;
    try {
      const body = await request.json();
      if (body.stepCount && typeof body.stepCount === 'number' && body.stepCount >= 1 && body.stepCount <= 10) {
        stepCount = body.stepCount;
      }
    } catch {
      // Empty body is fine, use defaults
    }

    const supabase = createSupabaseAdminClient();
    const scope = await getDataScope(session.user.id);

    if (scope.type !== 'team' || !scope.teamId) {
      return ApiErrors.validationError('No team found for this user');
    }

    // Verify flow belongs to team
    const { data: flow, error: flowError } = await supabase
      .from('email_flows')
      .select('id, name, description, trigger_type, trigger_lead_magnet_id, status')
      .eq('id', flowId)
      .eq('team_id', scope.teamId)
      .single();

    if (flowError || !flow) {
      return ApiErrors.notFound('Flow');
    }

    // Build AI context from lead magnet + brand kit (if available)
    let leadMagnetTitle = flow.name;
    let leadMagnetFormat = 'guide';
    let leadMagnetContents = flow.description || '';

    if (flow.trigger_type === 'lead_magnet' && flow.trigger_lead_magnet_id) {
      const { data: leadMagnet } = await supabase
        .from('lead_magnets')
        .select('id, title, archetype, concept, extracted_content')
        .eq('id', flow.trigger_lead_magnet_id)
        .eq('user_id', session.user.id)
        .single();

      if (leadMagnet) {
        leadMagnetTitle = leadMagnet.title;
        const concept = leadMagnet.concept as { contents?: string; deliveryFormat?: string } | null;
        const extracted = leadMagnet.extracted_content as { title?: string; format?: string } | null;
        leadMagnetFormat = extracted?.format || concept?.deliveryFormat || leadMagnet.archetype || 'guide';
        leadMagnetContents = concept?.contents || extracted?.title || '';
      }
    }

    // Get brand kit for sender name and content links
    const { data: brandKit } = await supabase
      .from('brand_kits')
      .select('business_description, sender_name, best_video_url, best_video_title, content_links, community_url')
      .eq('user_id', session.user.id)
      .single();

    // Get user name as fallback sender
    const { data: user } = await supabase
      .from('users')
      .select('name')
      .eq('id', session.user.id)
      .single();

    const senderName = brandKit?.sender_name || user?.name || 'Your Friend';

    const context: EmailGenerationContext = {
      leadMagnetTitle,
      leadMagnetFormat,
      leadMagnetContents,
      senderName,
      businessDescription: brandKit?.business_description || '',
      bestVideoUrl: brandKit?.best_video_url || undefined,
      bestVideoTitle: brandKit?.best_video_title || undefined,
      contentLinks: brandKit?.content_links as Array<{ title: string; url: string }> | undefined,
      communityUrl: brandKit?.community_url || undefined,
      audienceStyle: 'casual-direct',
    };

    // Generate emails using AI with fallback
    let emails;
    try {
      emails = await generateEmailSequence({ context });
    } catch (aiError) {
      logApiError('email/flows/generate/ai', aiError, { flowId, note: 'Falling back to default' });
      emails = generateDefaultEmailSequence(leadMagnetTitle, senderName);
    }

    // Limit to requested stepCount
    const emailsToUse = emails.slice(0, stepCount);

    // Delete existing steps for this flow, then insert new ones
    const { error: deleteError } = await supabase
      .from('email_flow_steps')
      .delete()
      .eq('flow_id', flowId);

    if (deleteError) {
      logApiError('email/flows/generate/delete-steps', deleteError, { flowId });
      return ApiErrors.databaseError('Failed to clear existing steps');
    }

    // Insert generated steps
    const stepsToInsert = emailsToUse.map((email, index) => ({
      flow_id: flowId,
      step_number: index,
      subject: email.subject,
      body: email.body,
      delay_days: email.day, // day 0, 1, 2, 3, 4 maps to delay
    }));

    const { data: insertedSteps, error: insertError } = await supabase
      .from('email_flow_steps')
      .insert(stepsToInsert)
      .select(STEP_COLUMNS)
      .order('step_number', { ascending: true });

    if (insertError) {
      logApiError('email/flows/generate/insert-steps', insertError, { flowId });
      return ApiErrors.databaseError('Failed to save generated steps');
    }

    return NextResponse.json({
      steps: insertedSteps || [],
      generated: true,
      stepCount: insertedSteps?.length || 0,
    });
  } catch (error) {
    logApiError('email/flows/generate', error);
    return ApiErrors.internalError('Failed to generate flow steps');
  }
}
