'use client';

import { useState, useEffect } from 'react';
import type { PillarDistribution, ContentPillar } from '@/lib/types/content-pipeline';
import { CONTENT_PILLAR_LABELS } from '@/lib/types/content-pipeline';

interface PillarDistributionSliderProps {
  value: PillarDistribution;
  onChange: (distribution: PillarDistribution) => void;
  disabled?: boolean;
}

const PILLAR_COLORS: Record<ContentPillar, string> = {
  moments_that_matter: 'bg-blue-500',
  teaching_promotion: 'bg-green-500',
  human_personal: 'bg-amber-500',
  collaboration_social_proof: 'bg-purple-500',
};

const PILLAR_KEYS: ContentPillar[] = [
  'moments_that_matter',
  'teaching_promotion',
  'human_personal',
  'collaboration_social_proof',
];

export function PillarDistributionSlider({ value, onChange, disabled }: PillarDistributionSliderProps) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  const total = PILLAR_KEYS.reduce((sum, k) => sum + local[k], 0);
  const isValid = total === 100;

  const handleChange = (pillar: ContentPillar, newVal: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(newVal / 5) * 5));
    const updated = { ...local, [pillar]: clamped };
    setLocal(updated);

    const newTotal = PILLAR_KEYS.reduce((sum, k) => sum + updated[k], 0);
    if (newTotal === 100) {
      onChange(updated);
    }
  };

  const autoBalance = () => {
    const count = PILLAR_KEYS.length;
    const base = Math.floor(100 / count / 5) * 5; // Round down to nearest 5
    const balanced: PillarDistribution = {
      moments_that_matter: base,
      teaching_promotion: base,
      human_personal: base,
      collaboration_social_proof: base,
    };
    // Distribute remainder in steps of 5 to reach 100
    let remaining = 100 - base * count;
    for (const key of PILLAR_KEYS) {
      if (remaining <= 0) break;
      balanced[key] += 5;
      remaining -= 5;
    }
    setLocal(balanced);
    onChange(balanced);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Pillar Distribution</span>
        <div className="flex items-center gap-2">
          {!isValid && (
            <span className="text-xs text-red-500">Total: {total}% (must be 100%)</span>
          )}
          <button
            onClick={autoBalance}
            disabled={disabled}
            className="text-xs text-primary hover:underline disabled:opacity-50"
          >
            Auto-balance
          </button>
        </div>
      </div>

      {/* Visual bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {PILLAR_KEYS.map((pillar) => (
          <div
            key={pillar}
            className={`${PILLAR_COLORS[pillar]} transition-all duration-200`}
            style={{ width: `${local[pillar]}%` }}
          />
        ))}
      </div>

      {/* Sliders */}
      <div className="space-y-2">
        {PILLAR_KEYS.map((pillar) => (
          <div key={pillar} className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${PILLAR_COLORS[pillar]}`} />
            <span className="w-32 text-xs truncate">{CONTENT_PILLAR_LABELS[pillar]}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={local[pillar]}
              onChange={(e) => handleChange(pillar, parseInt(e.target.value))}
              disabled={disabled}
              className="flex-1"
            />
            <span className="w-10 text-right text-xs font-mono">{local[pillar]}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
