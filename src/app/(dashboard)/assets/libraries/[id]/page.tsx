'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, Plus, Trash2, GripVertical, ExternalLink, FileText, Search, Save, Globe } from 'lucide-react';
import Link from 'next/link';
import { BackLink, FormError, IconPicker, LIBRARY_ICONS } from '@/components/assets';

interface LibraryItem {
  id: string;
  assetType: 'lead_magnet' | 'external_resource';
  assetId: string;
  assetTitle: string;
  iconOverride: string | null;
  sortOrder: number;
  isFeatured: boolean;
}

interface Library {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  slug: string;
}

interface AvailableAsset {
  id: string;
  title: string;
  type: 'lead_magnet' | 'external_resource';
  icon?: string;
}

function getAssetIcon(item: LibraryItem): string {
  if (item.iconOverride) return item.iconOverride;
  return item.assetType === 'lead_magnet' ? '📄' : '🔗';
}

function getAssetTypeLabel(type: 'lead_magnet' | 'external_resource'): string {
  return type === 'lead_magnet' ? 'Lead Magnet' : 'External Resource';
}

export default function LibraryEditorPage() {
  const router = useRouter();
  const params = useParams();
  const libraryId = params.id as string;

  const [library, setLibrary] = useState<Library | null>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [availableAssets, setAvailableAssets] = useState<AvailableAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('📚');

  const fetchLibrary = useCallback(async () => {
    try {
      const response = await fetch(`/api/libraries/${libraryId}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push('/pages');
          return;
        }
        throw new Error('Failed to fetch library');
      }
      const data = await response.json();
      setLibrary(data.library);
      setItems(data.items || []);
      setName(data.library.name);
      setDescription(data.library.description || '');
      setIcon(data.library.icon);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load library');
    } finally {
      setIsLoading(false);
    }
  }, [libraryId, router]);

  const fetchAvailableAssets = useCallback(async () => {
    try {
      const [leadMagnetsRes, externalResourcesRes] = await Promise.all([
        fetch('/api/lead-magnet'),
        fetch('/api/external-resources'),
      ]);

      const leadMagnets = leadMagnetsRes.ok ? await leadMagnetsRes.json() : { leadMagnets: [] };
      const externalResources = externalResourcesRes.ok ? await externalResourcesRes.json() : { resources: [] };

      const assets: AvailableAsset[] = [
        ...(leadMagnets.leadMagnets || []).map((lm: { id: string; title: string }) => ({
          id: lm.id,
          title: lm.title,
          type: 'lead_magnet' as const,
        })),
        ...(externalResources.resources || []).map((er: { id: string; title: string; icon: string }) => ({
          id: er.id,
          title: er.title,
          type: 'external_resource' as const,
          icon: er.icon,
        })),
      ];

      setAvailableAssets(assets);
    } catch (err) {
      console.error('Failed to fetch available assets:', err);
    }
  }, []);

  useEffect(() => {
    fetchLibrary();
    fetchAvailableAssets();
  }, [fetchLibrary, fetchAvailableAssets]);

  async function handleSave(): Promise<void> {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/libraries/${libraryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: description || null, icon }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save library');
      }

      const { library: updated } = await response.json();
      setLibrary(updated);
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save library');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddItem(asset: AvailableAsset): Promise<void> {
    try {
      const response = await fetch(`/api/libraries/${libraryId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetType: asset.type,
          leadMagnetId: asset.type === 'lead_magnet' ? asset.id : undefined,
          externalResourceId: asset.type === 'external_resource' ? asset.id : undefined,
          sortOrder: items.length,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add item');
      }

      const { item } = await response.json();
      setItems([...items, { ...item, assetTitle: asset.title }]);
      setShowAddModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
    }
  }

  async function handleRemoveItem(itemId: string): Promise<void> {
    try {
      const response = await fetch(`/api/libraries/${libraryId}/items/${itemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove item');
      }

      setItems(items.filter((item) => item.id !== itemId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove item');
    }
  }

  async function handleToggleFeatured(itemId: string, isFeatured: boolean): Promise<void> {
    try {
      const response = await fetch(`/api/libraries/${libraryId}/items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFeatured: !isFeatured }),
      });

      if (!response.ok) {
        throw new Error('Failed to update item');
      }

      setItems(items.map((item) => (item.id === itemId ? { ...item, isFeatured: !isFeatured } : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item');
    }
  }

  function handleFieldChange<T>(setter: (value: T) => void): (value: T) => void {
    return (value: T) => {
      setter(value);
      setHasChanges(true);
    };
  }

  const existingAssetIds = new Set(items.map((item) => item.assetId));
  const filteredAssets = availableAssets.filter(
    (asset) =>
      !existingAssetIds.has(asset.id) &&
      asset.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-muted-foreground" size={32} />
      </div>
    );
  }

  if (!library) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <BackLink />
      </div>

      <FormError message={error} onDismiss={() => setError(null)} />

      {/* Library Details */}
      <div className="border rounded-lg p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Library Details</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-2">
              Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => handleFieldChange(setName)(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => handleFieldChange(setDescription)(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <IconPicker
            value={icon}
            onChange={handleFieldChange(setIcon)}
            options={LIBRARY_ICONS}
          />

          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={isSaving || !name.trim()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Changes
            </button>
          )}
        </div>
      </div>

      {/* Funnel Page */}
      <div className="border rounded-lg p-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Globe size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Funnel Page</h2>
              <p className="text-sm text-muted-foreground">
                Create a landing page to share this library
              </p>
            </div>
          </div>
          <Link
            href={`/assets/libraries/${libraryId}/funnel`}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors"
          >
            {items.length > 0 ? 'Edit Funnel' : 'Create Funnel'}
          </Link>
        </div>
      </div>

      {/* Library Items */}
      <div className="border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Library Items ({items.length})</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Plus size={16} />
            Add Item
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No items in this library yet. Add lead magnets or external resources to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <GripVertical size={16} className="text-muted-foreground cursor-grab" />
                <span className="text-xl">{getAssetIcon(item)}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{item.assetTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {getAssetTypeLabel(item.assetType)}
                    {item.isFeatured && ' · Featured'}
                  </p>
                </div>
                <button
                  onClick={() => handleToggleFeatured(item.id, item.isFeatured)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    item.isFeatured
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {item.isFeatured ? 'Featured' : 'Feature'}
                </button>
                <button
                  onClick={() => handleRemoveItem(item.id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowAddModal(false)}
          />
          <div className="fixed inset-x-4 top-[10%] max-w-lg mx-auto bg-background border rounded-lg shadow-lg z-50 max-h-[80vh] flex flex-col">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Add Item to Library</h3>
            </div>

            <div className="p-4 border-b">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search assets..."
                  className="w-full pl-9 pr-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {filteredAssets.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  {searchTerm ? 'No matching assets found' : 'No available assets to add'}
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredAssets.map((asset) => (
                    <button
                      key={asset.id}
                      onClick={() => handleAddItem(asset)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      {asset.type === 'lead_magnet' ? (
                        <FileText size={20} className="text-muted-foreground" />
                      ) : (
                        <ExternalLink size={20} className="text-muted-foreground" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{asset.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {getAssetTypeLabel(asset.type)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t">
              <button
                onClick={() => setShowAddModal(false)}
                className="w-full px-4 py-2 border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
