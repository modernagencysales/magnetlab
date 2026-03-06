/**
 * Libraries Service
 * Business logic for libraries and library items.
 */

import { libraryFromRow, libraryItemFromRow, type LibraryRow, type LibraryItemRow, type LibraryItemWithAsset } from '@/lib/types/library';
import { logApiError } from '@/lib/api/errors';
import * as librariesRepo from '@/server/repositories/libraries.repo';

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function list(userId: string, limit: number, offset: number) {
  const { data, error } = await librariesRepo.listLibraries(userId, limit, offset);
  if (error) {
    logApiError('libraries/list', error, { userId });
    return { success: false, error: 'database' as const };
  }
  return { success: true, libraries: (data as LibraryRow[]).map(libraryFromRow) };
}

export async function create(
  userId: string,
  payload: { name: string; description?: string; icon?: string; slug?: string; autoFeatureDays?: number }
) {
  const name = payload.name.trim();
  const baseSlug = payload.slug || slugFromName(name);
  let finalSlug = baseSlug;

  for (let attempt = 0; attempt < 100; attempt++) {
    const inUse = await librariesRepo.findSlugInUse(userId, finalSlug);
    if (!inUse) break;
    finalSlug = `${baseSlug}-${attempt + 1}`;
    if (attempt === 99) {
      return { success: false, error: 'conflict' as const, message: 'Unable to generate unique slug' };
    }
  }

  const { data, error } = await librariesRepo.createLibrary({
    userId,
    name,
    description: payload.description ?? null,
    icon: payload.icon ?? '📚',
    slug: finalSlug,
    autoFeatureDays: payload.autoFeatureDays ?? 14,
  });

  if (error) {
    logApiError('libraries/create', error, { userId });
    return { success: false, error: 'database' as const };
  }
  return { success: true, library: libraryFromRow(data!) };
}

export async function getById(userId: string, id: string) {
  const { data, error } = await librariesRepo.getLibraryWithItems(id, userId);
  if (error || !data) {
    return { success: false, error: 'not_found' as const };
  }
  return { success: true, library: libraryFromRow(data.library), items: data.items };
}

export async function update(
  userId: string,
  id: string,
  payload: { name?: string; description?: string | null; icon?: string; slug?: string; autoFeatureDays?: number }
) {
  const { data: existing } = await librariesRepo.getLibraryById(id, userId);
  if (!existing) {
    return { success: false, error: 'not_found' as const };
  }

  if (payload.slug !== undefined) {
    const inUse = await librariesRepo.findSlugInUse(userId, payload.slug, id);
    if (inUse) return { success: false, error: 'conflict' as const, message: 'Slug already in use' };
  }

  const update: Partial<Record<string, unknown>> = {};
  if (payload.name !== undefined) update.name = payload.name;
  if (payload.description !== undefined) update.description = payload.description;
  if (payload.icon !== undefined) update.icon = payload.icon;
  if (payload.slug !== undefined) update.slug = payload.slug;
  if (payload.autoFeatureDays !== undefined) update.auto_feature_days = payload.autoFeatureDays;

  if (Object.keys(update).length === 0) {
    return { success: false, error: 'validation' as const, message: 'No fields to update' };
  }

  const { data, error } = await librariesRepo.updateLibrary(id, userId, update as Parameters<typeof librariesRepo.updateLibrary>[2]);
  if (error) {
    logApiError('libraries/update', error, { userId, libraryId: id });
    return { success: false, error: 'database' as const };
  }
  return { success: true, library: libraryFromRow(data!) };
}

export async function deleteLibrary(userId: string, id: string) {
  const { data: existing } = await librariesRepo.getLibraryById(id, userId);
  if (!existing) {
    return { success: false, error: 'not_found' as const };
  }
  const { error } = await librariesRepo.deleteLibrary(id, userId);
  if (error) {
    logApiError('libraries/delete', error, { userId, libraryId: id });
    return { success: false, error: 'database' as const };
  }
  return { success: true };
}

type ItemRowWithJoins = LibraryItemRow & {
  lead_magnets?: { id: string; title: string; slug?: string };
  external_resources?: { id: string; title: string; url: string; icon: string };
};

export async function listItems(userId: string, libraryId: string) {
  const { data: meta, error: metaError } = await librariesRepo.getLibraryMeta(libraryId, userId);
  if (metaError || !meta) {
    return { success: false, error: 'not_found' as const };
  }

  const { data: itemRows, error } = await librariesRepo.listLibraryItems(libraryId);
  if (error) {
    logApiError('libraries/items/list', error, { userId, libraryId });
    return { success: false, error: 'database' as const };
  }

  const autoFeatureDays = meta.auto_feature_days ?? 14;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - autoFeatureDays);

  const items: LibraryItemWithAsset[] = (itemRows as ItemRowWithJoins[]).map((row) => {
    const baseItem = libraryItemFromRow(row);
    const isNew = new Date(baseItem.addedAt) > cutoffDate;
    if (row.asset_type === 'lead_magnet' && row.lead_magnets) {
      return {
        ...baseItem,
        leadMagnet: row.lead_magnets,
        displayTitle: row.lead_magnets.title,
        displayIcon: row.icon_override || '📄',
        isNew,
      };
    }
    if (row.asset_type === 'external_resource' && row.external_resources) {
      return {
        ...baseItem,
        externalResource: row.external_resources,
        displayTitle: row.external_resources.title,
        displayIcon: row.icon_override || row.external_resources.icon || '🔗',
        isNew,
      };
    }
    return { ...baseItem, displayTitle: 'Unknown', displayIcon: '❓', isNew };
  });

  return { success: true, items };
}

