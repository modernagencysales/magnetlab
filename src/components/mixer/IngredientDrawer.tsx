'use client';

/**
 * IngredientDrawer. Sheet-based picker for a single ingredient type.
 * Fetches real data for: knowledge (topics), exploit, style, template, creative, trends.
 * Shows placeholder for: recycled.
 * Never imports from Next.js HTTP layer.
 */

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@magnetlab/magnetui';
import { Search, X } from 'lucide-react';
import { getExploits } from '@/frontend/api/content-pipeline/exploits';
import { getStyles } from '@/frontend/api/content-pipeline/styles';
import { listTemplates } from '@/frontend/api/content-pipeline/templates';
import { getCreatives } from '@/frontend/api/content-pipeline/creatives';
import { getTopics } from '@/frontend/api/content-pipeline/knowledge';
import { getTrends } from '@/frontend/api/content-pipeline/trends';
import { INGREDIENT_META } from './ingredientMeta';
import type { IngredientType } from '@/lib/types/mixer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DrawerItem {
  id: string;
  name: string;
  description?: string;
}

interface IngredientDrawerProps {
  type: IngredientType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamProfileId: string;
  onSelect: (item: { id: string; name: string }) => void;
}

// ─── Placeholder types ─────────────────────────────────────────────────────

const PLACEHOLDER_TYPES: IngredientType[] = ['recycled'];

const PLACEHOLDER_MESSAGES: Record<string, string> = {
  recycled: 'Content recycling — coming soon. Past posts will appear here for remix.',
};

// ─── Data fetchers ────────────────────────────────────────────────────────────

async function fetchItems(type: IngredientType, _teamProfileId?: string): Promise<DrawerItem[]> {
  switch (type) {
    case 'knowledge': {
      const res = await getTopics({ limit: 50 });
      const topics = (res.topics ?? []) as Array<{
        id: string;
        slug: string;
        display_name: string;
        entry_count?: number;
      }>;
      return topics.map((t) => ({
        id: t.slug || t.id,
        name: t.display_name,
        description: t.entry_count ? `${t.entry_count} entries` : undefined,
      }));
    }
    case 'exploits': {
      const items = await getExploits({ with_stats: true });
      return items.map((e) => ({
        id: e.id,
        name: e.name,
        description: e.description ?? undefined,
      }));
    }
    case 'styles': {
      const res = await getStyles();
      const styles = (res.styles ?? []) as Array<{
        id: string;
        name: string;
        description?: string;
      }>;
      return styles.map((s) => ({ id: s.id, name: s.name, description: s.description }));
    }
    case 'templates': {
      // Fetch both user's own templates and global ones
      const [mine, global] = await Promise.all([listTemplates('mine'), listTemplates('global')]);
      const all = [
        ...(mine as Array<{ id: string; name: string; description?: string }>),
        ...(global as Array<{ id: string; name: string; description?: string }>),
      ];
      // Deduplicate by id
      const seen = new Set<string>();
      return all
        .filter((t) => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        })
        .map((t) => ({
          id: t.id,
          name: t.name,
          description: t.description,
        }));
    }
    case 'creatives': {
      const items = await getCreatives({ status: 'approved', limit: 50 });
      return items.map((c) => ({
        id: c.id,
        name: c.content_text.slice(0, 60) + (c.content_text.length > 60 ? '…' : ''),
        description: `${c.source_platform} · score ${c.commentary_worthy_score}`,
      }));
    }
    case 'trends': {
      const topics = await getTrends(20);
      return topics.map((t) => ({
        id: t.topic,
        name: t.topic,
        description: `${t.count} mentions · ${t.trend}`,
      }));
    }
    default:
      return [];
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function IngredientDrawer({
  type,
  open,
  onOpenChange,
  teamProfileId,
  onSelect,
}: IngredientDrawerProps) {
  const [items, setItems] = useState<DrawerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const meta = INGREDIENT_META[type];
  const IconComponent = meta.lucideIcon;
  const isPlaceholder = PLACEHOLDER_TYPES.includes(type);

  // ─── Fetch on open ──────────────────────────────────────
  useEffect(() => {
    if (!open || isPlaceholder) return;
    setLoading(true);
    setSearch('');
    fetchItems(type, teamProfileId)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [open, type, isPlaceholder, teamProfileId]);

  const filtered = search.trim()
    ? items.filter(
        (i) =>
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          i.description?.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[400px] sm:max-w-[400px] overflow-y-auto flex flex-col"
      >
        {/* ─── Header ─────────────────────────────────────── */}
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {IconComponent && <IconComponent className="h-5 w-5 text-muted-foreground" />}
            <span>Pick a {meta.label}</span>
            {!isPlaceholder && items.length > 0 && (
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {items.length} available
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {/* ─── Content ─────────────────────────────────────── */}
        <div className="flex-1 mt-4 flex flex-col gap-3">
          {isPlaceholder ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center p-6">
                {IconComponent && (
                  <IconComponent className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                )}
                <p className="text-sm text-muted-foreground">{PLACEHOLDER_MESSAGES[type]}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  className="w-full pl-9 pr-9 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder={`Search ${meta.label.toLowerCase()}s...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    onClick={() => setSearch('')}
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>

              {/* Item list */}
              <div className="flex-1 overflow-y-auto space-y-2">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />
                  ))
                ) : filtered.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    {search
                      ? 'No matches found.'
                      : `No ${meta.label.toLowerCase()}s available yet.`}
                  </div>
                ) : (
                  filtered.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                      onClick={() => {
                        onSelect({ id: item.id, name: item.name });
                        onOpenChange(false);
                      }}
                    >
                      <div className="text-sm font-medium text-foreground">{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {item.description}
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
