// Library Types for MagnetLab

// ============================================
// EXTERNAL RESOURCES
// ============================================

export interface ExternalResource {
  id: string;
  userId: string;
  title: string;
  url: string;
  icon: string;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExternalResourceRow {
  id: string;
  user_id: string;
  title: string;
  url: string;
  icon: string;
  click_count: number;
  created_at: string;
  updated_at: string;
}

export function externalResourceFromRow(row: ExternalResourceRow): ExternalResource {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    url: row.url,
    icon: row.icon || '🔗',
    clickCount: row.click_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================
// LIBRARIES
// ============================================

export interface Library {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  icon: string;
  slug: string;
  autoFeatureDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string;
  slug: string;
  auto_feature_days: number;
  created_at: string;
  updated_at: string;
}

export function libraryFromRow(row: LibraryRow): Library {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    icon: row.icon || '📚',
    slug: row.slug,
    autoFeatureDays: row.auto_feature_days || 14,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================
// LIBRARY ITEMS
// ============================================

export type LibraryItemAssetType = 'lead_magnet' | 'external_resource';

export interface LibraryItem {
  id: string;
  libraryId: string;
  assetType: LibraryItemAssetType;
  leadMagnetId: string | null;
  externalResourceId: string | null;
  iconOverride: string | null;
  sortOrder: number;
  isFeatured: boolean;
  addedAt: string;
}

export interface LibraryItemRow {
  id: string;
  library_id: string;
  asset_type: string;
  lead_magnet_id: string | null;
  external_resource_id: string | null;
  icon_override: string | null;
  sort_order: number;
  is_featured: boolean;
  added_at: string;
}

export function libraryItemFromRow(row: LibraryItemRow): LibraryItem {
  return {
    id: row.id,
    libraryId: row.library_id,
    assetType: row.asset_type as LibraryItemAssetType,
    leadMagnetId: row.lead_magnet_id,
    externalResourceId: row.external_resource_id,
    iconOverride: row.icon_override,
    sortOrder: row.sort_order,
    isFeatured: row.is_featured,
    addedAt: row.added_at,
  };
}

// ============================================
// LIBRARY ITEM WITH ASSET DATA (for display)
// ============================================

export interface LibraryItemWithAsset extends LibraryItem {
  // Lead magnet data (if asset_type = 'lead_magnet')
  leadMagnet?: {
    id: string;
    title: string;
    slug?: string;
  };
  // External resource data (if asset_type = 'external_resource')
  externalResource?: {
    id: string;
    title: string;
    url: string;
    icon: string;
  };
  // Computed display properties
  displayTitle: string;
  displayIcon: string;
  isNew: boolean; // Based on addedAt and library's autoFeatureDays
}

// ============================================
// API PAYLOADS
// ============================================

export interface CreateLibraryPayload {
  name: string;
  description?: string;
  icon?: string;
  slug?: string;
  autoFeatureDays?: number;
}

export interface UpdateLibraryPayload {
  name?: string;
  description?: string | null;
  icon?: string;
  slug?: string;
  autoFeatureDays?: number;
}

export interface AddLibraryItemPayload {
  assetType: LibraryItemAssetType;
  leadMagnetId?: string;
  externalResourceId?: string;
  iconOverride?: string;
  sortOrder?: number;
  isFeatured?: boolean;
}

export interface UpdateLibraryItemPayload {
  iconOverride?: string | null;
  sortOrder?: number;
  isFeatured?: boolean;
}

export interface ReorderLibraryItemsPayload {
  items: Array<{ id: string; sortOrder: number }>;
}

export interface CreateExternalResourcePayload {
  title: string;
  url: string;
  icon?: string;
}

export interface UpdateExternalResourcePayload {
  title?: string;
  url?: string;
  icon?: string;
}

// ============================================
// PUBLIC LIBRARY PAGE DATA
// ============================================

export interface PublicLibraryPageData {
  // Library info
  libraryId: string;
  name: string;
  description: string | null;
  icon: string;
  autoFeatureDays: number;

  // Items with display data
  items: Array<{
    id: string;
    assetType: LibraryItemAssetType;
    title: string;
    icon: string;
    slug: string | null; // For lead magnets
    externalUrl: string | null; // For external resources
    isFeatured: boolean;
    isNew: boolean;
    sortOrder: number;
  }>;

  // Funnel info (for theming and context)
  funnelSlug: string;
  username: string;

  // User info
  userName: string | null;
  userAvatar: string | null;

  // Theme
  theme: 'dark' | 'light';
  primaryColor: string;
  logoUrl: string | null;

  // Qualification status
  hasQuestions: boolean;
  leadId: string | null;
  hasCompletedSurvey: boolean;
}