export async function addItem(
  userId: string,
  libraryId: string,
  payload: {
    assetType: 'lead_magnet' | 'external_resource';
    leadMagnetId?: string;
    externalResourceId?: string;
    iconOverride?: string;
    sortOrder?: number;
    isFeatured?: boolean;
  }
) {
  const { data: library } = await librariesRepo.getLibraryMeta(libraryId, userId);
  if (!library) return { success: false, error: 'not_found' as const, code: 'library' as const };

  if (payload.assetType === 'lead_magnet') {
    const { found } = await librariesRepo.getLeadMagnetByIdForUser(payload.leadMagnetId!, userId);
    if (!found) return { success: false, error: 'not_found' as const, code: 'lead_magnet' as const };
  } else {
    const { found } = await librariesRepo.getExternalResourceByIdForUser(payload.externalResourceId!, userId);
    if (!found) return { success: false, error: 'not_found' as const, code: 'external_resource' as const };
  }

  let sortOrder = payload.sortOrder;
  if (sortOrder === undefined) {
    sortOrder = await librariesRepo.getMaxSortOrder(libraryId);
  }

  const { data, error } = await librariesRepo.addLibraryItem({
    libraryId,
    assetType: payload.assetType,
    leadMagnetId: payload.assetType === 'lead_magnet' ? payload.leadMagnetId! : null,
    externalResourceId: payload.assetType === 'external_resource' ? payload.externalResourceId! : null,
    iconOverride: payload.iconOverride ?? null,
    sortOrder,
    isFeatured: payload.isFeatured ?? false,
  });

  if (error) {
    if (error.code === '23505') return { success: false, error: 'conflict' as const, message: 'Item already exists in this library' };
    logApiError('libraries/items/add', error, { userId, libraryId });
    return { success: false, error: 'database' as const };
  }
  return { success: true, item: libraryItemFromRow(data as LibraryItemRow) };
}

export async function updateItem(
  userId: string,
  libraryId: string,
  itemId: string,
  payload: { iconOverride?: string | null; sortOrder?: number; isFeatured?: boolean }
) {
  const { data: library } = await librariesRepo.getLibraryMeta(libraryId, userId);
  if (!library) return { success: false, error: 'not_found' as const };

  const { data: existing } = await librariesRepo.getLibraryItem(itemId, libraryId);
  if (!existing) return { success: false, error: 'not_found' as const };

  const update: Partial<{ icon_override: string | null; sort_order: number; is_featured: boolean }> = {};
  if (payload.iconOverride !== undefined) update.icon_override = payload.iconOverride;
  if (payload.sortOrder !== undefined) update.sort_order = payload.sortOrder;
  if (payload.isFeatured !== undefined) update.is_featured = payload.isFeatured;

  if (Object.keys(update).length === 0) {
    return { success: false, error: 'validation' as const, message: 'No fields to update' };
  }

  const { data, error } = await librariesRepo.updateLibraryItem(itemId, libraryId, update);
  if (error) {
    logApiError('libraries/items/update', error, { userId, libraryId, itemId });
    return { success: false, error: 'database' as const };
  }
  return { success: true, item: libraryItemFromRow(data as LibraryItemRow) };
}

export async function deleteItem(userId: string, libraryId: string, itemId: string) {
  const { data: library } = await librariesRepo.getLibraryMeta(libraryId, userId);
  if (!library) return { success: false, error: 'not_found' as const };

  const { error } = await librariesRepo.deleteLibraryItem(itemId, libraryId);
  if (error) {
    logApiError('libraries/items/delete', error, { userId, libraryId, itemId });
    return { success: false, error: 'database' as const };
  }
  return { success: true };
}

export async function reorderItems(userId: string, libraryId: string, items: Array<{ id: string; sortOrder: number }>) {
  const { data: library } = await librariesRepo.getLibraryMeta(libraryId, userId);
  if (!library) return { success: false, error: 'not_found' as const };

  const { error } = await librariesRepo.reorderLibraryItems(
    libraryId,
    items.map((i) => ({ id: i.id, sort_order: i.sortOrder }))
  );
  if (error) {
    logApiError('libraries/items/reorder', error, { userId, libraryId });
    return { success: false, error: 'database' as const };
  }
  return { success: true };
}
