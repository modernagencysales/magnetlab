import Link from 'next/link';
import { Plus, ExternalLink, Calendar, Eye } from 'lucide-react';
import { auth } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/utils/supabase-server';
import { ARCHETYPE_NAMES } from '@/lib/types/lead-magnet';
import { formatDate } from '@/lib/utils';

export const metadata = {
  title: 'Library | MagnetLab',
  description: 'Your lead magnet library',
};

export default async function LibraryPage() {
  const session = await auth();
  const supabase = await createSupabaseServerClient();

  const { data: leadMagnets } = await supabase
    .from('lead_magnets')
    .select('*')
    .eq('user_id', session?.user?.id)
    .order('created_at', { ascending: false });

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Your Library</h1>
          <p className="mt-1 text-muted-foreground">
            {leadMagnets?.length || 0} lead magnets created
          </p>
        </div>
        <Link
          href="/create"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          Create New
        </Link>
      </div>

      {leadMagnets && leadMagnets.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {leadMagnets.map((lm) => (
            <Link
              key={lm.id}
              href={`/library/${lm.id}`}
              className="group rounded-xl border bg-card p-5 transition-all hover:border-primary hover:shadow-lg"
            >
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                {ARCHETYPE_NAMES[lm.archetype as keyof typeof ARCHETYPE_NAMES]}
              </div>

              <h3 className="mb-2 font-semibold group-hover:text-primary">
                {lm.title}
              </h3>

              <div className="mb-4 flex items-center gap-3 text-sm text-muted-foreground">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    lm.status === 'published'
                      ? 'bg-green-500/10 text-green-600'
                      : lm.status === 'scheduled'
                      ? 'bg-blue-500/10 text-blue-600'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {lm.status}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(lm.created_at)}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {lm.thumbnail_url && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Eye className="h-3 w-3" />
                    Thumbnail
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Plus className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mb-2 text-xl font-semibold">No lead magnets yet</h3>
          <p className="mb-6 text-muted-foreground">
            Create your first lead magnet to start capturing leads.
          </p>
          <Link
            href="/create"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Create Your First Lead Magnet
          </Link>
        </div>
      )}
    </div>
  );
}
