/** StepsEditor. Config editor for steps sections. */
'use client';

import type { StepsConfig } from '@/lib/types/funnel';
import { FieldInput } from './FieldInput';

interface StepsEditorProps {
  config: StepsConfig;
  onChange: (c: Record<string, unknown>) => void;
}

export function StepsEditor({ config, onChange }: StepsEditorProps) {
  const steps = config.steps || [];
  const updateStep = (idx: number, field: string, value: string) => {
    const newSteps = steps.map((s, i) => (i === idx ? { ...s, [field]: value } : s));
    onChange({ ...config, steps: newSteps });
  };

  return (
    <>
      <FieldInput
        label="Heading"
        value={config.heading || ''}
        onChange={(v) => onChange({ ...config, heading: v })}
        placeholder="What Happens Next"
      />
      <FieldInput
        label="Subheading"
        value={config.subheading || ''}
        onChange={(v) => onChange({ ...config, subheading: v })}
        placeholder="Optional subheading"
      />
      {steps.map((step, i) => (
        <div key={i} className="rounded border p-2 space-y-1">
          <FieldInput
            label={`Step ${i + 1} Title`}
            value={step.title}
            onChange={(v) => updateStep(i, 'title', v)}
          />
          <FieldInput
            label="Description"
            value={step.description}
            onChange={(v) => updateStep(i, 'description', v)}
          />
        </div>
      ))}
    </>
  );
}
