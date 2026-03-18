'use client';

/**
 * ActionDelaysSection. Min/max delay inputs for account safety (seconds).
 * Converts to/from milliseconds for the API.
 * Constraint: never imports route-layer modules.
 */

import { Input, Label } from '@magnetlab/magnetui';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ActionDelaysValue {
  min_delay_ms: number;
  max_delay_ms: number;
}

interface ActionDelaysSectionProps {
  value: ActionDelaysValue;
  onChange: (value: ActionDelaysValue) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function msToSeconds(ms: number): number {
  return Math.round(ms / 1000);
}

function secondsToMs(s: number): number {
  return s * 1000;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function ActionDelaysSection({ value, onChange }: ActionDelaysSectionProps) {
  const minSeconds = msToSeconds(value.min_delay_ms);
  const maxSeconds = msToSeconds(value.max_delay_ms);

  function handleMinChange(raw: string) {
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed)) return;
    const clamped = Math.max(1, Math.min(300, parsed));
    onChange({
      ...value,
      min_delay_ms: secondsToMs(clamped),
      max_delay_ms: Math.max(value.max_delay_ms, secondsToMs(clamped)),
    });
  }

  function handleMaxChange(raw: string) {
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed)) return;
    const clamped = Math.max(1, Math.min(600, parsed));
    onChange({
      ...value,
      max_delay_ms: secondsToMs(clamped),
      min_delay_ms: Math.min(value.min_delay_ms, secondsToMs(clamped)),
    });
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="min-delay" className="text-xs">
          Min Delay (seconds)
        </Label>
        <Input
          id="min-delay"
          type="number"
          min={1}
          max={300}
          value={minSeconds}
          onChange={(e) => handleMinChange(e.target.value)}
        />
        <p className="text-[10px] text-muted-foreground">1--300 seconds</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="max-delay" className="text-xs">
          Max Delay (seconds)
        </Label>
        <Input
          id="max-delay"
          type="number"
          min={1}
          max={600}
          value={maxSeconds}
          onChange={(e) => handleMaxChange(e.target.value)}
        />
        <p className="text-[10px] text-muted-foreground">1--600 seconds</p>
      </div>
    </div>
  );
}
