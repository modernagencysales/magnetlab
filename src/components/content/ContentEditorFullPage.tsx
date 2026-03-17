'use client';

import { ArrowLeft, X } from 'lucide-react';
import { ContentPageClient } from './ContentPageClient';
import type { PolishedContent, ExtractedContent, LeadMagnetConcept } from '@/lib/types/lead-magnet';

interface ContentEditorFullPageProps {
  leadMagnetId: string;
  title: string;
  polishedContent: PolishedContent | null;
  extractedContent: ExtractedContent | null;
  concept: LeadMagnetConcept | null;
  theme: 'dark' | 'light';
  primaryColor: string;
  logoUrl: string | null;
  fontFamily?: string | null;
  fontUrl?: string | null;
  vslUrl: string | null;
  onClose: () => void;
  onSaved: (content: PolishedContent) => void;
}

export function ContentEditorFullPage({
  leadMagnetId,
  title,
  polishedContent,
  extractedContent,
  concept,
  theme,
  primaryColor,
  logoUrl,
  fontFamily,
  fontUrl,
  vslUrl,
  onClose,
  onSaved,
}: ContentEditorFullPageProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Top toolbar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-3">
        {/* Left: Back button */}
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Funnel Builder</span>
        </button>

        {/* Center: Editing label */}
        <div className="absolute left-1/2 -translate-x-1/2 text-sm font-medium text-foreground truncate max-w-[40%]">
          Editing: {title}
        </div>

        {/* Right: Close button */}
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content editor */}
      <div className="flex-1 overflow-auto">
        <ContentPageClient
          leadMagnetId={leadMagnetId}
          title={title}
          polishedContent={polishedContent}
          extractedContent={extractedContent}
          concept={concept}
          theme={theme}
          primaryColor={primaryColor}
          logoUrl={logoUrl}
          fontFamily={fontFamily}
          fontUrl={fontUrl}
          vslUrl={vslUrl}
          calendlyUrl={null}
          thumbnailUrl={null}
          isOwner={true}
          autoEdit={true}
          onSaved={onSaved}
        />
      </div>
    </div>
  );
}
