import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { InspoPage } from '@/components/inspo/InspoPage';

export const metadata = {
  title: 'Inspiration | MagnetLab',
  description: 'Review external content, pick exploits, generate posts',
};

export default async function InspoRoute() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return <InspoPage />;
}
