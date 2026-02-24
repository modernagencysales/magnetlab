import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { LearningDashboard } from '@/components/admin/LearningDashboard';
import { redirect } from 'next/navigation';

export default async function AdminLearningPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!(await isSuperAdmin(session.user.id))) redirect('/');

  const supabase = createSupabaseAdminClient();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Edit activity (last 30 days)
  const { data: editActivity } = await supabase
    .from('cp_edit_history')
    .select('id, profile_id, content_type, auto_classified_changes, ceo_note, created_at')
    .gte('created_at', thirtyDaysAgo)
    .order('created_at', { ascending: false });

  // All active team profiles with voice evolution metadata
  const { data: profiles } = await supabase
    .from('team_profiles')
    .select('id, full_name, voice_profile')
    .eq('status', 'active');

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-1">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Learning Observatory</h1>
        </div>
        <p className="text-sm text-zinc-500">How the AI self-learning system is performing — edit tracking, pattern detection, and voice evolution.</p>
      </div>
      <LearningDashboard
        editActivity={editActivity ?? []}
        profiles={profiles ?? []}
      />
    </div>
  );
}
