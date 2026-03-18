'use client';

/**
 * CampaignForm. Create/edit form for post campaigns.
 * Fields: name, post URL, keywords, sender account, DM template, reply template,
 * funnel page, target locations, behavior toggles.
 * Never imports server-only modules.
 */

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Button,
  Input,
  Textarea,
  Label,
  Switch,
  TagInput,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@magnetlab/magnetui';
import { logError } from '@/lib/utils/logger';
import * as campaignsApi from '@/frontend/api/post-campaigns';
import type { CreatePostCampaignInput } from '@/lib/types/post-campaigns';
import type { SenderAccount, FunnelOption } from '@/frontend/api/post-campaigns';

// ─── Types ──────────────────────────────────────────────

export interface CampaignFormValues {
  name: string;
  post_url: string;
  keywords: string[];
  unipile_account_id: string;
  dm_template: string;
  connect_message_template: string;
  funnel_page_id: string;
  target_locations: string[];
  auto_accept_connections: boolean;
  auto_like_comments: boolean;
  auto_connect_non_requesters: boolean;
}

interface CampaignFormProps {
  initialValues?: Partial<CampaignFormValues>;
  onSubmit: (values: CreatePostCampaignInput) => Promise<void>;
  submitLabel?: string;
}

const DEFAULT_VALUES: CampaignFormValues = {
  name: '',
  post_url: '',
  keywords: [],
  unipile_account_id: '',
  dm_template: '',
  connect_message_template: '',
  funnel_page_id: '',
  target_locations: [],
  auto_accept_connections: true,
  auto_like_comments: false,
  auto_connect_non_requesters: false,
};

// ─── Main component ─────────────────────────────────────

export function CampaignForm({
  initialValues,
  onSubmit,
  submitLabel = 'Create Campaign',
}: CampaignFormProps) {
  const [values, setValues] = useState<CampaignFormValues>({
    ...DEFAULT_VALUES,
    ...initialValues,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reference data
  const [senderAccounts, setSenderAccounts] = useState<SenderAccount[]>([]);
  const [funnelOptions, setFunnelOptions] = useState<FunnelOption[]>([]);
  const [loadingRef, setLoadingRef] = useState(true);

  // ── Load reference data ─────────────────────────────

  useEffect(() => {
    async function loadReferenceData() {
      setLoadingRef(true);
      try {
        const [accountsRes, funnelsRes] = await Promise.all([
          campaignsApi.listSenderAccounts(),
          campaignsApi.listFunnelOptions(),
        ]);
        setSenderAccounts(accountsRes.accounts);
        setFunnelOptions(funnelsRes.funnels);
      } catch (err) {
        logError('post-campaigns/form/ref-data', err);
      } finally {
        setLoadingRef(false);
      }
    }
    loadReferenceData();
  }, []);

  // ── Field helpers ───────────────────────────────────

  const updateField = <K extends keyof CampaignFormValues>(
    field: K,
    value: CampaignFormValues[K]
  ) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  // ── Submit ──────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!values.name.trim()) {
      setError('Name is required');
      return;
    }
    if (!values.post_url.trim()) {
      setError('Post URL is required');
      return;
    }
    if (!values.unipile_account_id) {
      setError('Sender account is required');
      return;
    }
    if (!values.dm_template.trim()) {
      setError('DM template is required');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: values.name.trim(),
        post_url: values.post_url.trim(),
        keywords: values.keywords,
        unipile_account_id: values.unipile_account_id,
        dm_template: values.dm_template,
        connect_message_template: values.connect_message_template || undefined,
        funnel_page_id: values.funnel_page_id || undefined,
        auto_accept_connections: values.auto_accept_connections,
        auto_like_comments: values.auto_like_comments,
        auto_connect_non_requesters: values.auto_connect_non_requesters,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save campaign');
      logError('post-campaigns/form/submit', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Basic info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={values.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g. LinkedIn Growth Playbook Post"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="post_url">Post URL</Label>
            <Input
              id="post_url"
              value={values.post_url}
              onChange={(e) => updateField('post_url', e.target.value)}
              placeholder="https://www.linkedin.com/feed/update/..."
            />
          </div>

          <div className="space-y-2">
            <Label>Keywords</Label>
            <TagInput
              value={values.keywords}
              onChange={(tags) => updateField('keywords', tags)}
              placeholder="Type a keyword and press Enter..."
            />
            <p className="text-xs text-muted-foreground">
              Comments matching these keywords will trigger engagement
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Messaging */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Messaging</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sender">Sender Account</Label>
            {loadingRef ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading accounts...
              </div>
            ) : (
              <select
                id="sender"
                value={values.unipile_account_id}
                onChange={(e) => updateField('unipile_account_id', e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a sender account...</option>
                {senderAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="dm_template">DM Template</Label>
            <Textarea
              id="dm_template"
              value={values.dm_template}
              onChange={(e) => updateField('dm_template', e.target.value)}
              placeholder="Hey {{name}}, thanks for engaging with my post..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Available placeholders: {'{{name}}'}, {'{{funnel_url}}'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="connect_message_template">
              Connection Request Message{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="connect_message_template"
              value={values.connect_message_template}
              onChange={(e) => updateField('connect_message_template', e.target.value)}
              placeholder="Hi {{name}}, I noticed you commented on my post..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Sent when connecting with people who aren&apos;t already connected
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Targeting */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Targeting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="funnel">Funnel Page</Label>
            {loadingRef ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading funnels...
              </div>
            ) : (
              <select
                id="funnel"
                value={values.funnel_page_id}
                onChange={(e) => updateField('funnel_page_id', e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">No funnel page</option>
                {funnelOptions.map((funnel) => (
                  <option key={funnel.id} value={funnel.id}>
                    {funnel.name || funnel.slug}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-2">
            <Label>Target Locations</Label>
            <TagInput
              value={values.target_locations}
              onChange={(tags) => updateField('target_locations', tags)}
              placeholder="Type a location and press Enter..."
            />
            <p className="text-xs text-muted-foreground">Leave empty to target all locations</p>
          </div>
        </CardContent>
      </Card>

      {/* Behavior */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Behavior</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-accept connections</Label>
              <p className="text-xs text-muted-foreground">
                Automatically accept connection requests from detected leads
              </p>
            </div>
            <Switch
              checked={values.auto_accept_connections}
              onCheckedChange={(checked) => updateField('auto_accept_connections', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-like comments</Label>
              <p className="text-xs text-muted-foreground">
                Automatically like comments from detected leads
              </p>
            </div>
            <Switch
              checked={values.auto_like_comments}
              onCheckedChange={(checked) => updateField('auto_like_comments', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-connect non-requesters</Label>
              <p className="text-xs text-muted-foreground">
                Send connection requests to leads who haven&apos;t connected yet
              </p>
            </div>
            <Switch
              checked={values.auto_connect_non_requesters}
              onCheckedChange={(checked) => updateField('auto_connect_non_requesters', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
