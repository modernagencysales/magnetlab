'use client';

import { SidebarTrigger, TopBar, Separator } from '@magnetlab/magnetui';
import { DashboardBreadcrumbs } from './DashboardBreadcrumbs';

export function DashboardTopBar() {
  return (
    <TopBar
      leading={
        <>
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <DashboardBreadcrumbs />
        </>
      }
    />
  );
}
