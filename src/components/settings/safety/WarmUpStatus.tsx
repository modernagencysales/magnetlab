'use client';

/**
 * WarmUpStatus. Read-only display of warm-up phase and circuit breaker state.
 * Constraint: never imports route-layer modules.
 */

import { Badge } from '@magnetlab/magnetui';

// ─── Types ─────────────────────────────────────────────────────────────────

interface CircuitBreakerState {
  active: boolean;
  active_until: string | null;
}

interface WarmUpStatusProps {
  connectedAt: string | null;
  circuitBreaker: CircuitBreakerState | null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getWarmUpPhase(connectedAt: string | null): {
  label: string;
  variant: 'default' | 'gray' | 'outline';
} {
  if (!connectedAt) {
    return { label: 'Unknown', variant: 'outline' };
  }

  const connected = new Date(connectedAt);
  const now = new Date();
  const daysSinceConnected = Math.floor(
    (now.getTime() - connected.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceConnected < 7) {
    return { label: 'Week 1 (50% limits)', variant: 'gray' };
  }
  if (daysSinceConnected < 14) {
    return { label: 'Week 2 (75% limits)', variant: 'gray' };
  }
  return { label: 'Fully ramped', variant: 'default' };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ─── Component ─────────────────────────────────────────────────────────────

export function WarmUpStatus({ connectedAt, circuitBreaker }: WarmUpStatusProps) {
  const warmUp = getWarmUpPhase(connectedAt);
  const breakerActive = circuitBreaker?.active ?? false;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="rounded-lg border border-border p-3">
        <p className="text-xs text-muted-foreground mb-1.5">Warm-up Status</p>
        <Badge variant={warmUp.variant}>{warmUp.label}</Badge>
        {connectedAt && (
          <p className="text-[10px] text-muted-foreground mt-1.5">
            Connected {formatDate(connectedAt)}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border p-3">
        <p className="text-xs text-muted-foreground mb-1.5">Circuit Breaker</p>
        {breakerActive ? (
          <>
            <Badge variant="red">
              Active until {circuitBreaker?.active_until ? formatDate(circuitBreaker.active_until) : 'unknown'}
            </Badge>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              All actions paused due to rate limit detection.
            </p>
          </>
        ) : (
          <Badge variant="outline">Inactive</Badge>
        )}
      </div>
    </div>
  );
}
