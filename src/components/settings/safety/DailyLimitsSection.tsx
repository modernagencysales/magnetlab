'use client';

/**
 * DailyLimitsSection. Grid of number inputs for per-action daily limits.
 * Constraint: never imports route-layer modules.
 */

import { Input, Label } from '@magnetlab/magnetui';

// ─── Types ─────────────────────────────────────────────────────────────────

interface DailyLimitsValue {
  dms: number;
  connection_requests: number;
  connection_accepts: number;
  comments: number;
  likes: number;
}

interface DailyLimitsSectionProps {
  value: DailyLimitsValue;
  onChange: (value: DailyLimitsValue) => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const LIMIT_FIELDS: {
  key: keyof DailyLimitsValue;
  label: string;
  min: number;
  max: number;
  defaultValue: number;
}[] = [
  { key: 'dms', label: 'DMs per day', min: 1, max: 100, defaultValue: 50 },
  { key: 'connection_requests', label: 'Connection Requests per day', min: 1, max: 50, defaultValue: 10 },
  { key: 'connection_accepts', label: 'Connection Accepts per day', min: 1, max: 200, defaultValue: 80 },
  { key: 'comments', label: 'Comments per day', min: 1, max: 100, defaultValue: 30 },
  { key: 'likes', label: 'Likes per day', min: 1, max: 200, defaultValue: 60 },
];

// ─── Component ─────────────────────────────────────────────────────────────

export function DailyLimitsSection({ value, onChange }: DailyLimitsSectionProps) {
  function handleChange(key: keyof DailyLimitsValue, raw: string) {
    const field = LIMIT_FIELDS.find((f) => f.key === key);
    if (!field) return;

    const parsed = parseInt(raw, 10);
    if (isNaN(parsed)) return;

    const clamped = Math.max(field.min, Math.min(field.max, parsed));
    onChange({ ...value, [key]: clamped });
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {LIMIT_FIELDS.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <Label htmlFor={`limit-${field.key}`} className="text-xs">
            {field.label}
          </Label>
          <Input
            id={`limit-${field.key}`}
            type="number"
            min={field.min}
            max={field.max}
            value={value[field.key]}
            onChange={(e) => handleChange(field.key, e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground">
            {field.min}--{field.max} range
          </p>
        </div>
      ))}
    </div>
  );
}
