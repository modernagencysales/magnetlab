/**
 * RestylePanel. AI-powered restyle UI for funnel theme/section changes.
 * Constraint: Never calls DB directly — delegates to funnelApi client methods.
 */
'use client';

import { useState } from 'react';
import { Sparkles, Plus, X, ArrowRight, Loader2, Trash2 } from 'lucide-react';
import { Button, Input } from '@magnetlab/magnetui';
import type { RestylePlan } from '@/lib/types/funnel';
import * as funnelApi from '@/frontend/api/funnel';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface RestylePanelProps {
  funnelId: string;
  onApplied: () => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function RestylePanel({ funnelId, onApplied }: RestylePanelProps) {
  const [prompt, setPrompt] = useState('');
  const [urls, setUrls] = useState<string[]>([]);
  const [plan, setPlan] = useState<RestylePlan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasInput = prompt.trim().length > 0 || urls.some((u) => u.trim().length > 0);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleAddUrl = () => {
    if (urls.length < 3) setUrls([...urls, '']);
  };

  const handleRemoveUrl = (index: number) => {
    setUrls(urls.filter((_, i) => i !== index));
  };

  const handleUrlChange = (index: number, value: string) => {
    const next = [...urls];
    next[index] = value;
    setUrls(next);
  };

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const filteredUrls = urls.map((u) => u.trim()).filter(Boolean);
      const { plan: result } = await funnelApi.generateRestylePlan(funnelId, {
        prompt: prompt.trim() || undefined,
        urls: filteredUrls.length > 0 ? filteredUrls : undefined,
      });
      setPlan(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate restyle plan');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyPlan = async () => {
    if (!plan) return;
    setIsApplying(true);
    setError(null);
    try {
      await funnelApi.applyRestylePlan(funnelId, plan);
      setPlan(null);
      setPrompt('');
      setUrls([]);
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply restyle plan');
    } finally {
      setIsApplying(false);
    }
  };

  const handleRemoveChange = (index: number) => {
    if (!plan) return;
    setPlan({ ...plan, changes: plan.changes.filter((_, i) => i !== index) });
  };

  const handleRemoveSectionChange = (index: number) => {
    if (!plan) return;
    setPlan({ ...plan, sectionChanges: plan.sectionChanges.filter((_, i) => i !== index) });
  };

  const handleRemoveVariantChange = (index: number) => {
    if (!plan || !plan.sectionVariantChanges) return;
    setPlan({
      ...plan,
      sectionVariantChanges: plan.sectionVariantChanges.filter((_, i) => i !== index),
    });
  };

  const handleDiscard = () => {
    setPlan(null);
    setError(null);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Restyle with AI</h3>
      </div>

      {/* Prompt input */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the style you want..."
        rows={3}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors resize-none"
      />

      {/* URL inputs */}
      <div className="space-y-2">
        {urls.map((url, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              type="url"
              value={url}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                handleUrlChange(i, e.target.value)
              }
              placeholder="https://example.com (inspiration URL)"
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => handleRemoveUrl(i)}
              className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {urls.length < 3 && (
          <Button type="button" variant="ghost" size="sm" onClick={handleAddUrl}>
            <Plus className="h-3.5 w-3.5" />
            Add URL
          </Button>
        )}
      </div>

      {/* Generate button */}
      {!plan && (
        <Button
          type="button"
          onClick={handleGeneratePlan}
          disabled={isGenerating || !hasInput}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating plan...
            </>
          ) : (
            'Generate Plan'
          )}
        </Button>
      )}

      {/* Error display */}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      {/* Plan review */}
      {plan && (
        <div className="space-y-3">
          {/* Direction + reasoning */}
          <div className="rounded-md bg-muted/50 p-3 space-y-1">
            <p className="text-sm font-medium">{plan.styleDirection}</p>
            <p className="text-xs text-muted-foreground">{plan.reasoning}</p>
          </div>

          {/* Field changes */}
          {plan.changes.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Theme Changes
              </p>
              {plan.changes.map((change, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border p-2 text-xs">
                  <span className="font-medium min-w-[90px]">{change.field}</span>
                  <span className="text-muted-foreground truncate">{change.from ?? 'none'}</span>
                  <ArrowRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                  <span className="font-mono truncate">{change.to}</span>
                  <span className="ml-auto text-muted-foreground hidden sm:inline truncate max-w-[120px]">
                    {change.reason}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveChange(i)}
                    className="flex-shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Section changes */}
          {plan.sectionChanges.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Section Changes
              </p>
              {plan.sectionChanges.map((sc, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border p-2 text-xs">
                  <span className="font-medium min-w-[50px] capitalize">{sc.action}</span>
                  <span className="font-mono">{sc.sectionType}</span>
                  {sc.pageLocation && (
                    <span className="text-muted-foreground">({sc.pageLocation})</span>
                  )}
                  <span className="ml-auto text-muted-foreground hidden sm:inline truncate max-w-[120px]">
                    {sc.reason}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSectionChange(i)}
                    className="flex-shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Variant changes */}
          {(plan.sectionVariantChanges ?? []).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Variant Changes
              </p>
              {plan.sectionVariantChanges!.map((vc, i) => (
                <div key={i} className="flex items-center gap-2 rounded-md border p-2 text-xs">
                  <span className="font-medium min-w-[70px] font-mono truncate">
                    {vc.sectionId.slice(0, 8)}
                  </span>
                  <span className="text-muted-foreground truncate">{vc.fromVariant}</span>
                  <ArrowRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                  <span className="font-mono truncate">{vc.toVariant}</span>
                  <span className="ml-auto text-muted-foreground hidden sm:inline truncate max-w-[120px]">
                    {vc.reason}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveVariantChange(i)}
                    className="flex-shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Apply / Discard */}
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleApplyPlan}
              disabled={
                isApplying ||
                (plan.changes.length === 0 &&
                  plan.sectionChanges.length === 0 &&
                  (plan.sectionVariantChanges ?? []).length === 0)
              }
              className="flex-1"
            >
              {isApplying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Applying...
                </>
              ) : (
                'Apply Changes'
              )}
            </Button>
            <Button type="button" variant="outline" onClick={handleDiscard}>
              <Trash2 className="h-4 w-4" />
              Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
