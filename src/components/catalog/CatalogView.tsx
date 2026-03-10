'use client';

import { useState, useMemo, useEffect } from 'react';
import { Magnet } from 'lucide-react';
import { PageContainer, PageTitle, SearchInput, EmptyState } from '@magnetlab/magnetui';
import { CatalogCard } from './CatalogCard';

interface CatalogItem {
  id: string;
  title: string;
  archetype: string | null;
  pain_point: string | null;
  target_audience: string | null;
  short_description: string | null;
  status: string;
  created_at: string;
  publicUrl: string | null;
  funnelPublished: boolean;
}

interface CatalogViewProps {
  catalog: CatalogItem[];
  owner: { id: string; name: string | null; username: string | null };
  isOwner: boolean;
}

export function CatalogView({ catalog: initialCatalog, owner, isOwner }: CatalogViewProps) {
  const [catalog, setCatalog] = useState(initialCatalog);
  const [search, setSearch] = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  // Set baseUrl after mount to avoid hydration mismatch
  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return catalog;
    const q = search.toLowerCase();
    return catalog.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.pain_point?.toLowerCase().includes(q) ||
        item.target_audience?.toLowerCase().includes(q) ||
        item.short_description?.toLowerCase().includes(q)
    );
  }, [catalog, search]);

  const handleUpdate = (
    id: string,
    fields: { pain_point?: string; target_audience?: string; short_description?: string }
  ) => {
    setCatalog((prev) => prev.map((item) => (item.id === id ? { ...item, ...fields } : item)));
  };

  return (
    <PageContainer maxWidth="xl">
      <PageTitle
        title={isOwner ? 'My Catalog' : `${owner.name || 'Team'} Catalog`}
        description={
          isOwner
            ? 'Your lead magnets with descriptions for your team. Edit catalog info to help setters pick the right magnet.'
            : `Browse ${owner.name || 'the owner'}'s lead magnets to find the right one for each lead.`
        }
      />

      <SearchInput
        value={search}
        onValueChange={setSearch}
        placeholder="Search by title, pain point, or audience..."
        clearable
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Magnet />}
          title={search ? `No lead magnets match "${search}"` : 'No lead magnets yet'}
          description={
            search
              ? 'Try adjusting your search terms.'
              : 'Create your first lead magnet to get started.'
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <CatalogCard
              key={item.id}
              item={item}
              isOwner={isOwner}
              baseUrl={baseUrl}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
