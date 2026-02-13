import { NextRequest, NextResponse } from 'next/server';
import { upsertUserIntegration } from '@/lib/utils/encrypted-storage';
import { tasks } from '@trigger.dev/sdk/v3';
import type { processLinkedInComment } from '@/trigger/process-linkedin-comment';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    console.log('Unipile webhook received:', JSON.stringify(body).substring(0, 500));

    // ==========================================
    // Account connection callback
    // ==========================================
    if (body.status === 'CREATION_SUCCESS' && body.account_id && body.name) {
      await upsertUserIntegration({
        userId: body.name,
        service: 'unipile',
        isActive: true,
        metadata: { unipile_account_id: body.account_id },
      });
      console.log('Unipile integration saved for user:', body.name);
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
        console.log('Unipile comment webhook: missing required fields', { eventType });
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
        console.log('Comment processing triggered for post:', postSocialId);
      } catch (triggerErr) {
        // Don't fail the webhook — log and continue
        console.error('Failed to trigger comment processing:', triggerErr);
      }

      return NextResponse.json({ received: true });
    }

    // ==========================================
    // Other events (new_relation, account_status, etc.)
    // Log for now, handle later as needed
    // ==========================================
    console.log('Unipile webhook: unhandled event type', { eventType: eventType || body.status });
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Unipile webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
