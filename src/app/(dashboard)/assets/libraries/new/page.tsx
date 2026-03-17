'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { PageContainer } from '@magnetlab/magnetui';
import { BackLink, FormError, IconPicker, LIBRARY_ICONS } from '@/components/assets';
import * as librariesApi from '@/frontend/api/libraries';

export default function NewLibraryPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('📚');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const data = await librariesApi.createLibrary({
        name: name.trim(),
        description: description.trim() || null,
        icon,
      });
      router.push(`/assets/libraries/${data.library.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create library');
      setIsSubmitting(false);
    }
  }

  return (
    <PageContainer maxWidth="lg">
      <div className="mx-auto max-w-2xl space-y-6">
        <BackLink />
        <h1 className="text-2xl font-bold">Create New Library</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="mb-2 block text-sm font-medium">
              Library Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Marketing Resources"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="description" className="mb-2 block text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of this library..."
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isSubmitting}
            />
          </div>

          <IconPicker
            value={icon}
            onChange={setIcon}
            options={LIBRARY_ICONS}
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
              disabled={isSubmitting || !name.trim()}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin mr-1" />}
              Create Library
            </button>
          </div>
        </form>
      </div>
    </PageContainer>
  );
}
