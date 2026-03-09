'use client';

import React from 'react';
import { CopilotProvider } from './CopilotProvider';
import { CopilotSidebar } from './CopilotSidebar';
import { CopilotToggleButton } from './CopilotToggleButton';

export function CopilotShell({ children }: { children: React.ReactNode }) {
  return (
    <CopilotProvider>
      {children}
      <CopilotSidebar />
      <CopilotToggleButton />
    </CopilotProvider>
  );
}
