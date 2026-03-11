/** Sub-Agent Shared Types.
 *  Common interfaces used across specialist agent prompt builders.
 *  Never imports NextRequest, NextResponse, or cookies. */

import type { IntakeData, CoachingMode } from '@/lib/types/accelerator';

export interface SopData {
  title: string;
  content: string;
  quality_bars: unknown[];
}

export interface UserContext {
  intake_data: IntakeData | null;
  coaching_mode: CoachingMode;
  has_brain_content?: boolean;
}
