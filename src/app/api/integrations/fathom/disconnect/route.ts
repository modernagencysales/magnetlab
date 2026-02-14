import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deleteUserIntegration } from '@/lib/utils/encrypted-storage';

import { logError } from '@/lib/utils/logger';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await deleteUserIntegration(session.user.id, 'fathom');
    return NextResponse.json({ success: true });
  } catch (error) {
    logError('api/integrations/fathom', error, { step: 'fathom_disconnect_error' });
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
