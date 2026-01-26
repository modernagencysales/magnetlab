import { notFound } from 'next/navigation';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { OptinPage } from '@/components/funnel/public';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ username: string; slug: string }>;
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
    .select('optin_headline, optin_subline, lead_magnet_id')
    .eq('user_id', user.id)
    .eq('slug', slug)
    .eq('is_published', true)
    .single();

  if (!funnel) {
    return { title: 'Page Not Found' };
  }

  return {
    title: funnel.optin_headline,
    description: funnel.optin_subline || undefined,
    openGraph: {
      title: funnel.optin_headline,
      description: funnel.optin_subline || undefined,
      type: 'website',
    },
  };
}

export default async function PublicOptinPage({ params }: PageProps) {
  const { username, slug } = await params;
  const supabase = createSupabaseAdminClient();

  // Find user by username
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, username')
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
      slug,
      optin_headline,
      optin_subline,
      optin_button_text,
      optin_social_proof,
      is_published
    `)
    .eq('user_id', user.id)
    .eq('slug', slug)
    .single();

  if (funnelError || !funnel || !funnel.is_published) {
    notFound();
  }

  return (
    <OptinPage
      funnelId={funnel.id}
      headline={funnel.optin_headline}
      subline={funnel.optin_subline}
      buttonText={funnel.optin_button_text}
      socialProof={funnel.optin_social_proof}
      username={user.username}
      slug={funnel.slug}
    />
  );
}
