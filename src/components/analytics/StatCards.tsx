'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Eye, Users, Target, Award } from 'lucide-react';

interface StatCardsProps {
  totals: {
    views: number;
    leads: number;
    qualified: number;
    conversionRate: number;
    qualificationRate: number;
  };
}

const stats = [
  {
    key: 'views' as const,
    label: 'Total Views',
    icon: Eye,
    format: (v: number) => v.toLocaleString(),
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
  },
  {
    key: 'leads' as const,
    label: 'Total Leads',
    icon: Users,
    format: (v: number) => v.toLocaleString(),
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
  },
  {
    key: 'conversionRate' as const,
    label: 'Conversion Rate',
    icon: Target,
    format: (v: number) => `${v}%`,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-100 dark:bg-purple-900/30',
  },
  {
    key: 'qualificationRate' as const,
    label: 'Qualification Rate',
    icon: Award,
    format: (v: number) => `${v}%`,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-100 dark:bg-orange-900/30',
  },
] as const;

export function StatCards({ totals }: StatCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const value = totals[stat.key];
        return (
          <Card key={stat.key}>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2 ${stat.bg}`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold">{stat.format(value)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
