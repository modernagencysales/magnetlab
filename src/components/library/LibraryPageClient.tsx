'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { LibrarySearch } from './LibrarySearch';
import { LibraryGrid } from './LibraryGrid';
import { SurveyPromptCard } from './SurveyPromptCard';
import { cn } from '@/lib/utils';

export interface LibraryItem {
  id: string;
  assetType: 'lead_magnet' | 'external_resource';
  title: string;
  icon: string;
  slug: string | null;
  externalUrl: string | null;
  isFeatured: boolean;
  isNew: boolean;
  sortOrder: number;
  resourceId: string | null;
}

interface LibraryPageClientProps {
  library: {
    id: string;
    name: string;
    description: string | null;
    icon: string;
  };
  items: LibraryItem[];
  funnelSlug: string;
  username: string;
  userName: string | null;
  userAvatar: string | null;
  theme: 'dark' | 'light';
  primaryColor: string;
  logoUrl: string | null;
  hasQuestions: boolean;
  leadId: string | null;
  hasCompletedSurvey: boolean;
  funnelPageId: string;
}

export function LibraryPageClient({
  library,
  items,
  funnelSlug,
  username,
  userName,
  userAvatar,
  theme,
  primaryColor,
  logoUrl,
  hasQuestions,
  leadId,
  hasCompletedSurvey,
  funnelPageId,
}: LibraryPageClientProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter((item) => item.title.toLowerCase().includes(query));
  }, [items, searchQuery]);

  // Separate featured/new items
  const featuredItems = filteredItems.filter((item) => item.isFeatured || item.isNew);
  const regularItems = filteredItems.filter((item) => !item.isFeatured && !item.isNew);

  const isDark = theme === 'dark';
  const showSurveyPrompt = hasQuestions && leadId && !hasCompletedSurvey;

  return (
    <div
      className={cn('min-h-screen bg-background text-foreground', isDark && 'dark')}
      style={{ '--primary-color': primaryColor } as React.CSSProperties}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg"
      >
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-8 w-auto" />
              ) : (
                <span className="text-2xl">{library.icon}</span>
              )}
              <div>
                <h1 className="text-lg font-semibold">{library.name}</h1>
                {userName && (
                  <p className="text-sm text-muted-foreground">
                    by {userName}
                  </p>
                )}
              </div>
            </div>
            {userAvatar && (
              <Image
                src={userAvatar}
                alt={userName || ''}
                width={40}
                height={40}
                className="h-10 w-10 rounded-full"
              />
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Description */}
        {library.description && (
          <p className="mb-8 text-lg text-muted-foreground">
            {library.description}
          </p>
        )}

        {/* Search */}
        <LibrarySearch
          value={searchQuery}
          onChange={setSearchQuery}
          isDark={isDark}
          itemCount={filteredItems.length}
          totalCount={items.length}
        />

        {/* Featured/New Section */}
        {featuredItems.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Featured & New
            </h2>
            <LibraryGrid
              items={featuredItems}
              username={username}
              funnelSlug={funnelSlug}
              isDark={isDark}
              primaryColor={primaryColor}
              leadId={leadId}
              funnelPageId={funnelPageId}
            />
          </section>
        )}

        {/* All Resources Section */}
        {regularItems.length > 0 && (
          <section>
            {featuredItems.length > 0 && (
              <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                All Resources
              </h2>
            )}
            <LibraryGrid
              items={regularItems}
              username={username}
              funnelSlug={funnelSlug}
              isDark={isDark}
              primaryColor={primaryColor}
              leadId={leadId}
              funnelPageId={funnelPageId}
            />
          </section>
        )}

        {/* Empty State */}
        {filteredItems.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-lg text-muted-foreground">
              {searchQuery
                ? `No resources found for "${searchQuery}"`
                : 'No resources available yet.'}
            </p>
          </div>
        )}
      </main>

      {/* Survey Prompt */}
      {showSurveyPrompt && (
        <SurveyPromptCard
          funnelSlug={funnelSlug}
          username={username}
          leadId={leadId!}
          isDark={isDark}
          primaryColor={primaryColor}
        />
      )}
    </div>
  );
}
