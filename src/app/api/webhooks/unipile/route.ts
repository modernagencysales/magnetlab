import { NextRequest, NextResponse } from 'next/server';
import { upsertUserIntegration } from '@/lib/utils/encrypted-storage';
import { tasks } from '@trigger.dev/sdk/v3';
import type { processLinkedInComment } from '@/trigger/process-linkedin-comment';
import { logError, logWarn, logInfo, logDebug } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    logDebug('webhooks/unipile', 'Webhook received', { body: JSON.stringify(body).substring(0, 500) });

    // ==========================================
    // Account connection callback
    // ==========================================
    if (body.status === 'CREATION_SUCCESS' && body.account_id && body.name) {
      // Parse userId and optional teamProfileId from body.name
      // Format: "userId" or "userId:teamProfileId"
      const nameParts = body.name.split(':');
      const userId = nameParts[0];
      const teamProfileId = nameParts[1] || null;

      // Store in user_integrations (backward compat)
      await upsertUserIntegration({
        userId,
        service: 'unipile',
        isActive: true,
        metadata: { unipile_account_id: body.account_id },
      });
      logInfo('webhooks/unipile', 'Integration saved for user', { userId });

      // If team_profile_id provided, also store in team_profile_integrations
      if (teamProfileId) {
        const { connectTeamProfileLinkedIn } = await import('@/lib/services/team-integrations');
        await connectTeamProfileLinkedIn(teamProfileId, body.account_id, userId);
        logInfo('webhooks/unipile', 'Team profile integration saved', { teamProfileId, userId });
      }

      return NextResponse.json({ received: true });
    }

    // ==========================================
    // Comment event (from Unipile webhook subscription)
    // Expected payload:
    // {
    //   event: "new_comment" | "comment_created",
    //   post_id: "urn:li:activity:XXX",
    //   comment: { text, author: { name, provider_id } },
    //   created_at: ISO string
    // }
    // ==========================================
    const eventType = body.event || body.type;
    if (eventType === 'new_comment' || eventType === 'comment_created') {
      const postSocialId = body.post_id || body.post_social_id;
      const comment = body.comment || body.data?.comment;

      if (!postSocialId || !comment?.text || !comment?.author?.provider_id) {
        logWarn('webhooks/unipile', 'Comment webhook missing required fields', { eventType });
        return NextResponse.json({ received: true });
      }

      // Fire-and-forget: trigger the comment processor task
      try {
        await tasks.trigger<typeof processLinkedInComment>('process-linkedin-comment', {
          postSocialId,
          commentText: comment.text,
          commenterName: comment.author.name || 'Unknown',
          commenterProviderId: comment.author.provider_id,
          commenterLinkedinUrl: comment.author.linkedin_url || comment.author.public_identifier
            ? `https://www.linkedin.com/in/${comment.author.public_identifier}/`
            : undefined,
          commentedAt: comment.created_at || body.created_at || new Date().toISOString(),
        });
        logInfo('webhooks/unipile', 'Comment processing triggered', { postSocialId });
      } catch (triggerErr) {
        // Don't fail the webhook — log and continue
        logError('webhooks/unipile', triggerErr, { step: 'trigger_comment_processing' });
      }

      return NextResponse.json({ received: true });
    }

    // ==========================================
    // Other events (new_relation, account_status, etc.)
    // Log for now, handle later as needed
    // ==========================================
    logDebug('webhooks/unipile', 'Unhandled event type', { eventType: eventType || body.status });
    return NextResponse.json({ received: true });
  } catch (error) {
    logError('webhooks/unipile', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
