'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
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
    <div className="max-w-2xl mx-auto py-8 px-4">
      <BackLink />

      <h1 className="text-2xl font-bold mb-6">
        {createPage ? 'Create Landing Page for External Resource' : 'Add External Resource'}
      </h1>
      <p className="text-muted-foreground mb-6">
        {createPage
          ? 'First, tell us about your external resource. Then we\'ll set up your opt-in page.'
          : 'Link to external content like YouTube videos, podcasts, tools, or any web resource.'}
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-2">
            Title *
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., LinkedIn Optimization Guide (Video)"
            className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isSubmitting}
          />
        </div>

        <div>
          <label htmlFor="url" className="block text-sm font-medium mb-2">
            URL *
          </label>
          <input
            id="url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
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
            className="px-4 py-2 border rounded-lg hover:bg-muted transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || !title.trim() || !url.trim()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            {createPage ? 'Continue to Page Builder' : 'Add Resource'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewExternalResourcePage() {
  return (
    <Suspense>
      <NewExternalResourceForm />
    </Suspense>
  );
}
