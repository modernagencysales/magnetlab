'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Loader2 } from 'lucide-react';

export default function QuickCreatePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/landing-page/quick-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create landing page');
      }

      const data = await res.json();
      router.push(`/magnets/${data.leadMagnetId}?tab=funnel`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto flex max-w-lg flex-col items-center px-4 py-16">
      <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
        <Globe className="h-6 w-6 text-primary" />
      </div>

      <h1 className="mb-2 text-2xl font-bold">Create a Landing Page</h1>
      <p className="mb-8 text-center text-muted-foreground">
        Enter a title and we&apos;ll generate your opt-in page copy with AI.
      </p>

      <form onSubmit={handleSubmit} className="w-full space-y-4">
        <div>
          <label htmlFor="title" className="mb-1.5 block text-sm font-medium">
            What&apos;s your landing page about?
          </label>
          <input
            id="title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. SaaS Growth Playbook"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="description" className="mb-1.5 block text-sm font-medium">
            Describe what you&apos;re offering{' '}
            <span className="text-muted-foreground">(optional — helps AI write better copy)</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. A step-by-step guide to scaling B2B SaaS from $0 to $10K MRR using cold outbound and content marketing"
            rows={3}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={loading}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating your page...
            </>
          ) : (
            'Create Landing Page'
          )}
        </button>
      </form>
    </div>
  );
}
