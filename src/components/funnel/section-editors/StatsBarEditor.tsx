/** StatsBarEditor. Config editor for stats_bar sections. 3-4 stat items. */
'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { StatsBarConfig } from '@/lib/types/funnel';
import { FieldInput } from './FieldInput';

// ─── Constants ─────────────────────────────────────────
const MIN_ITEMS = 3;
const MAX_ITEMS = 4;
const MAX_VALUE_LENGTH = 10;

interface StatsBarEditorProps {
  config: StatsBarConfig;
  onChange: (c: Record<string, unknown>) => void;
}

export function StatsBarEditor({ config, onChange }: StatsBarEditorProps) {
  const items = config.items || [];

  const updateItem = (idx: number, field: 'value' | 'label', val: string) => {
    const newItems = items.map((item, i) => (i === idx ? { ...item, [field]: val } : item));
    onChange({ ...config, items: newItems });
  };

  const addItem = () => {
    if (items.length >= MAX_ITEMS) return;
    onChange({ ...config, items: [...items, { value: '0', label: 'Label' }] });
  };

  const removeItem = (idx: number) => {
    if (items.length <= MIN_ITEMS) return;
    onChange({ ...config, items: items.filter((_, i) => i !== idx) });
  };

  return (
    <>
      {items.map((item, i) => (
        <div key={i} className="rounded border p-2 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Stat {i + 1}</span>
            {items.length > MIN_ITEMS && (
              <button
                onClick={() => removeItem(i)}
                className="p-0.5 text-muted-foreground hover:text-red-500 transition-colors"
                title="Remove stat"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
          <FieldInput
            label="Value"
            value={item.value}
            onChange={(v) => updateItem(i, 'value', v)}
            placeholder="100+"
            maxLength={MAX_VALUE_LENGTH}
          />
          <FieldInput
            label="Label"
            value={item.label}
            onChange={(v) => updateItem(i, 'label', v)}
            placeholder="Clients Served"
          />
        </div>
      ))}
      {items.length < MAX_ITEMS && (
        <button
          onClick={addItem}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add Stat
        </button>
      )}
    </>
  );
}
