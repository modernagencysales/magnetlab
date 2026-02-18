'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Globe, TrendingUp } from 'lucide-react';

interface GlobalTemplate {
  id: string;
  user_id: string;
  name: string;
  category: string | null;
  description: string | null;
  structure: string;
  example_posts: string[] | null;
  use_cases: string[] | null;
  tags: string[] | null;
  usage_count: number;
  avg_engagement_score: number | null;
  is_active: boolean;
  is_global: boolean;
  source: string | null;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  'all',
  'story',
  'framework',
  'listicle',
  'contrarian',
  'case_study',
  'question',
  'educational',
  'motivational',
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  all: 'All',
  story: 'Story',
  framework: 'Framework',
  listicle: 'Listicle',
  contrarian: 'Contrarian',
  case_study: 'Case Study',
  question: 'Question',
  educational: 'Educational',
  motivational: 'Motivational',
};

export function GlobalTemplateLibrary() {
  const [templates, setTemplates] = useState<GlobalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchGlobalTemplates = useCallback(async () => {
    try {
      const response = await fetch('/api/content-pipeline/templates?scope=global');
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch {
      // Silent failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGlobalTemplates();
  }, [fetchGlobalTemplates]);

  const filtered =
    activeCategory === 'all'
      ? templates
      : templates.filter((t) => t.category === activeCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      {/* Category filter pills */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => {
          const count =
            cat === 'all'
              ? templates.length
              : templates.filter((t) => t.category === cat).length;
          if (cat !== 'all' && count === 0) return null;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {CATEGORY_LABELS[cat] || cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Templates grid */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Globe className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            No global templates available yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((template) => (
            <div
              key={template.id}
              className="rounded-lg border bg-card p-4 transition-colors hover:border-primary/30"
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <h4 className="text-sm font-semibold truncate">{template.name}</h4>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {template.category && (
                      <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-xs">
                        {CATEGORY_LABELS[template.category] || template.category}
                      </span>
                    )}
                    {template.source && (
                      <span className="text-xs text-muted-foreground">
                        {template.source}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {template.description && (
                <p className="mb-2 text-xs text-muted-foreground">{template.description}</p>
              )}

              {/* Structure preview / expand */}
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === template.id ? null : template.id)}
                className="w-full text-left"
              >
                <pre
                  className={`rounded bg-muted p-2 text-xs text-muted-foreground whitespace-pre-wrap ${
                    expandedId === template.id ? 'max-h-64 overflow-auto' : 'max-h-24 overflow-hidden'
                  }`}
                >
                  {template.structure}
                </pre>
                <span className="mt-1 block text-xs text-primary/70 hover:text-primary">
                  {expandedId === template.id ? 'Show less' : 'Show more'}
                </span>
              </button>

              {/* Tags */}
              {template.tags && template.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {template.tags.map((tag) => (
                    <span key={tag} className="rounded bg-secondary px-1.5 py-0.5 text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Stats */}
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  Used {template.usage_count} times
                </span>
                {template.avg_engagement_score != null && template.avg_engagement_score > 0 && (
                  <span>
                    Avg engagement: {template.avg_engagement_score.toFixed(1)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
