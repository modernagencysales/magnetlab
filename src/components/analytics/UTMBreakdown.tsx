'use client';

import { useMemo } from 'react';
import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Globe } from 'lucide-react';

interface UTMBreakdownProps {
  data: Array<{ source: string; count: number }>;
}

export function UTMBreakdown({ data }: UTMBreakdownProps) {
  const chartConfig = useMemo<ChartConfig>(
    () => ({
      count: {
        label: 'Leads',
        color: 'hsl(262, 83%, 58%)',
      },
    }),
    []
  );

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Globe className="h-10 w-10 text-muted-foreground/50" />
        <p className="mt-3 text-sm font-medium text-muted-foreground">
          No UTM data yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Add UTM parameters to your funnel links to track traffic sources.
        </p>
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
      >
        <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis
          dataKey="source"
          type="category"
          tickLine={false}
          axisLine={false}
          width={120}
          tickMargin={8}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar
          dataKey="count"
          fill="var(--color-count)"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}
