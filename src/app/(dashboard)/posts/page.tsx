import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { getBufferStatus } from '@/lib/services/autopilot';
import * as postsService from '@/server/services/posts.service';
import * as ideasService from '@/server/services/ideas.service';
import { PostsContent } from '@/components/posts/PostsContent';

export const metadata = {
  title: 'Posts | MagnetLab',
  description: 'Manage your LinkedIn posts and content pipeline',
};

export default async function PostsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const scope = await getDataScope(session.user.id);
  const [buffer, initialPosts, initialIdeas] = await Promise.all([
    getBufferStatus(session.user.id),
    postsService.getPosts(scope, { limit: 200 }),
    ideasService.getIdeas(scope, { status: 'extracted', limit: 200 }),
  ]);
  const initialBufferLow = (buffer?.length ?? 0) < 3;

  return (
    <Suspense>
      <PostsContent
        initialBufferLow={initialBufferLow}
        initialIdeas={initialIdeas}
        initialPosts={initialPosts}
      />
    </Suspense>
  );
}
