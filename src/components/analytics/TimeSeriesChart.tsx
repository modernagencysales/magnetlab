'use client';

import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

interface TimeSeriesChartProps {
  data: Array<{ date: string; value: number }>;
  label: string;
  color?: string;
  height?: number;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function TimeSeriesChart({
  data,
  label,
  color = 'hsl(221, 83%, 53%)',
}: TimeSeriesChartProps) {
  const chartConfig = useMemo<ChartConfig>(
    () => ({
      value: {
        label,
        color,
      },
    }),
    [label, color]
  );

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        date: d.date,
        dateLabel: formatDateLabel(d.date),
        value: d.value,
      })),
    [data]
  );

  // Determine sensible tick interval based on data length
  const tickInterval = useMemo(() => {
    if (chartData.length <= 7) return 0; // show all
    if (chartData.length <= 14) return 1; // every other
    if (chartData.length <= 30) return 3; // every 4th
    return 6; // every 7th
  }, [chartData.length]);

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
      <AreaChart
        data={chartData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id={`fill-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="dateLabel"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval={tickInterval}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          allowDecimals={false}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_value, payload) => {
                if (payload && payload.length > 0) {
                  const item = payload[0];
                  const dateStr =
                    item?.payload?.date ?? '';
                  return formatDateLabel(dateStr);
                }
                return '';
              }}
            />
          }
        />
        <Area
          dataKey="value"
          type="monotone"
          fill={`url(#fill-${label})`}
          stroke="var(--color-value)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}
