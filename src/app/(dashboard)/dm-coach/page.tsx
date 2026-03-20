/** DM Coach Page. Server component entry point for the DM coaching feature. */

import { DmCoachLayout } from '@/components/dm-coach/DmCoachLayout';

export const metadata = { title: 'DM Coach | MagnetLab' };

export default function DmCoachPage() {
  return <DmCoachLayout />;
}
