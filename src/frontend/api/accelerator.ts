/** Accelerator API module. Client-side calls for accelerator enrollment.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { apiClient } from './client';
import type { ProgramState } from '@/lib/types/accelerator';

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
