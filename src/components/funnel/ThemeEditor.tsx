'use client';

import { useState } from 'react';
import { Palette, Sun, Moon, X, Link as LinkIcon, RefreshCw, Loader2 } from 'lucide-react';
import type { FunnelTheme, BackgroundStyle } from '@/lib/types/funnel';

interface ThemeEditorProps {
  theme: FunnelTheme;
  setTheme: (theme: FunnelTheme) => void;
  primaryColor: string;
  setPrimaryColor: (color: string) => void;
  backgroundStyle: BackgroundStyle;
  setBackgroundStyle: (style: BackgroundStyle) => void;
  logoUrl: string | null;
  setLogoUrl: (url: string | null) => void;
  funnelId?: string | null;
  onBrandApplied?: () => void;
}

const PRESET_COLORS = [
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Pink', value: '#ec4899' },
];

export function ThemeEditor({
  theme,
  setTheme,
  primaryColor,
  setPrimaryColor,
  backgroundStyle,
  setBackgroundStyle,
  logoUrl,
  setLogoUrl,
  funnelId,
  onBrandApplied,
}: ThemeEditorProps) {
  const [applyingBrand, setApplyingBrand] = useState(false);
  const [brandMessage, setBrandMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleReapplyBrandKit = async () => {
    if (!funnelId) return;
    setApplyingBrand(true);
    setBrandMessage(null);

    try {
      const res = await fetch(`/api/funnel/${funnelId}/reapply-brand`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setBrandMessage({ type: 'error', text: data.error || 'Failed to apply brand kit' });
        return;
      }

      if (data.applied && data.applied.length > 0) {
        // Update local state with the new brand values
        if (data.values) {
          if (data.values.theme) setTheme(data.values.theme);
          if (data.values.primaryColor) setPrimaryColor(data.values.primaryColor);
          if (data.values.backgroundStyle) setBackgroundStyle(data.values.backgroundStyle);
          if (data.values.logoUrl !== undefined) setLogoUrl(data.values.logoUrl);
        }
        setBrandMessage({ type: 'success', text: `Applied: ${data.applied.join(', ')}` });
        onBrandApplied?.();
      } else {
        setBrandMessage({ type: 'error', text: 'No brand kit found for your account' });
      }
    } catch {
      setBrandMessage({ type: 'error', text: 'Failed to apply brand kit' });
    } finally {
      setApplyingBrand(false);
      setTimeout(() => setBrandMessage(null), 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Theme Mode */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">
          <div className="flex items-center gap-2 mb-2">
            <Palette className="h-4 w-4" />
            Theme Mode
          </div>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`flex items-center justify-center gap-2 rounded-lg border p-4 transition-all ${
              theme === 'dark'
                ? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-background'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <Moon className="h-5 w-5" />
            <span className="font-medium">Dark</span>
          </button>
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`flex items-center justify-center gap-2 rounded-lg border p-4 transition-all ${
              theme === 'light'
                ? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-background'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <Sun className="h-5 w-5" />
            <span className="font-medium">Light</span>
          </button>
        </div>
      </div>

      {/* Primary Color */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">
          Primary Color
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => setPrimaryColor(color.value)}
              className={`w-10 h-10 rounded-lg transition-all ${
                primaryColor === color.value
                  ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110'
                  : 'hover:scale-105'
              }`}
              style={{ backgroundColor: color.value }}
              title={color.name}
            />
          ))}
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-muted-foreground">Custom:</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border-0"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              placeholder="#8b5cf6"
              className="w-24 rounded-lg border bg-background px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>
      </div>

      {/* Background Style */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">
          Background Style
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(['solid', 'gradient', 'pattern'] as const).map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => setBackgroundStyle(style)}
              className={`rounded-lg border p-3 transition-all ${
                backgroundStyle === style
                  ? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-background'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div
                className={`h-12 rounded mb-2 ${
                  style === 'solid'
                    ? theme === 'dark' ? 'bg-zinc-900' : 'bg-zinc-100'
                    : style === 'gradient'
                    ? theme === 'dark'
                      ? 'bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900'
                      : 'bg-gradient-to-br from-zinc-100 via-white to-zinc-100'
                    : theme === 'dark'
                    ? 'bg-zinc-900 bg-[radial-gradient(circle_at_center,_rgba(139,92,246,0.1)_0%,_transparent_50%)]'
                    : 'bg-zinc-100 bg-[radial-gradient(circle_at_center,_rgba(139,92,246,0.1)_0%,_transparent_50%)]'
                }`}
              />
              <span className="text-sm font-medium capitalize">{style}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Logo URL */}
      <div className="space-y-3">
        <label className="block text-sm font-medium">
          Logo URL (Optional)
        </label>

        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="url"
              value={logoUrl || ''}
              onChange={(e) => setLogoUrl(e.target.value || null)}
              placeholder="https://example.com/logo.png"
              className="w-full rounded-lg border bg-background pl-10 pr-4 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
            />
          </div>
          {logoUrl && (
            <button
              type="button"
              onClick={() => setLogoUrl(null)}
              className="rounded-lg p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {logoUrl && (
          <div className="mt-2">
            <img
              src={logoUrl}
              alt="Logo preview"
              className="h-12 w-auto rounded border"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Enter a URL to an image hosted online (e.g., from Imgur, Google Drive, or your website)
        </p>
      </div>

      {/* Re-apply brand kit */}
      {funnelId && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium">Brand Kit</label>
            <button
              type="button"
              onClick={handleReapplyBrandKit}
              disabled={applyingBrand}
              className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
            >
              {applyingBrand ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Re-apply brand kit
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Overwrite this funnel&apos;s theme, colors, fonts, and logo with your current brand kit settings.
          </p>
          {brandMessage && (
            <p className={`text-xs ${brandMessage.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {brandMessage.text}
            </p>
          )}
        </div>
      )}

      {/* Preview hint */}
      <div className="rounded-lg bg-muted/50 p-4">
        <p className="text-sm text-muted-foreground">
          Changes will be reflected in the preview panel. Your theme settings will be saved when you click &quot;Save Changes&quot;.
        </p>
      </div>
    </div>
  );
}
