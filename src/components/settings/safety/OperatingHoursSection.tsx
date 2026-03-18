'use client';

/**
 * OperatingHoursSection. Time window and timezone inputs for account safety.
 * Constraint: never imports route-layer modules.
 */

import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@magnetlab/magnetui';

// ─── Constants ─────────────────────────────────────────────────────────────

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (New York)' },
  { value: 'America/Chicago', label: 'Central (Chicago)' },
  { value: 'America/Denver', label: 'Mountain (Denver)' },
  { value: 'America/Los_Angeles', label: 'Pacific (Los Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska (Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (Honolulu)' },
  { value: 'Europe/London', label: 'GMT (London)' },
  { value: 'Europe/Berlin', label: 'CET (Berlin)' },
  { value: 'Europe/Paris', label: 'CET (Paris)' },
  { value: 'Asia/Dubai', label: 'Gulf (Dubai)' },
  { value: 'Asia/Kolkata', label: 'IST (Mumbai)' },
  { value: 'Asia/Singapore', label: 'SGT (Singapore)' },
  { value: 'Asia/Tokyo', label: 'JST (Tokyo)' },
  { value: 'Australia/Sydney', label: 'AEST (Sydney)' },
] as const;

// ─── Types ─────────────────────────────────────────────────────────────────

interface OperatingHoursValue {
  start: string;
  end: string;
  timezone: string;
}

interface OperatingHoursSectionProps {
  value: OperatingHoursValue;
  onChange: (value: OperatingHoursValue) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function OperatingHoursSection({ value, onChange }: OperatingHoursSectionProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="start-time" className="text-xs">
          Start Time
        </Label>
        <Input
          id="start-time"
          type="time"
          value={value.start}
          onChange={(e) => onChange({ ...value, start: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="end-time" className="text-xs">
          End Time
        </Label>
        <Input
          id="end-time"
          type="time"
          value={value.end}
          onChange={(e) => onChange({ ...value, end: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Timezone</Label>
        <Select value={value.timezone} onValueChange={(tz) => onChange({ ...value, timezone: tz })}>
          <SelectTrigger>
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {tz.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
