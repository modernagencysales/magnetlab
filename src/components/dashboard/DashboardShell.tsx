'use client';

import { SidebarProvider, SidebarInset } from '@magnetlab/magnetui';
import { AppSidebar } from './AppSidebar';
import { DashboardTopBar } from './DashboardTopBar';

interface User {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface TeamContext {
  isTeamMode: boolean;
  teamId: string;
  teamName: string;
  isOwner: boolean;
}

interface DashboardShellProps {
  user: User;
  teamContext?: TeamContext | null;
  isSuperAdmin?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function DashboardShell({
  user,
  teamContext,
  isSuperAdmin,
  defaultOpen = true,
  children,
}: DashboardShellProps) {
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar
        user={user}
        teamContext={teamContext}
        isSuperAdmin={isSuperAdmin}
      />
      <SidebarInset>
        <DashboardTopBar />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
