import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';
import { PostHogIdentify } from '@/components/providers/PostHogIdentify';

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
      <PostHogIdentify
        userId={session.user.id!}
        email={session.user.email}
        name={session.user.name}
      />
      <DashboardNav user={session.user} />
      <main className="lg:pl-64">{children}</main>
      <FeedbackWidget
        userEmail={session.user.email ?? null}
        userId={session.user.id ?? null}
      />
    </div>
  );
}
