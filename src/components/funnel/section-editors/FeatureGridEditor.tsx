/** FeatureGridEditor. Config editor for feature_grid sections. 3-6 features. */
'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { FeatureGridConfig } from '@/lib/types/funnel';
import { FieldInput } from './FieldInput';

// ─── Constants ─────────────────────────────────────────
const MIN_FEATURES = 3;
const MAX_FEATURES = 6;

interface FeatureGridEditorProps {
  config: FeatureGridConfig;
  onChange: (c: Record<string, unknown>) => void;
}

export function FeatureGridEditor({ config, onChange }: FeatureGridEditorProps) {
  const features = config.features || [];

  const updateFeature = (idx: number, field: string, val: string) => {
    const newFeatures = features.map((f, i) => (i === idx ? { ...f, [field]: val } : f));
    onChange({ ...config, features: newFeatures });
  };

  const addFeature = () => {
    if (features.length >= MAX_FEATURES) return;
    onChange({
      ...config,
      features: [...features, { icon: 'star', title: 'Feature', description: 'Description' }],
    });
  };

  const removeFeature = (idx: number) => {
    if (features.length <= MIN_FEATURES) return;
    onChange({ ...config, features: features.filter((_, i) => i !== idx) });
  };

  return (
    <>
      {features.map((feature, i) => (
        <div key={i} className="rounded border p-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Feature {i + 1}</span>
            {features.length > MIN_FEATURES && (
              <button
                onClick={() => removeFeature(i)}
                className="p-0.5 text-muted-foreground hover:text-red-500 transition-colors"
                title="Remove feature"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
          <FieldInput
            label="Icon"
            value={feature.icon}
            onChange={(v) => updateFeature(i, 'icon', v)}
            placeholder="star, shield, zap..."
          />
          <FieldInput
            label="Title"
            value={feature.title}
            onChange={(v) => updateFeature(i, 'title', v)}
            placeholder="Feature Title"
          />
          <FieldInput
            label="Description"
            value={feature.description}
            onChange={(v) => updateFeature(i, 'description', v)}
            multiline
            placeholder="Describe this feature..."
          />
        </div>
      ))}
      {features.length < MAX_FEATURES && (
        <button
          onClick={addFeature}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add Feature
        </button>
      )}
    </>
  );
}
