/** Copilot shared types. Used by CopilotConversation, MessageList, CopilotMessage. Constraint: Pure types, no runtime code. */

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool_call' | 'tool_result';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: Record<string, unknown>;
  feedback?: { rating: 'positive' | 'negative'; note?: string };
  displayHint?: string;
  createdAt: string;
}

export interface CopilotConversation {
  id: string;
  title: string;
  entityType?: string;
  entityId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PendingConfirmation {
  toolName: string;
  toolArgs: Record<string, unknown>;
  toolUseId: string;
}
