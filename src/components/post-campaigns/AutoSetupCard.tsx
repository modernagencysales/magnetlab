'use client';

/**
 * AutoSetupCard. Shows AI-extracted campaign config with editable fields.
 * Displayed after auto-setup API returns. User can review, tweak, and activate.
 * Never imports server-only modules.
 */

import { useState } from 'react';
import { Sparkles, ChevronDown, Loader2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Textarea,
  TagInput,
} from '@magnetlab/magnetui';
import type { AutoSetupResult, FunnelOption } from '@/frontend/api/post-campaigns';

// ─── Types ──────────────────────────────────────────────

type BadgeVariant = 'green' | 'orange' | 'gray';

const CONFIDENCE_VARIANTS: Record<string, BadgeVariant> = {
  high: 'green',
  medium: 'orange',
  low: 'gray',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'High Confidence',
  medium: 'Medium Confidence',
  low: 'Low Confidence',
};

interface AutoSetupCardProps {
  result: AutoSetupResult;
  funnelOptions: FunnelOption[];
  onActivate: (edited: AutoSetupResult) => Promise<void>;
  onExpandForm: () => void;
}

// ─── Main component ─────────────────────────────────────

export function AutoSetupCard({
  result,
  funnelOptions,
  onActivate,
  onExpandForm,
}: AutoSetupCardProps) {
  const [edited, setEdited] = useState<AutoSetupResult>({ ...result });
  const [showDetails, setShowDetails] = useState(false);
  const [activating, setActivating] = useState(false);

  // ── Field helpers ───────────────────────────────────

  const updateField = <K extends keyof AutoSetupResult>(
    field: K,
    value: AutoSetupResult[K]
  ) => {
    setEdited((prev) => ({ ...prev, [field]: value }));
  };

  // ── Activate ────────────────────────────────────────

  const handleActivate = async () => {
    setActivating(true);
    try {
      await onActivate(edited);
    } finally {
      setActivating(false);
    }
  };

  // ── Render ──────────────────────────────────────────

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">AI Auto-Setup</CardTitle>
          </div>
          <Badge variant={CONFIDENCE_VARIANTS[edited.confidence]}>
            {CONFIDENCE_LABELS[edited.confidence]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Keywords</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {edited.keywords.map((kw) => (
                <Badge key={kw} variant="default">
                  {kw}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Funnel</p>
            <p className="mt-1 text-sm">
              {edited.funnel_name || 'None selected'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Delivery Account</p>
            <p className="mt-1 text-sm">
              {edited.sender_account_name || 'Not set'}
            </p>
          </div>
        </div>

        {/* Expandable details */}
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-1 text-sm text-primary hover:text-primary/80"
        >
          {showDetails ? 'Hide Details' : 'Edit Details'}
          <ChevronDown
            className={`h-4 w-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
          />
        </button>

        {showDetails && (
          <div className="space-y-4 rounded-lg border border-border bg-background p-4">
            <div className="space-y-2">
              <Label>Keywords</Label>
              <TagInput
                value={edited.keywords}
                onChange={(tags) => updateField('keywords', tags)}
                placeholder="Add keyword..."
              />
            </div>

            <div className="space-y-2">
              <Label>Funnel Page</Label>
              <select
                value={edited.funnel_page_id || ''}
                onChange={(e) => {
                  const id = e.target.value || null;
                  const funnel = funnelOptions.find((f) => f.id === id);
                  updateField('funnel_page_id', id);
                  updateField('funnel_name', funnel?.name ?? null);
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">No funnel page</option>
                {funnelOptions.map((funnel) => (
                  <option key={funnel.id} value={funnel.id}>
                    {funnel.name || funnel.slug}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>DM Template</Label>
              <Textarea
                value={edited.dm_template}
                onChange={(e) => updateField('dm_template', e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Placeholders: {'{{name}}'}, {'{{funnel_url}}'}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Connection Request Message</Label>
              <Textarea
                value={edited.connect_message_template}
                onChange={(e) => updateField('connect_message_template', e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={onExpandForm}>
                Open Full Form
              </Button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-2">
          <Button onClick={handleActivate} disabled={activating}>
            {activating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Activate Campaign
          </Button>
          <Button variant="outline" onClick={onExpandForm}>
            Customize Further
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
