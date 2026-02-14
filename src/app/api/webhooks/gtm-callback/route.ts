import { NextRequest, NextResponse } from 'next/server';
import { verifyGtmCallbackWebhook } from '@/lib/webhooks/verify';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

interface GtmCallbackPayload {
  event: 'lead_magnet.scheduled' | 'lead_magnet.schedule_failed';
  timestamp: string;
  data: {
    leadMagnetId: string;
    scheduledTime?: string;
    reason?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const verification = await verifyGtmCallbackWebhook(request);
    if (!verification.valid) {
      console.warn('[gtm-callback] Verification failed:', verification.error);
      return NextResponse.json(
        { error: 'Invalid webhook secret' },
        { status: 401 }
      );
    }

    const payload: GtmCallbackPayload = await request.json();

    if (!payload.event || !payload.data) {
      return NextResponse.json(
        { error: 'Missing required fields: event, data' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    switch (payload.event) {
      case 'lead_magnet.scheduled': {
        const { leadMagnetId, scheduledTime } = payload.data;

        if (!leadMagnetId) {
          return NextResponse.json(
            { error: 'Missing leadMagnetId' },
            { status: 400 }
          );
        }

        // Update lead_magnets table with scheduling info
        const { error } = await supabase
          .from('lead_magnets')
          .update({
            scheduled_time: scheduledTime,
            status: 'scheduled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', leadMagnetId);

        if (error) {
          console.error('[gtm-callback] Failed to update lead magnet:', error);
          return NextResponse.json(
            { error: 'Failed to update lead magnet' },
            { status: 500 }
          );
        }

        console.log(
          `[gtm-callback] Lead magnet ${leadMagnetId} marked as scheduled`
        );
        break;
      }

      case 'lead_magnet.schedule_failed': {
        const { leadMagnetId: failedId, reason } = payload.data;

        if (!failedId) {
          return NextResponse.json(
            { error: 'Missing leadMagnetId' },
            { status: 400 }
          );
        }

        // Revert lead magnet status back to published (scheduling failed)
        const { error: failError } = await supabase
          .from('lead_magnets')
          .update({
            status: 'published',
            updated_at: new Date().toISOString(),
          })
          .eq('id', failedId);

        if (failError) {
          console.error('[gtm-callback] Failed to update lead magnet on schedule failure:', failError);
          return NextResponse.json(
            { error: 'Failed to update lead magnet' },
            { status: 500 }
          );
        }

        console.log(
          `[gtm-callback] Lead magnet ${failedId} scheduling failed: ${reason || 'unknown'}`
        );
        break;
      }

      default:
        console.warn('[gtm-callback] Unknown event type:', payload.event);
        return NextResponse.json(
          { error: `Unknown event type: ${payload.event}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[gtm-callback] Processing failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
