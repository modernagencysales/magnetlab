import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getTagClusters, runTagClustering } from '@/lib/services/knowledge-brain';

import { logError } from '@/lib/utils/logger';

async function resolveEffectiveUserId(sessionUserId: string): Promise<string> {
  const cookieStore = await cookies();
  const teamId = cookieStore.get('ml-team-context')?.value;
  if (!teamId) return sessionUserId;

  const supabase = createSupabaseAdminClient();
  const { data: ownerProfile } = await supabase
    .from('team_profiles')
    .select('user_id')
    .eq('team_id', teamId)
    .eq('role', 'owner')
    .limit(1)
    .single();

  return ownerProfile?.user_id || sessionUserId;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const effectiveUserId = await resolveEffectiveUserId(session.user.id);
    const clusters = await getTagClusters(effectiveUserId);
    return NextResponse.json({ clusters });
  } catch (error) {
    logError('cp/knowledge/clusters', error, { step: 'get_clusters_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const effectiveUserId = await resolveEffectiveUserId(session.user.id);
    const result = await runTagClustering(effectiveUserId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logError('cp/knowledge/clusters', error, { step: 'run_clustering_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
