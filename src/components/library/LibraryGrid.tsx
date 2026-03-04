'use client';

import Link from 'next/link';
import { ExternalLink, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LibraryItem } from './LibraryPageClient';
import * as publicApi from '@/frontend/api/public';

interface LibraryGridProps {
  items: LibraryItem[];
  username: string;
  funnelSlug: string;
  isDark: boolean;
  primaryColor: string;
  leadId: string | null;
  funnelPageId: string;
}

export function LibraryGrid({
  items,
  username,
  funnelSlug,
  isDark,
  primaryColor,
  leadId,
  funnelPageId,
}: LibraryGridProps) {
  const handleExternalClick = async (resourceId: string) => {
    try {
      await publicApi.trackResourceClick({ resourceId, funnelPageId, leadId });
    } catch {
      // Silent fail - don't block navigation
    }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const isExternal = item.assetType === 'external_resource';

        // Build the URL
        let href: string;
        if (isExternal && item.externalUrl) {
          href = item.externalUrl;
        } else if (item.slug) {
          const params = new URLSearchParams();
          if (leadId) params.set('leadId', leadId);
          const queryString = params.toString();
          href = `/p/${username}/${funnelSlug}/content/${item.slug}${queryString ? `?${queryString}` : ''}`;
        } else {
          href = '#';
        }

        const CardContent = (
          <>
            <div className="flex items-start gap-3">
              <span className="text-2xl">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{item.title}</h3>
                {isExternal && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-xs mt-1',
                      isDark ? 'text-gray-400' : 'text-gray-500'
                    )}
                  >
                    <ExternalLink className="h-3 w-3" />
                    External link
                  </span>
                )}
              </div>
            </div>
            {(item.isFeatured || item.isNew) && (
              <div className="absolute top-2 right-2">
                {item.isNew ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: primaryColor, color: 'white' }}
                  >
                    <Sparkles className="h-3 w-3" />
                    New
                  </span>
                ) : (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                      isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    Featured
                  </span>
                )}
              </div>
            )}
          </>
        );

        const cardClassName = cn(
          'relative block rounded-lg border p-4 transition-all hover:shadow-md',
          isDark
            ? 'border-gray-800 bg-gray-900 hover:border-gray-700'
            : 'border-gray-200 bg-gray-50 hover:border-gray-300'
        );

        if (isExternal && item.externalUrl) {
          return (
            <a
              key={item.id}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={cardClassName}
              onClick={() => handleExternalClick(item.resourceId!)}
            >
              {CardContent}
            </a>
          );
        }

        return (
          <Link key={item.id} href={href} className={cardClassName}>
            {CardContent}
          </Link>
        );
      })}
    </div>
  );
}
