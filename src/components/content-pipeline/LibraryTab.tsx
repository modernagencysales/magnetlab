'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const TemplatesTab = dynamic(
  () => import('@/components/content-pipeline/TemplatesTab').then((m) => ({ default: m.TemplatesTab })),
  { ssr: false, loading: () => <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> }
);
const SwipeFileContent = dynamic(
  () => import('@/components/swipe-file/SwipeFileContent').then((m) => ({ default: m.SwipeFileContent })),
  { ssr: false, loading: () => <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> }
);
const StylesSection = dynamic(
  () => import('@/components/content-pipeline/StylesSection').then((m) => ({ default: m.StylesSection })),
  { ssr: false, loading: () => <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> }
);

type LibrarySection = 'templates' | 'inspiration' | 'styles';

interface LibraryTabProps {
  profileId?: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function LibraryTab({ profileId }: LibraryTabProps) {
  const [section, setSection] = useState<LibrarySection>('templates');

  return (
    <div>
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setSection('templates')}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            section === 'templates'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary hover:bg-secondary/80'
          )}
        >
          Templates
        </button>
        <button
          onClick={() => setSection('inspiration')}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            section === 'inspiration'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary hover:bg-secondary/80'
          )}
        >
          Inspiration
        </button>
        <button
          onClick={() => setSection('styles')}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            section === 'styles'
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary hover:bg-secondary/80'
          )}
        >
          Styles
        </button>
      </div>

      {section === 'templates' && <TemplatesTab />}
      {section === 'inspiration' && <SwipeFileContent />}
      {section === 'styles' && <StylesSection />}
    </div>
  );
}
