import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardNav user={session.user} />
      <main>{children}</main>
      <FeedbackWidget
        userEmail={session.user.email ?? null}
        userId={session.user.id ?? null}
      />
    </div>
  );
}
