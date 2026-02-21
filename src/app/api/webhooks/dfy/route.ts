import { NextRequest, NextResponse } from 'next/server';
import { verifyGtmCallbackWebhook } from '@/lib/webhooks/verify';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { tasks } from '@trigger.dev/sdk/v3';
import { logError, logWarn, logInfo } from '@/lib/utils/logger';
import type { runAutopilot } from '@/trigger/run-autopilot';
import type { createLeadMagnetPipeline } from '@/trigger/create-lead-magnet';

interface DfyWebhookPayload {
  action: 'create_lead_magnet' | 'trigger_autopilot';
  userId: string;
  businessContext?: {
    industry?: string;
    company?: string;
    businessDescription?: string;
    credibilityMarkers?: string[];
    urgentPains?: string[];
    processes?: string[];
    tools?: string[];
    results?: string[];
    frequentQuestions?: string[];
  };
  engagementId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const verification = await verifyGtmCallbackWebhook(request);
    if (!verification.valid) {
      logWarn('webhooks/dfy', 'Verification failed', { error: verification.error });
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 });
    }

    const payload: DfyWebhookPayload = await request.json();

    if (!payload.action || !payload.userId) {
      return NextResponse.json(
        { error: 'Missing required fields: action, userId' },
        { status: 400 },
      );
    }

    switch (payload.action) {
      case 'create_lead_magnet': {
        const supabase = createSupabaseAdminClient();
        const ctx = payload.businessContext || {};

        // Create a lead magnet record for the pipeline
        const { data: magnet, error: magnetError } = await supabase
          .from('lead_magnets')
          .insert({
            user_id: payload.userId,
            title: `DFY Lead Magnet — ${ctx.company || 'Client'}`,
            archetype: 'framework',
            status: 'draft',
            metadata: {
              source: 'dfy_automation',
              engagement_id: payload.engagementId,
            },
          })
          .select('id')
          .single();

        if (magnetError || !magnet) {
          logError('webhooks/dfy', magnetError || new Error('No magnet returned'), {
            step: 'create_lead_magnet_record',
          });
          return NextResponse.json({ error: 'Failed to create lead magnet' }, { status: 500 });
        }

        // Trigger the pipeline with available context
        const handle = await tasks.trigger<typeof createLeadMagnetPipeline>(
          'create-lead-magnet-pipeline',
          {
            userId: payload.userId,
            userName: null,
            username: null,
            archetype: 'framework',
            businessContext: {
              businessDescription: ctx.businessDescription || `${ctx.company || 'Business'} in ${ctx.industry || 'their industry'}`,
              credibilityMarkers: ctx.credibilityMarkers || [],
              urgentPains: ctx.urgentPains || [],
              processes: ctx.processes || [],
              tools: ctx.tools || [],
              results: ctx.results || [],
              frequentQuestions: ctx.frequentQuestions || [],
            },
            autoPublishFunnel: true,
            autoSchedulePost: false,
            leadMagnetId: magnet.id,
          },
        );

        logInfo('webhooks/dfy', 'Lead magnet pipeline triggered', {
          leadMagnetId: magnet.id,
          runId: handle.id,
          engagementId: payload.engagementId,
        });

        return NextResponse.json({
          success: true,
          leadMagnetId: magnet.id,
          runId: handle.id,
        });
      }

      case 'trigger_autopilot': {
        const handle = await tasks.trigger<typeof runAutopilot>('run-autopilot', {
          userId: payload.userId,
          postsPerBatch: 3,
          bufferTarget: 5,
          autoPublish: false,
        });

        logInfo('webhooks/dfy', 'Autopilot triggered', {
          runId: handle.id,
          userId: payload.userId,
        });

        return NextResponse.json({
          success: true,
          runId: handle.id,
        });
      }

      default:
        logWarn('webhooks/dfy', 'Unknown action', { action: payload.action });
        return NextResponse.json(
          { error: `Unknown action: ${payload.action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    logError('webhooks/dfy', error, { step: 'processing' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
