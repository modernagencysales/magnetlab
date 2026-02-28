// POST /api/linkedin/automations/[id]/reply
// Sends a reply to a specific comment via Unipile and logs the event.

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getUnipileClient, getUserPostingAccountId } from '@/lib/integrations/unipile';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid automation ID');
    }

    const body = await request.json();
    const { commentSocialId, text, commenterName } = body as {
      commentSocialId: string;
      text: string;
      commenterName?: string;
    };

    if (!commentSocialId || !text?.trim()) {
      return ApiErrors.validationError('commentSocialId and text are required');
    }

    const supabase = createSupabaseAdminClient();

    // Verify automation belongs to user
    const { data: automation, error: autoError } = await supabase
      .from('linkedin_automations')
      .select('id, user_id, post_social_id, unipile_account_id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (autoError || !automation) {
      return ApiErrors.notFound('Automation');
    }

    // Get Unipile account
    const accountId = automation.unipile_account_id
      || await getUserPostingAccountId(automation.user_id);

    if (!accountId) {
      return ApiErrors.validationError('No LinkedIn account connected');
    }

    // Send reply via Unipile
    const client = getUnipileClient();
    const postSocialId = automation.post_social_id || commentSocialId;

    const result = await client.addComment(postSocialId, accountId, text.trim());

    if (result.error) {
      throw new Error(result.error);
    }

    // Log the event
    await supabase.from('linkedin_automation_events').insert({
      automation_id: id,
      event_type: 'reply_sent',
      commenter_name: commenterName || null,
      commenter_provider_id: null,
      commenter_linkedin_url: null,
      comment_text: null,
      action_details: `Manual reply: ${text.trim().substring(0, 200)}`,
      error: null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('linkedin/automations/reply', error);
    return ApiErrors.internalError('Failed to send reply');
  }
}
