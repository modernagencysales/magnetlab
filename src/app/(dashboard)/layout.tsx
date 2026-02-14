import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getMergedMemberships } from '@/lib/utils/team-membership';
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

  const memberships = await getMergedMemberships(session.user.id);

  const cookieStore = await cookies();
  const activeOwnerId = cookieStore.get('ml-team-context')?.value;

  let teamContext: { isTeamMember: boolean; activeOwnerId: string | null; ownerName: string | null } | null = null;

  if (activeOwnerId && activeOwnerId !== session.user.id) {
    // Verify the membership is still valid
    const isValid = memberships?.some(m => m.owner_id === activeOwnerId);
    if (isValid) {
      const supabase = createSupabaseAdminClient();
      const { data: owner } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', activeOwnerId)
        .single();

      teamContext = {
        isTeamMember: true,
        activeOwnerId,
        ownerName: owner?.name || owner?.email || null,
      };
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <PostHogIdentify
        userId={session.user.id!}
        email={session.user.email}
        name={session.user.name}
      />
      <DashboardNav
        user={session.user}
        teamContext={teamContext}
      />
      <main className="lg:pl-64">{children}</main>
      <FeedbackWidget
        userEmail={session.user.email ?? null}
        userId={session.user.id ?? null}
      />
    </div>
  );
}
