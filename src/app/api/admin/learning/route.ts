import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();

  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Edit activity (last 30 days)
  const { data: editActivity } = await supabase
    .from('cp_edit_history')
    .select(
      'id, profile_id, content_type, auto_classified_changes, ceo_note, created_at'
    )
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false });

  // All active team profiles with voice evolution metadata
  const { data: profiles } = await supabase
    .from('team_profiles')
    .select('id, full_name, voice_profile')
    .eq('status', 'active');

  return NextResponse.json({
    editActivity: editActivity ?? [],
    profiles: profiles ?? [],
  });
}
