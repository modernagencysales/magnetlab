/** HeroEditor. Config editor for hero sections. */
'use client';

import type { HeroConfig } from '@/lib/types/funnel';
import { FieldInput } from './FieldInput';

interface HeroEditorProps {
  config: HeroConfig;
  onChange: (c: Record<string, unknown>) => void;
}

export function HeroEditor({ config, onChange }: HeroEditorProps) {
  return (
    <>
      <FieldInput
        label="Headline"
        value={config.headline}
        onChange={(v) => onChange({ ...config, headline: v })}
        placeholder="Your Headline Here"
      />
      <FieldInput
        label="Subline"
        value={config.subline || ''}
        onChange={(v) => onChange({ ...config, subline: v })}
        multiline
        placeholder="Supporting text below the headline"
      />
      <FieldInput
        label="CTA Text"
        value={config.ctaText || ''}
        onChange={(v) => onChange({ ...config, ctaText: v })}
        placeholder="Get Started"
      />
      <FieldInput
        label="CTA URL"
        value={config.ctaUrl || ''}
        onChange={(v) => onChange({ ...config, ctaUrl: v })}
        placeholder="https://..."
      />
      <FieldInput
        label="Background Image URL"
        value={config.backgroundImageUrl || ''}
        onChange={(v) => onChange({ ...config, backgroundImageUrl: v })}
        placeholder="https://images.example.com/hero-bg.jpg"
      />
    </>
  );
}
