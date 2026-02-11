'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink, Pencil, X } from 'lucide-react';

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

interface CatalogCardProps {
  item: CatalogItem;
  isOwner: boolean;
  baseUrl: string;
  onUpdate?: (id: string, fields: { pain_point?: string; target_audience?: string; short_description?: string }) => void;
}

const ARCHETYPE_LABELS: Record<string, string> = {
  'single-breakdown': 'Breakdown',
  'single-system': 'System',
  'focused-toolkit': 'Toolkit',
  'single-calculator': 'Calculator',
  'focused-directory': 'Directory',
  'mini-training': 'Training',
  'one-story': 'Story',
  'prompt': 'Prompt',
  'assessment': 'Assessment',
  'workflow': 'Workflow',
};

export function CatalogCard({ item, isOwner, baseUrl, onUpdate }: CatalogCardProps) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [painPoint, setPainPoint] = useState(item.pain_point || '');
  const [targetAudience, setTargetAudience] = useState(item.target_audience || '');
  const [shortDescription, setShortDescription] = useState(item.short_description || '');
  const [saving, setSaving] = useState(false);

  const fullUrl = item.publicUrl ? `${baseUrl}${item.publicUrl}` : null;

  const handleCopy = async () => {
    if (!fullUrl) return;
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/lead-magnet/${item.id}/catalog`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pain_point: painPoint,
          target_audience: targetAudience,
          short_description: shortDescription,
        }),
      });

      if (res.ok) {
        onUpdate?.(item.id, {
          pain_point: painPoint || undefined,
          target_audience: targetAudience || undefined,
          short_description: shortDescription || undefined,
        });
        setEditing(false);
      }
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-5 transition-colors hover:border-primary/30">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{item.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            {item.archetype && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {ARCHETYPE_LABELS[item.archetype] || item.archetype}
              </span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              item.status === 'published'
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
            }`}>
              {item.status}
            </span>
          </div>
        </div>
        {isOwner && (
          <button
            onClick={() => setEditing(!editing)}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0"
            title="Edit catalog info"
          >
            {editing ? <X size={14} /> : <Pencil size={14} />}
          </button>
        )}
      </div>

      {/* Edit mode */}
      {editing ? (
        <div className="space-y-3 mb-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Pain Point</label>
            <input
              value={painPoint}
              onChange={(e) => setPainPoint(e.target.value)}
              placeholder="What problem does this solve?"
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Target Audience</label>
            <input
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="Who is this for?"
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Short Description</label>
            <textarea
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="Brief description for your team"
              rows={2}
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      ) : (
        <>
          {/* Catalog fields */}
          {item.short_description && (
            <p className="text-sm text-muted-foreground mb-2">{item.short_description}</p>
          )}
          <div className="space-y-1 mb-3">
            {item.pain_point && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground/70">Pain:</span> {item.pain_point}
              </p>
            )}
            {item.target_audience && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground/70">Audience:</span> {item.target_audience}
              </p>
            )}
          </div>
        </>
      )}

      {/* Public link */}
      {fullUrl && (
        <div className="flex items-center gap-2 pt-3 border-t">
          <a
            href={fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors truncate"
          >
            <ExternalLink size={12} />
            <span className="truncate">{item.publicUrl}</span>
          </a>
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors shrink-0"
            title="Copy link"
          >
            {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
          </button>
        </div>
      )}

      {!fullUrl && !editing && (
        <p className="text-xs text-muted-foreground/60 pt-3 border-t">No published funnel page</p>
      )}
    </div>
  );
}
