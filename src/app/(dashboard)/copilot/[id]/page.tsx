/** Copilot Conversation Page. Routes to full-page conversation view. Constraint: Thin wrapper — all logic lives in CopilotConversation. */

'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { CopilotConversation } from '@/components/copilot/CopilotConversation';

export default function CopilotConversationPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const conversationId = params.id;
  const initialMessage = searchParams.get('message') || undefined;

  // Parse sourceContext from URL if present (from Cmd+K navigation)
  let sourceContext:
    | { page: string; entityType?: string; entityId?: string; entityTitle?: string }
    | undefined;
  const contextParam = searchParams.get('context');
  if (contextParam) {
    try {
      sourceContext = JSON.parse(contextParam);
    } catch {
      /* ignore malformed context */
    }
  }

  return (
    <CopilotConversation
      conversationId={conversationId}
      initialMessage={initialMessage}
      sourceContext={sourceContext}
    />
  );
}
