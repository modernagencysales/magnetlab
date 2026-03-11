/** Accelerator API module. Client-side calls for accelerator enrollment.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { apiClient } from './client';
import type { ProgramState } from '@/lib/types/accelerator';

// ─── Types ───────────────────────────────────────────────

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool_call' | 'tool_result';
  content: string;
  tool_name?: string;
  tool_args?: Record<string, unknown>;
  tool_result?: Record<string, unknown>;
  created_at: string;
}

// ─── Enrollment ───────────────────────────────────────────

export async function startEnrollment(): Promise<{ url: string }> {
  return apiClient.post<{ url: string }>('/accelerator/enroll');
}

// ─── Program State ────────────────────────────────────────

export async function getProgramState(): Promise<{
  enrolled: boolean;
  programState: ProgramState | null;
}> {
  return apiClient.get('/accelerator/program-state');
}

// ─── Conversation History ─────────────────────────────────

export async function getConversation(conversationId: string): Promise<{
  conversation: { id: string; title: string };
  messages: ConversationMessage[];
}> {
  return apiClient.get(`/copilot/conversations/${conversationId}`);
}
