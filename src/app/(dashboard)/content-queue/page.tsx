/**
 * Content Queue Page.
 * Server component — auth check, renders client component.
 */

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { ContentQueuePage } from '@/components/content-queue/ContentQueuePage';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Content Queue | MagnetLab',
  description: 'Edit content across all your teams in one place',
};

export default async function ContentQueueRoute() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  return <ContentQueuePage />;
}
