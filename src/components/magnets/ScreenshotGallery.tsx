'use client';

import { useState } from 'react';
import type { ScreenshotUrl } from '@/lib/types/lead-magnet';

interface ScreenshotGalleryProps {
  screenshotUrls: ScreenshotUrl[];
  leadMagnetId: string;
  hasPublishedFunnel: boolean;
}

export function ScreenshotGallery({
  screenshotUrls: initialUrls,
  leadMagnetId,
  hasPublishedFunnel,
}: ScreenshotGalleryProps) {
  const [screenshotUrls, setScreenshotUrls] = useState<ScreenshotUrl[]>(initialUrls);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<'1200x627' | '1080x1080'>('1200x627');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/lead-magnet/${leadMagnetId}/screenshots`, {
        method: 'POST',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate screenshots');
      }
      const data = await res.json();
      setScreenshotUrls(data.screenshotUrls);
      setSelectedIndex(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate screenshots');
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedShot = selectedIndex !== null ? screenshotUrls[selectedIndex] : null;
  const selectedUrl = selectedShot
    ? selectedFormat === '1200x627' ? selectedShot.url1200x627 : selectedShot.url1080x1080
    : null;

  const canGenerate = hasPublishedFunnel;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Post Images</h3>
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !canGenerate}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          title={!canGenerate ? 'Publish a funnel page first' : undefined}
        >
          {isGenerating ? 'Generating...' : screenshotUrls.length ? 'Regenerate' : 'Generate Images'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {!canGenerate && screenshotUrls.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Publish a funnel page first to generate post images.
        </p>
      )}

      {screenshotUrls.length > 0 && (
        <>
          {/* Format toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedFormat('1200x627')}
              className={`rounded px-2 py-1 text-xs ${selectedFormat === '1200x627' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              Landscape (1200x627)
            </button>
            <button
              onClick={() => setSelectedFormat('1080x1080')}
              className={`rounded px-2 py-1 text-xs ${selectedFormat === '1080x1080' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              Square (1080x1080)
            </button>
          </div>

          {/* Thumbnail grid */}
          <div className="grid grid-cols-3 gap-2">
            {screenshotUrls.map((shot, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedIndex(idx)}
                className={`relative overflow-hidden rounded-lg border-2 transition-all ${
                  selectedIndex === idx ? 'border-primary ring-2 ring-primary/20' : 'border-transparent hover:border-muted'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedFormat === '1200x627' ? shot.url1200x627 : shot.url1080x1080}
                  alt={shot.type === 'hero' ? 'Hero' : shot.sectionName || `Section ${(shot.sectionIndex ?? 0) + 1}`}
                  className="aspect-video w-full object-cover"
                />
                <span className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-xs text-white">
                  {shot.type === 'hero' ? 'Hero' : shot.sectionName || `Section ${(shot.sectionIndex ?? 0) + 1}`}
                </span>
              </button>
            ))}
          </div>

          {/* Preview */}
          {selectedUrl && (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selectedUrl}
                alt="Selected screenshot"
                className="w-full rounded-lg border"
              />
              <div className="flex gap-2">
                <a
                  href={selectedUrl}
                  download
                  className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80"
                >
                  Download
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedUrl);
                  }}
                  className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80"
                >
                  Copy URL
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {canGenerate && screenshotUrls.length === 0 && !isGenerating && (
        <p className="text-sm text-muted-foreground">
          Generate preview images of your content page to use in LinkedIn posts.
        </p>
      )}
    </div>
  );
}
