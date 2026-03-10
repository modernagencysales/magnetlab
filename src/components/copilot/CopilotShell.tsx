'use client';

import React from 'react';
import { CopilotProvider, useCopilot } from './CopilotProvider';
import { CopilotSidebar } from './CopilotSidebar';
import { CopilotToggleButton } from './CopilotToggleButton';
import { ContentReviewPanel } from './ContentReviewPanel';

function CopilotPanels() {
  const {
    contentReviewData,
    isContentReviewOpen,
    approveContent,
    closeContentReview,
    sendMessage,
  } = useCopilot();

  return (
    <>
      <CopilotSidebar />
      <CopilotToggleButton />
      {contentReviewData && (
        <ContentReviewPanel
          content={contentReviewData}
          isOpen={isContentReviewOpen}
          onApprove={approveContent}
          onClose={closeContentReview}
          onRequestChanges={(feedback) => {
            closeContentReview();
            sendMessage(`Please update the content: ${feedback}`);
          }}
        />
      )}
    </>
  );
}

export function CopilotShell({ children }: { children: React.ReactNode }) {
  return (
    <CopilotProvider>
      {children}
      <CopilotPanels />
    </CopilotProvider>
  );
}
