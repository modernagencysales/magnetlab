/**
 * Catalog Service
 * Builds catalog list with funnel slugs and public URLs.
 */

import * as catalogRepo from '@/server/repositories/catalog.repo';
import type { DataScope } from '@/lib/utils/team-context';

export interface CatalogItem {
  id: string;
  title: string;
  archetype: string | null;
  pain_point: string | null;
  target_audience: string | null;
  short_description: string | null;
  status: string;
  created_at: string;
  funnelSlug: string | null;
  funnelPublished: boolean;
  publicUrl: string | null;
}

export async function getCatalog(userId: string, scope: DataScope) {
  const ownerId = scope.ownerId ?? userId;
  const magnets = await catalogRepo.findCatalogMagnets(scope);
  const magnetIds = magnets.map((m) => m.id);
  const [funnelRows, ownerUser] = await Promise.all([
    catalogRepo.findFunnelSlugsByMagnetIds(magnetIds),
    catalogRepo.findOwnerById(ownerId),
  ]);

  const funnelMap: Record<string, { slug: string; is_published: boolean }> = {};
  for (const f of funnelRows) {
    funnelMap[f.lead_magnet_id] = { slug: f.slug, is_published: f.is_published };
  }

  const catalog: CatalogItem[] = magnets.map((m) => {
    const fp = funnelMap[m.id];
    const publicUrl =
      fp?.slug && fp?.is_published && ownerUser?.username
        ? `/p/${ownerUser.username}/${fp.slug}`
        : null;
    return {
      ...m,
      funnelSlug: fp?.slug ?? null,
      funnelPublished: fp?.is_published ?? false,
      publicUrl,
    };
  });

  return {
    catalog,
    owner: {
      id: ownerId,
      name: ownerUser?.name ?? null,
      username: ownerUser?.username ?? null,
    },
    isOwner: ownerId === userId,
  };
}
