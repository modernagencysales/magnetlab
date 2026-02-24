import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { checkTeamRole } from '@/lib/auth/rbac';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { DashboardNav } from '@/components/dashboard/DashboardNav';
import { ErrorBoundary } from '@/components/ErrorBoundary';
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

  const cookieStore = await cookies();
  const activeTeamId = cookieStore.get('ml-team-context')?.value;

  let teamContext: { isTeamMode: boolean; teamId: string; teamName: string; isOwner: boolean } | null = null;

  if (activeTeamId) {
    const supabase = createSupabaseAdminClient();
    const { data: team } = await supabase
      .from('teams')
      .select('id, name, owner_id')
      .eq('id', activeTeamId)
      .single();

    if (team) {
      const role = await checkTeamRole(session.user.id, team.id);
      if (role) {
        teamContext = {
          isTeamMode: true,
          teamId: team.id,
          teamName: team.name,
          isOwner: role === 'owner',
        };
      }
    }
  }

  let isAdmin = false;
  try {
    isAdmin = await isSuperAdmin(session.user.id!);
  } catch {
    // Non-critical — don't crash the layout if admin check fails
  }

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground"
      >
        Skip to main content
      </a>
      <PostHogIdentify
        userId={session.user.id!}
        email={session.user.email}
        name={session.user.name}
      />
      <DashboardNav
        user={session.user}
        teamContext={teamContext}
        isSuperAdmin={isAdmin}
      />
      <main id="main-content" className="lg:pl-64"><ErrorBoundary>{children}</ErrorBoundary></main>
      <FeedbackWidget
        userEmail={session.user.email ?? null}
        userId={session.user.id ?? null}
      />
    </div>
  );
}
