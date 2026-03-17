import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { PageContainer } from '@magnetlab/magnetui';
import { PromptList } from '@/components/admin/PromptList';
import { redirect } from 'next/navigation';

export default async function AdminPromptsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!(await isSuperAdmin(session.user.id))) redirect('/');

  const supabase = createSupabaseAdminClient();

  const { data: prompts } = await supabase
    .from('ai_prompt_templates')
    .select('slug, name, category, description, model, is_active, updated_at')
    .order('category')
    .order('name');

  return (
    <PageContainer maxWidth="xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">AI Prompts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View, edit, and version all AI prompt templates used in content production.
          </p>
        </div>
        <PromptList prompts={prompts ?? []} />
      </div>
    </PageContainer>
  );
}
