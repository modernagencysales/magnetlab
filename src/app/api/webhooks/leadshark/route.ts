// LeadShark Webhook Receiver
// Receives LinkedIn opt-in events from LeadShark automations
// POST /api/webhooks/leadshark

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { verifyLeadSharkWebhook } from '@/lib/webhooks/verify';
import { logApiError } from '@/lib/api/errors';

interface LeadSharkWebhookPayload {
  event_type: 'new_lead' | 'dm_sent' | 'connection_accepted' | 'follow_up_sent';
  automation_id: string;
  automation_name: string;
  post_id: string;
  post_url?: string;
  lead: {
    linkedin_url: string;
    first_name: string;
    last_name: string;
    headline?: string;
    company_name?: string;
    location?: string;
    profile_image_url?: string;
  };
  engagement?: {
    liked_post: boolean;
    commented: boolean;
    comment_text?: string;
    connected: boolean;
    dm_opened?: boolean;
  };
  timestamp: string;
}

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text();

    // Verify webhook signature
    const verification = await verifyLeadSharkWebhook(request, body);
    if (!verification.valid) {
      logApiError('webhooks/leadshark/verify', new Error(verification.error || 'Signature verification failed'));
      return NextResponse.json(
        { error: 'Invalid webhook signature', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const payload: LeadSharkWebhookPayload = JSON.parse(body);
    const supabase = createSupabaseAdminClient();

    // Find the lead magnet associated with this LeadShark post
    const { data: leadMagnet } = await supabase
      .from('lead_magnets')
      .select('id, user_id')
      .eq('leadshark_post_id', payload.post_id)
      .single();

    if (!leadMagnet) {
      // No associated lead magnet found, but still acknowledge the webhook
      logApiError('webhooks/leadshark', new Error('No lead magnet found'), { postId: payload.post_id, note: 'Non-critical' });
      return NextResponse.json({
        success: true,
        message: 'Webhook received but no associated lead magnet found',
      });
    }

    // Update lead_magnet_analytics based on event type
    const today = new Date().toISOString().split('T')[0];

    // Check for existing analytics record for today
    const { data: existingAnalytics } = await supabase
      .from('lead_magnet_analytics')
      .select('*')
      .eq('lead_magnet_id', leadMagnet.id)
      .gte('captured_at', today)
      .lt('captured_at', new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000).toISOString())
      .single();

    if (existingAnalytics) {
      // Update existing analytics
      const updateData: Record<string, number> = {};

      switch (payload.event_type) {
        case 'new_lead':
          updateData.leads_captured = (existingAnalytics.leads_captured || 0) + 1;
          break;
        case 'dm_sent':
          updateData.dms_sent = (existingAnalytics.dms_sent || 0) + 1;
          break;
        case 'connection_accepted':
          updateData.connections_made = (existingAnalytics.connections_made || 0) + 1;
          break;
        case 'follow_up_sent':
          updateData.dms_sent = (existingAnalytics.dms_sent || 0) + 1;
          break;
      }

      await supabase
        .from('lead_magnet_analytics')
        .update(updateData)
        .eq('id', existingAnalytics.id);
    } else {
      // Create new analytics record
      const insertData: Record<string, unknown> = {
        lead_magnet_id: leadMagnet.id,
        leads_captured: payload.event_type === 'new_lead' ? 1 : 0,
        dms_sent: ['dm_sent', 'follow_up_sent'].includes(payload.event_type) ? 1 : 0,
        dms_replied: 0,
        connections_made: payload.event_type === 'connection_accepted' ? 1 : 0,
        captured_at: new Date().toISOString(),
      };

      await supabase.from('lead_magnet_analytics').insert(insertData);
    }

    // Also store the lead info in the lead magnet's enrichment data (optional)
    // This could be expanded to a proper leads table in the future

    return NextResponse.json({
      success: true,
      event_type: payload.event_type,
      lead_magnet_id: leadMagnet.id,
    });
  } catch (error) {
    logApiError('webhooks/leadshark', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
