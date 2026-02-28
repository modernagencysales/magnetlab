'use client';

import { Monitor, Tablet, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DeviceMode } from './LinkedInPreview';

interface DeviceToggleProps {
  device: DeviceMode;
  onChange: (device: DeviceMode) => void;
}

const DEVICES: { mode: DeviceMode; icon: typeof Monitor; label: string }[] = [
  { mode: 'desktop', icon: Monitor, label: 'Desktop' },
  { mode: 'tablet', icon: Tablet, label: 'Tablet' },
  { mode: 'mobile', icon: Smartphone, label: 'Mobile' },
];

export function DeviceToggle({ device, onChange }: DeviceToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-muted p-0.5">
      {DEVICES.map(({ mode, icon: Icon, label }) => {
        const isActive = device === mode;
        return (
          <button
            key={mode}
            type="button"
            title={label}
            onClick={() => onChange(mode)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {isActive && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
