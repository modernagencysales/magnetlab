/** LogoBarEditor. Config editor for logo_bar sections. */
'use client';

import type { LogoBarConfig } from '@/lib/types/funnel';

interface LogoBarEditorProps {
  config: LogoBarConfig;
  onChange: (c: Record<string, unknown>) => void;
}

export function LogoBarEditor({ config, onChange }: LogoBarEditorProps) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">Logos (one per line: name | imageUrl)</label>
      <textarea
        value={(config.logos || []).map((l) => `${l.name}|${l.imageUrl}`).join('\n')}
        onChange={(e) => {
          const logos = e.target.value
            .split('\n')
            .filter(Boolean)
            .map((line) => {
              const [name, imageUrl] = line.split('|').map((s) => s.trim());
              return { name: name || '', imageUrl: imageUrl || '' };
            });
          onChange({ ...config, logos });
        }}
        rows={4}
        className="w-full rounded border bg-background px-2 py-1 text-sm font-mono resize-none"
        placeholder="Company Name | https://logo-url.com/logo.svg"
      />
    </div>
  );
}
