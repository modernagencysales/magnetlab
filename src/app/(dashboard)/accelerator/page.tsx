/** Accelerator page. Server component that checks enrollment.
 *  If enrolled: render AcceleratorPage client component.
 *  If not enrolled: show enrollment entry point. */

import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AcceleratorRoute() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  // Dynamic import to avoid SSR issues with client components
  const { default: AcceleratorPage } = await import('@/components/accelerator/AcceleratorPage');

  return <AcceleratorPage userId={session.user.id} />;
}
