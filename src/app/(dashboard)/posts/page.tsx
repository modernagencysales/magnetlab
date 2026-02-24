import { Suspense } from 'react';
import { PostsContent } from '@/components/posts/PostsContent';

export const metadata = {
  title: 'Posts | MagnetLab',
  description: 'Manage your LinkedIn posts and content pipeline',
};

export default function PostsPage() {
  return (
    <Suspense>
      <PostsContent />
    </Suspense>
  );
}
