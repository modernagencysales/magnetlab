'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Input } from '@magnetlab/magnetui';

interface PromptSummary {
  slug: string;
  name: string;
  category: string;
  description: string | null;
  model: string;
  is_active: boolean;
  updated_at: string;
}

const CATEGORY_ORDER = ['content_writing', 'email', 'knowledge', 'learning', 'scoring'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  content_writing: 'Content Writing',
  email: 'Email',
  knowledge: 'Knowledge',
  learning: 'Learning',
  scoring: 'Scoring & Config',
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function PromptList({ prompts }: { prompts: PromptSummary[] }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return prompts;
    const q = search.toLowerCase();
    return prompts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
    );
  }, [prompts, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, PromptSummary[]> = {};
    for (const cat of CATEGORY_ORDER) {
      const items = filtered.filter((p) => p.category === cat);
      if (items.length > 0) {
        groups[cat] = items;
      }
    }
    // Catch any prompts with unknown categories
    const knownCats = new Set<string>(CATEGORY_ORDER);
    const uncategorized = filtered.filter((p) => !knownCats.has(p.category));
    if (uncategorized.length > 0) {
      groups['other'] = uncategorized;
    }
    return groups;
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search prompts by name, slug, or description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Groups */}
      {Object.keys(grouped).length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          No prompts found matching &quot;{search}&quot;
        </div>
      )}

      <div className="space-y-6">
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {CATEGORY_LABELS[category] ?? category}
          </h2>
          <div className="grid gap-4">
            {items.map((prompt) => (
              <Link
                key={prompt.slug}
                href={`/admin/prompts/${prompt.slug}`}
                className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {prompt.name}
                      </span>
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          prompt.is_active
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {prompt.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    {prompt.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{prompt.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                    <span className="font-mono">{prompt.model}</span>
                    <span>{formatDate(prompt.updated_at)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}
