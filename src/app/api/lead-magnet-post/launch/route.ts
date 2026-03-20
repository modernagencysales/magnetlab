/** Lead Magnet Post Launch. Publishes to LinkedIn and auto-creates an active post campaign.
 *  Never contains business logic — delegates to launcher service. */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import {
  launchLeadMagnetPost,
  publishLinkedInPost,
  getStatusCode,
} from '@/server/services/lead-magnet-post-launcher.service';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const scope = await getDataScope(session.user.id);
    if (scope.type !== 'team' || !scope.teamId) {
      return ApiErrors.validationError('Team context required. Select a team first.');
    }

    const body = await request.json();
    const {
      team_profile_id,
      post_text,
      funnel_page_id,
      keywords,
      dm_template,
      campaign_name,
      publish_only,
    } = body;

    if (!team_profile_id || typeof team_profile_id !== 'string') {
      return ApiErrors.validationError('team_profile_id is required');
    }
    if (!post_text || typeof post_text !== 'string') {
      return ApiErrors.validationError('post_text is required');
    }

    // Publish-only mode: just post to LinkedIn, no campaign
    if (publish_only) {
      const result = await publishLinkedInPost(team_profile_id, post_text);
      return NextResponse.json(result);
    }

    const result = await launchLeadMagnetPost({
      userId: session.user.id,
      teamId: scope.teamId,
      teamProfileId: team_profile_id,
      postText: post_text,
      funnelPageId: funnel_page_id,
      keywords,
      dmTemplate: dm_template,
      campaignName: campaign_name,
    });

    return NextResponse.json(result);
  } catch (error) {
    logApiError('lead-magnet-post/launch', error);
    const statusCode = getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Failed to launch lead magnet post';
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
