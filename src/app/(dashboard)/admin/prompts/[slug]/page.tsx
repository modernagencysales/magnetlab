import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import {
  AI_PROMPT_TEMPLATE_COLUMNS,
  AI_PROMPT_VERSION_COLUMNS,
} from '@/server/repositories/admin.repo';
import { PageContainer } from '@magnetlab/magnetui';
import { PromptEditor } from '@/components/admin/PromptEditor';
import { notFound, redirect } from 'next/navigation';

export default async function PromptEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!(await isSuperAdmin(session.user.id))) redirect('/');

  const supabase = createSupabaseAdminClient();

  const { data: prompt } = await supabase
    .from('ai_prompt_templates')
    .select(AI_PROMPT_TEMPLATE_COLUMNS)
    .eq('slug', slug)
    .single();

  if (!prompt) notFound();

  const { data: versions } = await supabase
    .from('ai_prompt_versions')
    .select(AI_PROMPT_VERSION_COLUMNS)
    .eq('prompt_id', prompt.id)
    .order('version', { ascending: false });

  return (
    <PageContainer maxWidth="xl">
      <PromptEditor prompt={prompt} versions={versions ?? []} />
    </PageContainer>
  );
}
