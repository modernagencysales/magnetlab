/** TestimonialEditor. Config editor for testimonial sections. */
'use client';

import type { TestimonialConfig } from '@/lib/types/funnel';
import { FieldInput } from './FieldInput';

interface TestimonialEditorProps {
  config: TestimonialConfig;
  onChange: (c: Record<string, unknown>) => void;
}

export function TestimonialEditor({ config, onChange }: TestimonialEditorProps) {
  return (
    <>
      <FieldInput
        label="Quote"
        value={config.quote}
        onChange={(v) => onChange({ ...config, quote: v })}
        multiline
      />
      <FieldInput
        label="Author"
        value={config.author || ''}
        onChange={(v) => onChange({ ...config, author: v })}
      />
      <FieldInput
        label="Role"
        value={config.role || ''}
        onChange={(v) => onChange({ ...config, role: v })}
        placeholder="CEO at Company"
      />
      <FieldInput
        label="Result"
        value={config.result || ''}
        onChange={(v) => onChange({ ...config, result: v })}
        placeholder="2x revenue in 3 months"
      />
    </>
  );
}
