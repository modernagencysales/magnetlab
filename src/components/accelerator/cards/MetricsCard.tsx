'use client';

/** Metrics Card. Displays a grid of performance metrics with optional trend indicators. Never imports server-only modules or NextResponse. */

// ─── Types ─────────────────────────────────────────────────────────────────

interface Metric {
  label: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
}

interface MetricsCardProps {
  data: { metrics?: Metric[] } | undefined;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function TrendIndicator({ trend, change }: { trend?: Metric['trend']; change?: string }) {
  if (!trend && !change) return null;

  const color =
    trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground';

  const arrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';

  return (
    <span className={`text-xs font-medium ${color}`}>
      {trend ? `${arrow} ` : ''}
      {change}
    </span>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function MetricsCard({ data }: MetricsCardProps) {
  const metrics = data?.metrics ?? [];

  if (metrics.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card p-3 text-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Metrics
      </p>
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((metric, i) => (
          <div key={i} className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-2.5 py-2">
            <span className="text-xs text-muted-foreground">{metric.label}</span>
            <span className="text-base font-semibold leading-tight">{metric.value}</span>
            <TrendIndicator trend={metric.trend} change={metric.change} />
          </div>
        ))}
      </div>
    </div>
  );
}
