'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, Loader2, Link as LinkIcon, FileText } from 'lucide-react';

export default function ImportLeadMagnetPage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    if (!url.trim() && !content.trim()) {
      setError('Please provide either a URL or paste your content');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/lead-magnet/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim() || undefined,
          content: content.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to import');
      }

      const { leadMagnetId } = await response.json();

      // Redirect to the funnel editor
      router.push(`/magnets/${leadMagnetId}?tab=funnel`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import lead magnet');
      setLoading(false);
    }
  };

  const hasInput = url.trim() || content.trim();

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/pages"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Pages
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Import Your Lead Magnet</h1>
        <p className="mt-2 text-muted-foreground">
          Already have a lead magnet? Paste it here and we&apos;ll set up your capture page.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* URL Input */}
        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium">
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
            URL (optional)
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
            disabled={loading}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Link to your PDF, Google Doc, Gumroad, etc.
          </p>
        </div>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Content Input */}
        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Paste your content
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Paste your lead magnet content, sales page copy, or a description of what you're offering..."
            rows={8}
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors resize-none"
            disabled={loading}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            We&apos;ll extract the title, headline, and key details to set up your page.
          </p>
        </div>

        {/* Import Button */}
        <button
          onClick={handleImport}
          disabled={!hasInput || loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing & creating page...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Import & Create Page
            </>
          )}
        </button>

        {/* Info box */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <h3 className="text-sm font-medium mb-2">What happens next?</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• We&apos;ll analyze your content and extract key details</li>
            <li>• A capture page will be created with your headline and offer</li>
            <li>• You can customize everything in the page editor</li>
            <li>• Leads will be sent to your webhook (set up in Settings)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
