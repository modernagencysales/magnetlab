export const VALID_RANGES = ['7d', '30d', '90d'] as const;
export type Range = (typeof VALID_RANGES)[number];

export function parseDays(range: Range): number {
  return parseInt(range.replace('d', ''), 10);
}

export function buildDateRange(days: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}
