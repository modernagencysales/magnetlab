import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ARCHETYPE_NAMES } from '@/lib/types/lead-magnet';
import { formatDate } from '@/lib/utils';
import { ArrowLeft, Globe, ExternalLink, Calendar, Sparkles } from 'lucide-react';

export const metadata = {
  title: 'Lead Magnet | MagnetLab',
  description: 'View your lead magnet details',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function LeadMagnetDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  // Parallelize all queries for better performance
  const [leadMagnetResult, funnelResult, userResult] = await Promise.all([
    supabase
      .from('lead_magnets')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single(),
    supabase
      .from('funnel_pages')
      .select('id, slug, is_published')
      .eq('lead_magnet_id', id)
      .single(),
    supabase
      .from('users')
      .select('username')
      .eq('id', session.user.id)
      .single(),
  ]);

  const { data: leadMagnet, error } = leadMagnetResult;
  const { data: funnel } = funnelResult;
  const { data: userData } = userResult;

  if (error || !leadMagnet) {
    notFound();
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/library"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Library
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 text-sm font-medium text-muted-foreground">
          {ARCHETYPE_NAMES[leadMagnet.archetype as keyof typeof ARCHETYPE_NAMES]}
        </div>
        <h1 className="text-3xl font-bold">{leadMagnet.title}</h1>
        <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Created {formatDate(leadMagnet.created_at)}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              leadMagnet.status === 'published'
                ? 'bg-green-500/10 text-green-600'
                : leadMagnet.status === 'scheduled'
                ? 'bg-blue-500/10 text-blue-600'
                : 'bg-secondary text-secondary-foreground'
            }`}
          >
            {leadMagnet.status}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="grid gap-4 md:grid-cols-2 mb-8">
        {/* Funnel Page Card */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10">
              <Globe className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <h3 className="font-semibold">Funnel Page</h3>
              <p className="text-sm text-muted-foreground">
                {funnel ? 'Edit your opt-in page' : 'Create an opt-in page'}
              </p>
            </div>
          </div>

          {funnel ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    funnel.is_published
                      ? 'bg-green-500/10 text-green-600'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {funnel.is_published ? 'Published' : 'Draft'}
                </span>
                <span className="text-sm text-muted-foreground">/{funnel.slug}</span>
              </div>
              <div className="flex gap-2">
                <Link
                  href={`/library/${id}/funnel`}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Edit Funnel
                </Link>
                {funnel.is_published && userData?.username && (
                  <a
                    href={`/p/${userData.username}/${funnel.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium hover:bg-secondary"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View
                  </a>
                )}
              </div>
            </div>
          ) : (
            <Link
              href={`/library/${id}/funnel`}
              className="block w-full rounded-lg bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Create Funnel Page
            </Link>
          )}
        </div>

      </div>

      {/* Concept Details */}
      {leadMagnet.concept && (
        <div className="rounded-xl border bg-card p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Lead Magnet Concept
          </h3>
          <div className="space-y-4 text-sm">
            {leadMagnet.concept.painSolved && (
              <div>
                <span className="font-medium text-muted-foreground">Pain Solved:</span>
                <p className="mt-1">{leadMagnet.concept.painSolved}</p>
              </div>
            )}
            {leadMagnet.concept.hook && (
              <div>
                <span className="font-medium text-muted-foreground">Hook:</span>
                <p className="mt-1">{leadMagnet.concept.hook}</p>
              </div>
            )}
            {leadMagnet.concept.deliveryFormat && (
              <div>
                <span className="font-medium text-muted-foreground">Format:</span>
                <p className="mt-1">{leadMagnet.concept.deliveryFormat}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
