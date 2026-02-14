import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTagClusters, runTagClustering } from '@/lib/services/knowledge-brain';

import { logError } from '@/lib/utils/logger';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clusters = await getTagClusters(session.user.id);
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

    const result = await runTagClustering(session.user.id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logError('cp/knowledge/clusters', error, { step: 'run_clustering_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
