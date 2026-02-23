'use client';

import { useState, useMemo, useEffect } from 'react';
import { Search, Magnet } from 'lucide-react';
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

  const handleUpdate = (id: string, fields: { pain_point?: string; target_audience?: string; short_description?: string }) => {
    setCatalog((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, ...fields } : item
      )
    );
  };

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Magnet className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-semibold">
            {isOwner ? 'My Catalog' : `${owner.name || 'Team'} Catalog`}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {isOwner
            ? 'Your lead magnets with descriptions for your team. Edit catalog info to help setters pick the right magnet.'
            : `Browse ${owner.name || 'the owner'}'s lead magnets to find the right one for each lead.`}
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, pain point, or audience..."
          className="w-full rounded-lg border bg-background pl-10 pr-4 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
        />
        {search && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {filtered.length} of {catalog.length}
          </span>
        )}
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Magnet className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">
            {search ? `No lead magnets match "${search}"` : 'No lead magnets yet'}
          </p>
        </div>
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
    </div>
  );
}
