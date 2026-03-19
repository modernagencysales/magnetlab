import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { hasTeamAccess } from '@/server/repositories/team.repo';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { DashboardShell } from '@/components/dashboard/DashboardShell';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { FeedbackWidget } from '@/components/feedback/FeedbackWidget';
import { PostHogIdentify } from '@/components/providers/PostHogIdentify';
import { CopilotShell } from '@/components/copilot/CopilotShell';
import { CopilotNavigatorProvider } from '@/components/copilot/CopilotNavigator';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const cookieStore = await cookies();
  const activeTeamId = cookieStore.get('ml-team-context')?.value;

  let teamContext: {
    isTeamMode: boolean;
    teamId: string;
    teamName: string;
    isOwner: boolean;
    via: 'direct' | 'team_link';
    agencyTeamName?: string;
  } | null = null;

  if (activeTeamId && activeTeamId !== 'personal') {
    const supabase = createSupabaseAdminClient();
    const { data: team } = await supabase
      .from('teams')
      .select('id, name, owner_id')
      .eq('id', activeTeamId)
      .single();

    if (team) {
      const access = await hasTeamAccess(session.user.id, team.id);
      if (access.access) {
        let agencyTeamName: string | undefined;

        if (access.via === 'team_link') {
          // Look up the agency team name so the sidebar can display "via [Agency]"
          const { data: link } = await supabase
            .from('team_links')
            .select('agency_team_id, teams!team_links_agency_team_id_fkey(name)')
            .eq('client_team_id', activeTeamId)
            .limit(1)
            .maybeSingle();
          const agencyTeams = link?.teams as { name: string } | null;
          agencyTeamName = agencyTeams?.name ?? undefined;
        }

        teamContext = {
          isTeamMode: true,
          teamId: team.id,
          teamName: team.name,
          isOwner: access.role === 'owner',
          via: access.via,
          agencyTeamName,
        };
      }
    }
  }

  // Auto-redirect team members who haven't chosen a context yet
  if (!activeTeamId) {
    const supabase = createSupabaseAdminClient();

    // Check V2 team_profiles first
    const { data: profiles } = await supabase
      .from('team_profiles')
      .select('team_id')
      .eq('user_id', session.user.id!)
      .eq('status', 'active');

    // Also check if user owns a team
    const { data: ownedTeams } = await supabase
      .from('teams')
      .select('id')
      .eq('owner_id', session.user.id!);

    const teamIds = new Set([
      ...(profiles || []).map((p) => p.team_id),
      ...(ownedTeams || []).map((t) => t.id),
    ]);

    if (teamIds.size > 0) {
      redirect('/team-select');
    }
  }

  let isAdmin = false;
  try {
    isAdmin = await isSuperAdmin(session.user.id!);
  } catch {
    // Non-critical — don't crash the layout if admin check fails
  }

  const sidebarOpen = cookieStore.get('sidebar_state')?.value !== 'false';

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
      <DashboardShell
        user={session.user}
        teamContext={teamContext}
        isSuperAdmin={isAdmin}
        defaultOpen={sidebarOpen}
      >
        <CopilotShell>
          <CopilotNavigatorProvider>
            <div id="main-content">
              <ErrorBoundary>{children}</ErrorBoundary>
            </div>
          </CopilotNavigatorProvider>
        </CopilotShell>
      </DashboardShell>
      <FeedbackWidget userEmail={session.user.email ?? null} userId={session.user.id ?? null} />
    </div>
  );
}
