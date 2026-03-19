/**
 * Posts Page (server component).
 * Auth check + scope resolution only — the mixer client component handles
 * all data fetching via SWR hooks. No heavy server-side prefetch needed.
 * Never imports NextRequest, NextResponse, or cookies directly.
 */

import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { PostsContent } from '@/components/posts/PostsContent';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Posts | MagnetLab',
  description: 'Create content by mixing ingredients — exploits, styles, templates, and more',
};

export default async function PostsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  return (
    <Suspense>
      <PostsContent />
    </Suspense>
  );
}
