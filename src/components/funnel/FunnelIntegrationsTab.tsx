'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Trash2, CheckCircle, XCircle, ChevronDown, Mail, Settings } from 'lucide-react';

import { logError } from '@/lib/utils/logger';

const PROVIDER_LABELS: Record<string, string> = {
  kit: 'Kit (ConvertKit)',
  mailerlite: 'MailerLite',
  mailchimp: 'Mailchimp',
  activecampaign: 'ActiveCampaign',
};

// MailerLite has groups (not tags per list), so we skip tag selection for it
const PROVIDERS_WITH_TAGS = ['kit', 'mailchimp', 'activecampaign'];

interface FunnelIntegration {
  id: string;
  provider: string;
  list_id: string;
  list_name: string | null;
  tag_id: string | null;
  tag_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ListItem {
  id: string;
  name: string;
}

interface TagItem {
  id: string;
  name: string;
}

interface FunnelIntegrationsTabProps {
  funnelPageId: string;
  connectedProviders: string[];
}

function IntegrationRow({
  integration,
  funnelPageId,
  onRemoved,
  onToggled,
}: {
  integration: FunnelIntegration;
  funnelPageId: string;
  onRemoved: (provider: string) => void;
  onToggled: (provider: string, active: boolean) => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const response = await fetch(`/api/funnels/${funnelPageId}/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: integration.provider,
          list_id: integration.list_id,
          list_name: integration.list_name,
          tag_id: integration.tag_id,
          tag_name: integration.tag_name,
          is_active: !integration.is_active,
        }),
      });

      if (!response.ok) throw new Error('Failed to update');

      onToggled(integration.provider, !integration.is_active);
    } catch (error) {
      logError('funnel-integrations', error, { step: 'toggle_error' });
    } finally {
      setToggling(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm(`Remove ${PROVIDER_LABELS[integration.provider] || integration.provider} from this funnel?`)) {
      return;
    }

    setRemoving(true);
    try {
      const response = await fetch(
        `/api/funnels/${funnelPageId}/integrations/${integration.provider}`,
        { method: 'DELETE' }
      );

      if (!response.ok) throw new Error('Failed to remove');

      onRemoved(integration.provider);
    } catch (error) {
      logError('funnel-integrations', error, { step: 'remove_error' });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
          <Mail className="h-4 w-4 text-violet-500" />
        </div>
        <div>
          <p className="text-sm font-medium">
            {PROVIDER_LABELS[integration.provider] || integration.provider}
          </p>
          <p className="text-xs text-muted-foreground">
            {integration.list_name || integration.list_id}
            {integration.tag_name ? ` / ${integration.tag_name}` : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Toggle active/inactive */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            integration.is_active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          {toggling ? (
            <Loader2 className="h-3 w-3 animate-spin mx-auto text-white" />
          ) : (
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                integration.is_active ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          )}
        </button>

        {/* Remove */}
        <button
          onClick={handleRemove}
          disabled={removing}
          className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
        >
          {removing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      </div>
    </div>
  );
}

function AddIntegrationForm({
  provider,
  funnelPageId,
  onAdded,
  onCancel,
}: {
  provider: string;
  funnelPageId: string;
  onAdded: (integration: FunnelIntegration) => void;
  onCancel: () => void;
}) {
  const [lists, setLists] = useState<ListItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadingTags, setLoadingTags] = useState(false);
  const [selectedListId, setSelectedListId] = useState('');
  const [selectedListName, setSelectedListName] = useState('');
  const [selectedTagId, setSelectedTagId] = useState('');
  const [selectedTagName, setSelectedTagName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasTags = PROVIDERS_WITH_TAGS.includes(provider);

  // Fetch lists on mount
  useEffect(() => {
    async function fetchLists() {
      try {
        const response = await fetch(
          `/api/integrations/email-marketing/lists?provider=${provider}`
        );

        if (!response.ok) throw new Error('Failed to fetch lists');

        const data = await response.json();
        setLists(data.lists || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch lists');
      } finally {
        setLoadingLists(false);
      }
    }

    fetchLists();
  }, [provider]);

  // Fetch tags when list is selected (for providers that support tags)
  const fetchTags = useCallback(async (listId: string) => {
    if (!hasTags || !listId) {
      setTags([]);
      return;
    }

    setLoadingTags(true);
    setSelectedTagId('');
    setSelectedTagName('');

    try {
      const url = `/api/integrations/email-marketing/tags?provider=${provider}&listId=${listId}`;
      const response = await fetch(url);

      if (!response.ok) throw new Error('Failed to fetch tags');

      const data = await response.json();
      setTags(data.tags || []);
    } catch (err) {
      logError('funnel-integrations', err, { step: 'fetch_tags_error' });
      setTags([]);
    } finally {
      setLoadingTags(false);
    }
  }, [provider, hasTags]);

  const handleListChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const listId = e.target.value;
    const list = lists.find((l) => l.id === listId);
    setSelectedListId(listId);
    setSelectedListName(list?.name || '');

    if (listId) {
      fetchTags(listId);
    } else {
      setTags([]);
      setSelectedTagId('');
      setSelectedTagName('');
    }
  };

  const handleTagChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tagId = e.target.value;
    const tag = tags.find((t) => t.id === tagId);
    setSelectedTagId(tagId);
    setSelectedTagName(tag?.name || '');
  };

  const handleSave = async () => {
    if (!selectedListId) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/funnels/${funnelPageId}/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          list_id: selectedListId,
          list_name: selectedListName || null,
          tag_id: selectedTagId || null,
          tag_name: selectedTagName || null,
          is_active: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save integration');
      }

      onAdded(data.integration);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          Add {PROVIDER_LABELS[provider] || provider}
        </p>
        <button
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>

      {loadingLists ? (
        <div className="flex items-center gap-2 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading lists...</span>
        </div>
      ) : (
        <>
          {/* List dropdown */}
          <div>
            <label className="text-xs text-muted-foreground">List / Audience</label>
            <div className="relative mt-1">
              <select
                value={selectedListId}
                onChange={handleListChange}
                className="w-full appearance-none rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary pr-8"
              >
                <option value="">Select a list...</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Tag dropdown (if provider supports tags and list is selected) */}
          {hasTags && selectedListId && (
            <div>
              <label className="text-xs text-muted-foreground">Tag (optional)</label>
              {loadingTags ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Loading tags...</span>
                </div>
              ) : (
                <div className="relative mt-1">
                  <select
                    value={selectedTagId}
                    onChange={handleTagChange}
                    className="w-full appearance-none rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary pr-8"
                  >
                    <option value="">No tag</option>
                    {tags.map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              )}
            </div>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || !selectedListId}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </span>
            ) : (
              'Add Integration'
            )}
          </button>
        </>
      )}

      {error && (
        <p className="flex items-center gap-2 text-sm text-red-500">
          <XCircle className="h-4 w-4" />
          {error}
        </p>
      )}
    </div>
  );
}

export function FunnelIntegrationsTab({
  funnelPageId,
  connectedProviders,
}: FunnelIntegrationsTabProps) {
  const [integrations, setIntegrations] = useState<FunnelIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingProvider, setAddingProvider] = useState<string | null>(null);

  // Fetch existing integrations for this funnel
  useEffect(() => {
    async function fetchIntegrations() {
      try {
        const response = await fetch(`/api/funnels/${funnelPageId}/integrations`);
        if (response.ok) {
          const data = await response.json();
          setIntegrations(data.integrations || []);
        }
      } catch (error) {
        logError('funnel-integrations', error, { step: 'fetch_error' });
      } finally {
        setLoading(false);
      }
    }

    fetchIntegrations();
  }, [funnelPageId]);

  const handleRemoved = (provider: string) => {
    setIntegrations((prev) => prev.filter((i) => i.provider !== provider));
  };

  const handleToggled = (provider: string, active: boolean) => {
    setIntegrations((prev) =>
      prev.map((i) => (i.provider === provider ? { ...i, is_active: active } : i))
    );
  };

  const handleAdded = (integration: FunnelIntegration) => {
    setIntegrations((prev) => {
      // Replace if already exists (upsert), or add
      const exists = prev.findIndex((i) => i.provider === integration.provider);
      if (exists >= 0) {
        const updated = [...prev];
        updated[exists] = integration;
        return updated;
      }
      return [...prev, integration];
    });
    setAddingProvider(null);
  };

  // Providers that are connected globally but not yet mapped to this funnel
  const mappedProviders = new Set(integrations.map((i) => i.provider));
  const unmappedProviders = connectedProviders.filter((p) => !mappedProviders.has(p));

  if (connectedProviders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <div className="flex justify-center mb-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Mail className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
        <h3 className="text-sm font-medium">No email marketing providers connected</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect a provider in Settings to sync leads from this funnel.
        </p>
        <Link
          href="/settings"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Settings className="h-4 w-4" />
          Go to Settings
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Email Marketing Integrations</h3>
        <p className="text-xs text-muted-foreground">
          When a lead opts in to this funnel, they will be automatically added to the lists you configure below.
        </p>
      </div>

      {/* Existing integrations */}
      {integrations.length > 0 && (
        <div className="space-y-2">
          {integrations.map((integration) => (
            <IntegrationRow
              key={integration.id}
              integration={integration}
              funnelPageId={funnelPageId}
              onRemoved={handleRemoved}
              onToggled={handleToggled}
            />
          ))}
        </div>
      )}

      {/* Add form */}
      {addingProvider && (
        <AddIntegrationForm
          provider={addingProvider}
          funnelPageId={funnelPageId}
          onAdded={handleAdded}
          onCancel={() => setAddingProvider(null)}
        />
      )}

      {/* Reminder when no integrations are mapped yet */}
      {integrations.length === 0 && unmappedProviders.length > 0 && !addingProvider && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Leads from this funnel are <strong>not being synced</strong> to your email provider yet. Add a list below to start syncing.
          </p>
        </div>
      )}

      {/* Add buttons for unmapped providers */}
      {unmappedProviders.length > 0 && !addingProvider && (
        <div className="space-y-2">
          {unmappedProviders.map((provider) => (
            <button
              key={provider}
              onClick={() => setAddingProvider(provider)}
              className="flex w-full items-center gap-3 rounded-lg border border-dashed p-3 text-sm text-muted-foreground hover:border-primary hover:text-foreground transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add {PROVIDER_LABELS[provider] || provider}
            </button>
          ))}
        </div>
      )}

      {/* All connected providers are mapped */}
      {integrations.length > 0 && unmappedProviders.length === 0 && !addingProvider && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <CheckCircle className="h-3 w-3 text-green-500" />
          All connected providers are configured for this funnel.
        </p>
      )}
    </div>
  );
}
