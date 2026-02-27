'use client';

import { useState, useEffect } from 'react';
import { Palette, Video, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { BrandingSettings } from '@/components/settings/BrandingSettings';
import { FunnelTemplateSettings } from '@/components/settings/FunnelTemplateSettings';
import { WhiteLabelSettings } from '@/components/settings/WhiteLabelSettings';
import { logError } from '@/lib/utils/logger';

interface BrandingPageProps {
  brandKit: {
    logos?: Array<{ name: string; imageUrl: string }>;
    default_testimonial?: { quote: string; author?: string; role?: string; result?: string } | null;
    default_steps?: { heading?: string; steps: Array<{ title: string; description: string }> } | null;
    default_theme?: string | null;
    default_primary_color?: string | null;
    default_background_style?: string | null;
    logo_url?: string | null;
    font_family?: string | null;
    font_url?: string | null;
  } | null;
  plan: string | undefined;
}

export function BrandingPage({ brandKit, plan }: BrandingPageProps) {
  const [defaultVslUrl, setDefaultVslUrl] = useState('');
  const [defaultVslUrlLoading, setDefaultVslUrlLoading] = useState(true);
  const [savingDefaultVslUrl, setSavingDefaultVslUrl] = useState(false);
  const [defaultVslUrlSaved, setDefaultVslUrlSaved] = useState(false);
  const [defaultVslUrlError, setDefaultVslUrlError] = useState<string | null>(null);
  const [defaultFunnelTemplate, setDefaultFunnelTemplate] = useState('social_proof');

  useEffect(() => {
    const fetchUserDefaults = async () => {
      try {
        const response = await fetch('/api/user/defaults');
        if (response.ok) {
          const data = await response.json();
          setDefaultVslUrl(data.defaultVslUrl || '');
          setDefaultFunnelTemplate(data.defaultFunnelTemplate || 'social_proof');
        }
      } catch (error) {
        logError('settings/branding', error, { step: 'failed_to_fetch_user_defaults' });
      } finally {
        setDefaultVslUrlLoading(false);
      }
    };
    fetchUserDefaults();
  }, []);

  const handleSaveDefaultVslUrl = async () => {
    setSavingDefaultVslUrl(true);
    setDefaultVslUrlError(null);
    setDefaultVslUrlSaved(false);

    try {
      const response = await fetch('/api/user/defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultVslUrl: defaultVslUrl.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save');

      setDefaultVslUrlSaved(true);
      setTimeout(() => setDefaultVslUrlSaved(false), 3000);
    } catch (error) {
      setDefaultVslUrlError(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSavingDefaultVslUrl(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Branding */}
      <div className="rounded-lg border bg-card p-6 transition-colors">
        <div className="mb-4 flex items-center gap-3">
          <Palette className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Branding &amp; Theme</h2>
        </div>
        <BrandingSettings initialData={{
          logos: brandKit?.logos,
          default_testimonial: brandKit?.default_testimonial,
          default_steps: brandKit?.default_steps,
          default_theme: brandKit?.default_theme,
          default_primary_color: brandKit?.default_primary_color,
          default_background_style: brandKit?.default_background_style,
          logo_url: brandKit?.logo_url,
          font_family: brandKit?.font_family,
          font_url: brandKit?.font_url,
        }} />
      </div>

      {/* Page Defaults */}
      <div id="defaults" className="rounded-lg border bg-card p-6 transition-colors">
        <div className="mb-4 flex items-center gap-3">
          <Video className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Page Defaults</h2>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Set default values for new funnel pages. You can override these on individual funnels.
        </p>

        <div className="rounded-lg border p-4">
          <p className="mb-2 text-sm font-medium">Default Thank You Page Video</p>
          <p className="mb-3 text-xs text-muted-foreground">
            This video will automatically appear on new funnel thank you pages. Supports YouTube, Vimeo, and Loom.
          </p>
          {defaultVslUrlLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={defaultVslUrl}
                  onChange={(e) => setDefaultVslUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
                <button
                  onClick={handleSaveDefaultVslUrl}
                  disabled={savingDefaultVslUrl}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {savingDefaultVslUrl ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                </button>
              </div>
              {defaultVslUrlSaved && (
                <p className="mt-2 flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Saved successfully
                </p>
              )}
              {defaultVslUrlError && (
                <p className="mt-2 flex items-center gap-2 text-sm text-red-500">
                  <XCircle className="h-4 w-4" />
                  {defaultVslUrlError}
                </p>
              )}
            </>
          )}
        </div>

        <div className="rounded-lg border p-4 mt-4">
          <FunnelTemplateSettings
            currentTemplate={defaultFunnelTemplate}
            onSaved={setDefaultFunnelTemplate}
          />
        </div>
      </div>

      {/* White Label */}
      <div id="whitelabel">
        <WhiteLabelSettings plan={plan} />
      </div>
    </div>
  );
}
