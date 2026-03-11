/** Accelerator API module. Client-side calls for accelerator enrollment.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { apiClient } from './client';

// ─── Enrollment ───────────────────────────────────────────

export async function startEnrollment(): Promise<{ url: string }> {
  return apiClient.post<{ url: string }>('/accelerator/enroll');
}
