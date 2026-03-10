/** SectionBridgeEditor. Config editor for section_bridge sections. */
'use client';

import type { SectionBridgeConfig } from '@/lib/types/funnel';
import { FieldInput } from './FieldInput';

interface SectionBridgeEditorProps {
  config: SectionBridgeConfig;
  onChange: (c: Record<string, unknown>) => void;
}

export function SectionBridgeEditor({ config, onChange }: SectionBridgeEditorProps) {
  return (
    <>
      <FieldInput
        label="Text"
        value={config.text}
        onChange={(v) => onChange({ ...config, text: v })}
      />
      <div>
        <label className="text-xs text-muted-foreground">Variant</label>
        <select
          value={config.variant || 'default'}
          onChange={(e) => onChange({ ...config, variant: e.target.value })}
          className="w-full rounded border bg-background px-2 py-1 text-sm"
        >
          <option value="default">Default</option>
          <option value="accent">Accent</option>
          <option value="gradient">Gradient</option>
        </select>
      </div>
      <FieldInput
        label="Step Label"
        value={config.stepLabel || ''}
        onChange={(v) => onChange({ ...config, stepLabel: v })}
        placeholder="Step 2"
      />
    </>
  );
}
