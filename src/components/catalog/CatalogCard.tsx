'use client';

import { useState } from 'react';
import { Copy, Check, ExternalLink, Pencil, X, Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  Button,
  Input,
  Textarea,
  FormField,
} from '@magnetlab/magnetui';
import { logError } from '@/lib/utils/logger';
import * as leadMagnetApi from '@/frontend/api/lead-magnet';

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
  onUpdate?: (
    id: string,
    fields: { pain_point?: string; target_audience?: string; short_description?: string }
  ) => void;
}

const ARCHETYPE_LABELS: Record<string, string> = {
  'single-breakdown': 'Breakdown',
  'single-system': 'System',
  'focused-toolkit': 'Toolkit',
  'single-calculator': 'Calculator',
  'focused-directory': 'Directory',
  'mini-training': 'Training',
  'one-story': 'Story',
  prompt: 'Prompt',
  assessment: 'Assessment',
  workflow: 'Workflow',
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
      await leadMagnetApi.updateLeadMagnetCatalog(item.id, {
        pain_point: painPoint || undefined,
        target_audience: targetAudience || undefined,
        short_description: shortDescription || undefined,
      });
      onUpdate?.(item.id, {
        pain_point: painPoint || undefined,
        target_audience: targetAudience || undefined,
        short_description: shortDescription || undefined,
      });
      setEditing(false);
    } catch (err) {
      logError('catalog/card', err, { step: 'save_error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border transition-colors hover:border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm truncate">{item.title}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              {item.archetype && (
                <Badge variant="default">
                  {ARCHETYPE_LABELS[item.archetype] || item.archetype}
                </Badge>
              )}
              <Badge variant={item.status === 'published' ? 'green' : 'gray'}>{item.status}</Badge>
            </div>
          </div>
          {isOwner && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditing(!editing)}
              title="Edit catalog info"
            >
              {editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-3 mb-3">
            <FormField label="Pain Point" htmlFor="pain-point">
              <Input
                id="pain-point"
                value={painPoint}
                onChange={(e) => setPainPoint(e.target.value)}
                placeholder="What problem does this solve?"
              />
            </FormField>
            <FormField label="Target Audience" htmlFor="target-audience">
              <Input
                id="target-audience"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="Who is this for?"
              />
            </FormField>
            <FormField label="Short Description" htmlFor="short-desc">
              <Textarea
                id="short-desc"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Brief description for your team"
                rows={2}
                className="resize-none"
              />
            </FormField>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </div>
        ) : (
          <>
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
                  <span className="font-medium text-foreground/70">Audience:</span>{' '}
                  {item.target_audience}
                </p>
              )}
            </div>
          </>
        )}

        {fullUrl && (
          <div className="flex items-center gap-2 pt-3 border-t">
            <a
              href={fullUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors truncate"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              <span className="truncate">{item.publicUrl}</span>
            </a>
            <Button variant="ghost" size="icon-sm" onClick={handleCopy} title="Copy link">
              {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
            </Button>
          </div>
        )}

        {!fullUrl && !editing && (
          <p className="text-xs text-muted-foreground/60 pt-3 border-t">No published funnel page</p>
        )}
      </CardContent>
    </Card>
  );
}
