import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as knowledgeService from '@/server/services/knowledge.service';

async function getTeamId(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get('ml-team-context')?.value || undefined;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teamId = await getTeamId();
    const clusters = await knowledgeService.getClusters(session.user.id, teamId);
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

    const teamId = await getTeamId();
    const result = await knowledgeService.triggerClustering(session.user.id, teamId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logError('cp/knowledge/clusters', error, { step: 'run_clustering_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
