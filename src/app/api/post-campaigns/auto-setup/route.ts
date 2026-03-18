/** Post Campaign Auto-Setup. AI analyzes post text and returns campaign config.
 *  Never contains business logic — delegates to service layer. */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { autoSetupCampaign } from '@/server/services/post-campaigns.service';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = (await request.json()) as { post_id?: string };
    const { post_id } = body;

    if (!post_id || typeof post_id !== 'string') {
      return ApiErrors.validationError('post_id is required');
    }

    const scope = await getDataScope(session.user.id);
    const result = await autoSetupCampaign(scope, post_id);

    return NextResponse.json(result);
  } catch (error) {
    logApiError('post-campaigns/auto-setup', error);
    const statusCode =
      error && typeof error === 'object' && 'statusCode' in error
        ? (error as { statusCode: number }).statusCode
        : 500;
    if (statusCode === 404) return ApiErrors.notFound('Post');
    return ApiErrors.internalError('Failed to auto-setup campaign');
  }
}
