'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { PageContainer } from '@magnetlab/magnetui';
import { BackLink, FormError, IconPicker, RESOURCE_ICONS } from '@/components/assets';
import * as externalResourcesApi from '@/frontend/api/external-resources';

function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}

function NewExternalResourceForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createPage = searchParams.get('createPage') === 'true';
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [icon, setIcon] = useState('🔗');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();

    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!url.trim()) {
      setError('URL is required');
      return;
    }
    if (!isValidUrl(url)) {
      setError('Please enter a valid URL');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const data = await externalResourcesApi.createExternalResource({
        title: title.trim(),
        url: url.trim(),
        icon,
      });
      if (createPage && data.resource?.id) {
        router.push(`/assets/external/${data.resource.id}/funnel`);
      } else {
        router.push('/pages');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create external resource');
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackLink />

      <div>
        <h1 className="text-2xl font-bold">
          {createPage ? 'Create Landing Page for External Resource' : 'Add External Resource'}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {createPage
            ? "First, tell us about your external resource. Then we'll set up your opt-in page."
            : 'Link to external content like YouTube videos, podcasts, tools, or any web resource.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="title" className="mb-2 block text-sm font-medium">
            Title *
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., LinkedIn Optimization Guide (Video)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="url" className="mb-2 block text-sm font-medium">
            URL *
          </label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isSubmitting}
          />
        </div>

        <IconPicker
          value={icon}
          onChange={setIcon}
          options={RESOURCE_ICONS}
          disabled={isSubmitting}
        />

        <FormError message={error} />

        <div className="flex gap-3">
          <Link
            href="/pages"
            className="rounded-lg border border-border px-4 py-2 transition-colors hover:bg-muted"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || !title.trim() || !url.trim()}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin mr-1" />}
            {createPage ? 'Continue to Page Builder' : 'Add Resource'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewExternalResourcePage() {
  return (
    <PageContainer maxWidth="lg">
      <Suspense>
        <NewExternalResourceForm />
      </Suspense>
    </PageContainer>
  );
}
