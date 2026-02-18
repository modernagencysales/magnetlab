'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FlaskConical,
  Loader2,
  ChevronDown,
  Pause,
  Play,
  Trophy,
  Plus,
  Pencil,
  X,
  Check,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────

interface ABTestPanelProps {
  funnelPageId: string;
}

type TestField = 'headline' | 'subline' | 'vsl_url' | 'pass_message';

interface Experiment {
  id: string;
  funnel_page_id: string;
  name: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  test_field: TestField;
  winner_id: string | null;
  significance: number | null;
  min_sample_size: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface VariantStat {
  funnelPageId: string;
  isVariant: boolean;
  label: string;
  views: number;
  completions: number;
  completionRate: number;
  headline: string;
  subline: string | null;
  vslUrl: string | null;
  passMessage: string;
}

interface Suggestion {
  label: string;
  value: string | null;
  rationale: string;
}

// ─── Constants ───────────────────────────────────────────────

const TEST_FIELD_OPTIONS: { field: TestField; label: string }[] = [
  { field: 'headline', label: 'Headline' },
  { field: 'subline', label: 'Subline' },
  { field: 'vsl_url', label: 'Video' },
  { field: 'pass_message', label: 'Pass Message' },
];

const TEST_FIELD_TO_VARIANT_KEY: Record<TestField, keyof VariantStat> = {
  headline: 'headline',
  subline: 'subline',
  vsl_url: 'vslUrl',
  pass_message: 'passMessage',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Component ───────────────────────────────────────────────

export function ABTestPanel({ funnelPageId }: ABTestPanelProps) {
  // Data state
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [activeExperiment, setActiveExperiment] = useState<Experiment | null>(null);
  const [variants, setVariants] = useState<VariantStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Creation flow state
  const [creating, setCreating] = useState(false);
  const [selectedField, setSelectedField] = useState<TestField | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState<number | null>(null);
  const [customValue, setCustomValue] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<Record<number, string>>({});
  const [launching, setLaunching] = useState(false);

  // Action state
  const [actionLoading, setActionLoading] = useState(false);
  const [declareOpen, setDeclareOpen] = useState(false);

  // History collapsible
  const [historyOpen, setHistoryOpen] = useState(false);

  // Polling ref
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Fetch experiments list ────────────────────────────────

  const fetchExperiments = useCallback(async () => {
    try {
      const res = await fetch(`/api/ab-experiments?funnelPageId=${funnelPageId}`);
      if (!res.ok) throw new Error('Failed to fetch experiments');
      const data = await res.json();
      const exps: Experiment[] = data.experiments || [];
      setExperiments(exps);

      // Pick the latest active (running/paused) or most recent experiment
      const active = exps.find((e) => e.status === 'running' || e.status === 'paused') || null;
      if (active) {
        setActiveExperiment(active);
        await fetchExperimentDetail(active.id);
      } else {
        setActiveExperiment(null);
        setVariants([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load experiments');
    } finally {
      setLoading(false);
    }
  }, [funnelPageId]);

  const fetchExperimentDetail = useCallback(async (expId: string) => {
    try {
      const res = await fetch(`/api/ab-experiments/${expId}`);
      if (!res.ok) throw new Error('Failed to fetch experiment details');
      const data = await res.json();
      setActiveExperiment(data.experiment);
      setVariants(data.variants || []);
    } catch {
      // Silently fail on poll errors
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchExperiments();
  }, [fetchExperiments]);

  // Poll every 30s when running
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (activeExperiment?.status === 'running') {
      pollRef.current = setInterval(() => {
        fetchExperimentDetail(activeExperiment.id);
      }, 30000);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [activeExperiment?.id, activeExperiment?.status, fetchExperimentDetail]);

  // ─── Creation flow handlers ────────────────────────────────

  const handleSelectField = async (field: TestField) => {
    setSelectedField(field);
    setSuggestions([]);
    setSelectedSuggestionIdx(null);
    setCustomValue('');
    setUseCustom(false);
    setEditingIdx(null);
    setEditValues({});
    setLoadingSuggestions(true);

    try {
      const res = await fetch('/api/ab-experiments/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funnelPageId, testField: field }),
      });

      if (!res.ok) throw new Error('Failed to get suggestions');
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get suggestions');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleLaunch = async () => {
    if (!selectedField) return;

    let variantValue: string | null = null;
    let variantLabel = 'Variant B';

    if (useCustom) {
      variantValue = customValue || null;
      variantLabel = 'Variant B';
    } else if (selectedSuggestionIdx !== null && suggestions[selectedSuggestionIdx]) {
      const suggestion = suggestions[selectedSuggestionIdx];
      variantValue = editValues[selectedSuggestionIdx] !== undefined
        ? editValues[selectedSuggestionIdx]
        : suggestion.value;
      variantLabel = suggestion.label;
    } else {
      return;
    }

    setLaunching(true);
    setError(null);

    try {
      const fieldLabel = TEST_FIELD_OPTIONS.find((o) => o.field === selectedField)?.label || selectedField;
      const res = await fetch('/api/ab-experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnelPageId,
          name: `${fieldLabel} Test`,
          testField: selectedField,
          variantValue,
          variantLabel,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create experiment');
      }

      // Reset creation flow and refetch
      setCreating(false);
      setSelectedField(null);
      setSuggestions([]);
      setSelectedSuggestionIdx(null);
      setCustomValue('');
      setUseCustom(false);
      setEditingIdx(null);
      setEditValues({});
      await fetchExperiments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to launch test');
    } finally {
      setLaunching(false);
    }
  };

  // ─── Action handlers ──────────────────────────────────────

  const handlePause = async () => {
    if (!activeExperiment) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/ab-experiments/${activeExperiment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause' }),
      });
      if (!res.ok) throw new Error('Failed to pause');
      await fetchExperiments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause test');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!activeExperiment) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/ab-experiments/${activeExperiment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume' }),
      });
      if (!res.ok) throw new Error('Failed to resume');
      await fetchExperiments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume test');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclareWinner = async (winnerId: string) => {
    if (!activeExperiment) return;
    setActionLoading(true);
    setDeclareOpen(false);
    try {
      const res = await fetch(`/api/ab-experiments/${activeExperiment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'declare_winner', winnerId }),
      });
      if (!res.ok) throw new Error('Failed to declare winner');
      await fetchExperiments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to declare winner');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!activeExperiment) return;
    if (!window.confirm('Delete this experiment? This cannot be undone.')) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/ab-experiments/${activeExperiment.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchExperiments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete test');
    } finally {
      setActionLoading(false);
    }
  };

  // ─── Helpers ───────────────────────────────────────────────

  const completedExperiments = experiments.filter((e) => e.status === 'completed');
  const hasActiveOrPaused = !!activeExperiment && (activeExperiment.status === 'running' || activeExperiment.status === 'paused');
  const isCompleted = !!activeExperiment && activeExperiment.status === 'completed';

  // For showing a completed experiment's detail, load on demand
  const handleViewCompleted = async (exp: Experiment) => {
    setActiveExperiment(exp);
    await fetchExperimentDetail(exp.id);
  };

  const getTestedValue = (variant: VariantStat): string => {
    if (!activeExperiment) return '';
    const key = TEST_FIELD_TO_VARIANT_KEY[activeExperiment.test_field];
    const val = variant[key];
    if (val === null || val === undefined) return '(empty)';
    return String(val);
  };

  const controlVariant = variants.find((v) => !v.isVariant);
  const testVariant = variants.find((v) => v.isVariant);
  const minViews = Math.min(controlVariant?.views ?? 0, testVariant?.views ?? 0);
  const minSampleSize = activeExperiment?.min_sample_size ?? 50;

  // ─── Loading state ─────────────────────────────────────────

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">A/B Testing</h3>
        </div>
        <div className="mt-4 flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // ─── No active test ────────────────────────────────────────

  if (!hasActiveOrPaused && !isCompleted && !creating) {
    return (
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <FlaskConical className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-lg font-semibold">A/B Testing</h3>
            <p className="text-sm text-muted-foreground">
              Test different versions of your thank-you page to maximize survey completions.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        <button
          onClick={() => {
            setCreating(true);
            setError(null);
          }}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          New A/B Test
        </button>

        {/* History of completed tests */}
        {completedExperiments.length > 0 && (
          <div className="border-t pt-4">
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>History ({completedExperiments.length})</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {historyOpen && (
              <div className="mt-3 space-y-2">
                {completedExperiments.map((exp) => (
                  <button
                    key={exp.id}
                    onClick={() => handleViewCompleted(exp)}
                    className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium">{exp.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {exp.completed_at ? formatDate(exp.completed_at) : formatDate(exp.created_at)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─── Creating a test ───────────────────────────────────────

  if (creating) {
    return (
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FlaskConical className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">New A/B Test</h3>
          </div>
          <button
            onClick={() => {
              setCreating(false);
              setSelectedField(null);
              setSuggestions([]);
              setError(null);
            }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Field picker */}
        <div>
          <p className="mb-2 text-sm font-medium">What do you want to test?</p>
          <div className="grid grid-cols-2 gap-2">
            {TEST_FIELD_OPTIONS.map((opt) => (
              <button
                key={opt.field}
                onClick={() => handleSelectField(opt.field)}
                disabled={loadingSuggestions}
                className={`rounded-lg border-2 px-4 py-3 text-sm font-medium transition-all ${
                  selectedField === opt.field
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading suggestions */}
        {loadingSuggestions && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Generating suggestions...</span>
          </div>
        )}

        {/* Suggestions */}
        {!loadingSuggestions && suggestions.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm font-medium">Pick a variant to test</p>

            {suggestions.map((suggestion, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setSelectedSuggestionIdx(idx);
                  setUseCustom(false);
                }}
                className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                  selectedSuggestionIdx === idx && !useCustom
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{suggestion.label}</span>
                  {editingIdx !== idx && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingIdx(idx);
                        setEditValues((prev) => ({
                          ...prev,
                          [idx]: prev[idx] !== undefined ? prev[idx] : (suggestion.value ?? ''),
                        }));
                        setSelectedSuggestionIdx(idx);
                        setUseCustom(false);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </button>
                  )}
                </div>

                {editingIdx === idx ? (
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="text"
                      value={editValues[idx] ?? (suggestion.value ?? '')}
                      onChange={(e) => {
                        e.stopPropagation();
                        setEditValues((prev) => ({ ...prev, [idx]: e.target.value }));
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingIdx(null);
                      }}
                      className="text-green-600 hover:text-green-700 transition-colors"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm">
                    &ldquo;{editValues[idx] !== undefined ? editValues[idx] : (suggestion.value ?? '(empty)')}&rdquo;
                  </p>
                )}

                <p className="text-xs text-muted-foreground mt-1">{suggestion.rationale}</p>
              </div>
            ))}

            {/* Custom option */}
            <div
              onClick={() => {
                setUseCustom(true);
                setSelectedSuggestionIdx(null);
              }}
              className={`cursor-pointer rounded-lg border-2 p-4 transition-all ${
                useCustom
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/50'
              }`}
            >
              <p className="text-sm font-medium mb-2">Custom</p>
              <input
                type="text"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onClick={(e) => {
                  e.stopPropagation();
                  setUseCustom(true);
                  setSelectedSuggestionIdx(null);
                }}
                placeholder="Enter your own variant value..."
                className="w-full rounded-lg border border-border bg-muted/50 dark:bg-muted/20 px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleLaunch}
                disabled={
                  launching ||
                  (!useCustom && selectedSuggestionIdx === null)
                }
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {launching && <Loader2 className="h-4 w-4 animate-spin" />}
                Launch Test
              </button>
              <button
                onClick={() => {
                  setCreating(false);
                  setSelectedField(null);
                  setSuggestions([]);
                  setError(null);
                }}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Test running / paused / completed ─────────────────────

  if (activeExperiment && (hasActiveOrPaused || isCompleted)) {
    const isRunning = activeExperiment.status === 'running';
    const isPaused = activeExperiment.status === 'paused';
    const isDone = activeExperiment.status === 'completed';

    const confidence = activeExperiment.significance != null
      ? Math.round((1 - activeExperiment.significance) * 1000) / 10
      : null;

    return (
      <div className="rounded-xl border bg-card p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FlaskConical className="h-5 w-5 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">{activeExperiment.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                {isRunning && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    Running
                  </span>
                )}
                {isPaused && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600">
                    Paused
                  </span>
                )}
                {isDone && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600">
                    Completed
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Variant cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[controlVariant, testVariant].filter(Boolean).map((variant) => {
            if (!variant) return null;
            const isWinner = isDone && activeExperiment.winner_id === variant.funnelPageId;

            return (
              <div
                key={variant.funnelPageId}
                className={`rounded-xl border p-4 space-y-3 ${
                  isWinner
                    ? 'border-green-500 bg-green-50/50 dark:bg-green-900/10'
                    : 'border-border'
                }`}
              >
                {/* Card header */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{variant.label}</span>
                  {isWinner && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
                      <Trophy className="h-3 w-3" />
                      Winner
                    </span>
                  )}
                </div>

                {/* Tested value */}
                <p className="text-sm text-muted-foreground italic">
                  &ldquo;{getTestedValue(variant)}&rdquo;
                </p>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold">{variant.views}</p>
                    <p className="text-xs text-muted-foreground">Views</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{variant.completions}</p>
                    <p className="text-xs text-muted-foreground">Completions</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{variant.completionRate}%</p>
                    <p className="text-xs text-muted-foreground">Rate</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Confidence (completed) */}
        {isDone && confidence !== null && (
          <p className="text-sm text-muted-foreground text-center">
            {confidence}% confidence
          </p>
        )}

        {/* Progress bar (running/paused) */}
        {!isDone && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{minViews} / {minSampleSize} minimum views</span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${Math.min((minViews / minSampleSize) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {isRunning && (
            <>
              <button
                onClick={handlePause}
                disabled={actionLoading}
                className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
                Pause Test
              </button>

              {/* Declare winner dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDeclareOpen(!declareOpen)}
                  disabled={actionLoading}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
                >
                  <Trophy className="h-4 w-4" />
                  Declare Winner
                  <ChevronDown className={`h-3 w-3 transition-transform ${declareOpen ? 'rotate-180' : ''}`} />
                </button>
                {declareOpen && (
                  <div className="absolute top-full left-0 mt-1 z-10 w-48 rounded-lg border bg-card shadow-lg">
                    {variants.map((v) => (
                      <button
                        key={v.funnelPageId}
                        onClick={() => handleDeclareWinner(v.funnelPageId)}
                        className="block w-full px-4 py-2 text-left text-sm hover:bg-muted transition-colors first:rounded-t-lg last:rounded-b-lg"
                      >
                        {v.label} ({v.completionRate}%)
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {isPaused && (
            <>
              <button
                onClick={handleResume}
                disabled={actionLoading}
                className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Resume Test
              </button>

              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="rounded-lg border border-red-200 dark:border-red-800 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Delete
              </button>
            </>
          )}

          {isDone && (
            <button
              onClick={() => {
                setActiveExperiment(null);
                setVariants([]);
                setCreating(true);
                setError(null);
              }}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Run Another Test
            </button>
          )}
        </div>

        {/* History (completed experiments) */}
        {completedExperiments.length > 0 && !isDone && (
          <div className="border-t pt-4">
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>History ({completedExperiments.length})</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {historyOpen && (
              <div className="mt-3 space-y-2">
                {completedExperiments.map((exp) => (
                  <button
                    key={exp.id}
                    onClick={() => handleViewCompleted(exp)}
                    className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium">{exp.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {exp.completed_at ? formatDate(exp.completed_at) : formatDate(exp.created_at)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History for completed view with multiple completed experiments */}
        {isDone && completedExperiments.length > 1 && (
          <div className="border-t pt-4">
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>History ({completedExperiments.length})</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${historyOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {historyOpen && (
              <div className="mt-3 space-y-2">
                {completedExperiments
                  .filter((exp) => exp.id !== activeExperiment.id)
                  .map((exp) => (
                    <button
                      key={exp.id}
                      onClick={() => handleViewCompleted(exp)}
                      className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
                    >
                      <span className="font-medium">{exp.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {exp.completed_at ? formatDate(exp.completed_at) : formatDate(exp.created_at)}
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Fallback (should not reach here)
  return null;
}
