import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const isAdmin = await isSuperAdmin(session.user.id);
  if (!isAdmin) {
    redirect('/');
  }

  return <>{children}</>;
}
