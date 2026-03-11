import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { PageContainer } from '@magnetlab/magnetui';
import { PromptEditor } from '@/components/admin/PromptEditor';
import { notFound, redirect } from 'next/navigation';

export default async function PromptEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!(await isSuperAdmin(session.user.id))) redirect('/');

  const supabase = createSupabaseAdminClient();

  const { data: prompt } = await supabase
    .from('ai_prompt_templates')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!prompt) notFound();

  const { data: versions } = await supabase
    .from('ai_prompt_versions')
    .select('*')
    .eq('prompt_id', prompt.id)
    .order('version', { ascending: false });

  return (
    <PageContainer maxWidth="xl">
      <PromptEditor prompt={prompt} versions={versions ?? []} />
    </PageContainer>
  );
}
