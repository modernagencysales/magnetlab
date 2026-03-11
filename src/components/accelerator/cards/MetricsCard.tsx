'use client';

/** Metrics Card. Displays a grid of performance metrics with trend indicators.
 *  Never imports server-only modules or NextResponse. */

// ─── Types ─────────────────────────────────────────────────────────────────

interface Metric {
  label: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
}

interface MetricsCardProps {
  data: { metrics?: Metric[]; title?: string } | undefined;
}

// ─── SVG Trend Arrows ──────────────────────────────────────────────────────

function TrendArrow({ trend }: { trend: 'up' | 'down' | 'neutral' }) {
  if (trend === 'up') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" className="text-green-500">
        <path
          d="M6 10V3M6 3L3 6M6 3l3 3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (trend === 'down') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" className="text-red-500">
        <path
          d="M6 2v7M6 9L3 6M6 9l3-3"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" className="text-muted-foreground">
      <path
        d="M2 6h8M10 6L7 3M10 6L7 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrendIndicator({ trend, change }: { trend?: Metric['trend']; change?: string }) {
  if (!trend && !change) return null;

  const color =
    trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground';

  return (
    <span className={`flex items-center gap-0.5 text-xs font-medium ${color}`}>
      {trend && <TrendArrow trend={trend} />}
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
        {data?.title || 'Metrics'}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {metrics.map((metric, i) => (
          <div key={i} className="flex flex-col gap-0.5 rounded-md bg-muted/40 px-3 py-2">
            <span className="text-xs text-muted-foreground">{metric.label}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold leading-tight">{metric.value}</span>
              <TrendIndicator trend={metric.trend} change={metric.change} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
