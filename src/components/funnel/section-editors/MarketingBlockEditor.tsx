/** MarketingBlockEditor. Config editor for marketing_block sections. */
'use client';

import type { MarketingBlockConfig } from '@/lib/types/funnel';
import { FieldInput } from './FieldInput';

interface MarketingBlockEditorProps {
  config: MarketingBlockConfig;
  onChange: (c: Record<string, unknown>) => void;
}

export function MarketingBlockEditor({ config, onChange }: MarketingBlockEditorProps) {
  return (
    <>
      <div>
        <label className="text-xs text-muted-foreground">Block Type</label>
        <select
          value={config.blockType}
          onChange={(e) => onChange({ ...config, blockType: e.target.value })}
          className="w-full rounded border bg-background px-2 py-1 text-sm"
        >
          {['testimonial', 'case_study', 'feature', 'benefit', 'faq', 'pricing', 'cta'].map((t) => (
            <option key={t} value={t}>
              {t.replace('_', ' ')}
            </option>
          ))}
        </select>
      </div>
      <FieldInput
        label="Title"
        value={config.title || ''}
        onChange={(v) => onChange({ ...config, title: v })}
      />
      <FieldInput
        label="Content"
        value={config.content || ''}
        onChange={(v) => onChange({ ...config, content: v })}
        multiline
      />
      {config.blockType === 'cta' && (
        <>
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
        </>
      )}
    </>
  );
}
