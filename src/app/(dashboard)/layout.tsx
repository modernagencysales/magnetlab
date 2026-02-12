import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
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

  // Check for team memberships (both legacy team_members and new team_profiles)
  const supabase = createSupabaseAdminClient();
  const { data: memberships, error: membershipError } = await supabase
    .from('team_members')
    .select('id, owner_id')
    .eq('member_id', session.user.id)
    .eq('status', 'active');

  if (membershipError) {
    console.error('[Layout] Failed to fetch team memberships:', membershipError.message);
  }

  // Also check team_profiles memberships
  const { data: profileMemberships } = await supabase
    .from('team_profiles')
    .select('id, team_id, teams!inner(owner_id)')
    .eq('user_id', session.user.id)
    .eq('status', 'active');

  // Merge: add any team_profiles owners not already in memberships
  if (profileMemberships?.length) {
    const existingOwnerIds = new Set(memberships?.map(m => m.owner_id) || []);
    for (const pm of profileMemberships) {
      const ownerIdFromProfile = (pm as unknown as { teams: { owner_id: string } }).teams.owner_id;
      if (ownerIdFromProfile !== session.user.id && !existingOwnerIds.has(ownerIdFromProfile)) {
        memberships?.push({ id: pm.id, owner_id: ownerIdFromProfile });
      }
    }
  }

  const cookieStore = await cookies();
  const activeOwnerId = cookieStore.get('ml-team-context')?.value;

  let teamContext: { isTeamMember: boolean; activeOwnerId: string | null; ownerName: string | null } | null = null;

  if (activeOwnerId && activeOwnerId !== session.user.id) {
    // Verify the membership is still valid
    const isValid = memberships?.some(m => m.owner_id === activeOwnerId);
    if (isValid) {
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
