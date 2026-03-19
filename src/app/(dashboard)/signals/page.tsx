'use client';

import { PageContainer, PageTitle } from '@magnetlab/magnetui';
import { SignalLeadsTable } from '@/components/signals/SignalLeadsTable';
import { useCopilotPageContext } from '@/components/copilot/CopilotNavigator';

export default function SignalsPage() {
  useCopilotPageContext({ page: 'signals' });

  return (
    <PageContainer maxWidth="xl">
      <div className="space-y-6">
        <PageTitle
          title="Signal Leads"
          description="LinkedIn intent signals — leads discovered through keyword monitoring, competitor tracking, and engagement analysis"
        />
        <SignalLeadsTable />
      </div>
    </PageContainer>
  );
}
