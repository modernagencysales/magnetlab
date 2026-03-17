// ─── Chart Components ────────────────────────────────────────────────────────
// Separate entry point to avoid loading recharts (class-based PureComponent)
// in React Server Components. Import via:
//
//   import { ChartContainer, ChartTooltip, ... } from '@magnetlab/magnetui/charts';
// ─────────────────────────────────────────────────────────────────────────────

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  useChart,
} from './components/chart';
export type { ChartConfig } from './components/chart';
