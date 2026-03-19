/**
 * Pipeline Page.
 * Server component — fetches posts, ideas, and autopilot buffer status,
 * then passes them to PipelineContent for the Pipeline/Calendar/Autopilot/Content Queue tabs.
 * Never imports NextRequest, NextResponse, or cookies directly.
 */

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { getBufferStatus } from '@/lib/services/autopilot';
import * as postsService from '@/server/services/posts.service';
import * as ideasService from '@/server/services/ideas.service';
import { PipelineContent } from '@/components/pipeline/PipelineContent';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Pipeline | MagnetLab',
  description: 'Manage your content pipeline, calendar, autopilot, and content queue',
};

export default async function PipelinePage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const scope = await getDataScope(session.user.id);
  const [buffer, initialPosts, initialIdeas] = await Promise.all([
    getBufferStatus(session.user.id, scope),
    postsService.getPosts(scope, { limit: 200 }),
    ideasService.getIdeas(scope, { status: 'extracted', limit: 200 }),
  ]);
  const initialBufferLow = (buffer?.length ?? 0) < 3;

  return (
    <Suspense>
      <PipelineContent
        initialBufferLow={initialBufferLow}
        initialIdeas={initialIdeas}
        initialPosts={initialPosts}
      />
    </Suspense>
  );
}
