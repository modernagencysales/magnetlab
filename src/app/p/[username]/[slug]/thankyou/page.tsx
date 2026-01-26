import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ThankyouPage } from '@/components/funnel/public';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ username: string; slug: string }>;
  searchParams: Promise<{ leadId?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username, slug } = await params;
  const supabase = createSupabaseAdminClient();

  // Find user by username
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single();

  if (!user) {
    return { title: 'Page Not Found' };
  }

  // Find funnel page
  const { data: funnel } = await supabase
    .from('funnel_pages')
    .select('thankyou_headline')
    .eq('user_id', user.id)
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!funnel) {
    return { title: 'Page Not Found' };
  }

  return {
    title: funnel.thankyou_headline,
    robots: { index: false, follow: false },
  };
}

export default async function PublicThankyouPage({ params, searchParams }: PageProps) {
  const { username, slug } = await params;
  const { leadId } = await searchParams;
  const supabase = createSupabaseAdminClient();

  // Find user by username
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single();

  if (userError || !user) {
    notFound();
  }

  // Find published funnel page
  const { data: funnel, error: funnelError } = await supabase
    .from('funnel_pages')
    .select(`
      id,
      thankyou_headline,
      thankyou_subline,
      vsl_url,
      calendly_url,
      qualification_pass_message,
      qualification_fail_message,
      is_published
    `)
    .eq('user_id', user.id)
    .eq('slug', slug)
    .single();

  if (funnelError || !funnel || !funnel.is_published) {
    notFound();
  }

  // Get qualification questions
  const { data: questions } = await supabase
    .from('qualification_questions')
    .select('id, question_text, question_order')
    .eq('funnel_page_id', funnel.id)
    .order('question_order', { ascending: true });

  return (
    <ThankyouPage
      leadId={leadId || null}
      headline={funnel.thankyou_headline}
      subline={funnel.thankyou_subline}
      vslUrl={funnel.vsl_url}
      calendlyUrl={funnel.calendly_url}
      passMessage={funnel.qualification_pass_message}
      failMessage={funnel.qualification_fail_message}
      questions={(questions || []).map((q) => ({
        id: q.id,
        questionText: q.question_text,
        questionOrder: q.question_order,
      }))}
    />
  );
}
