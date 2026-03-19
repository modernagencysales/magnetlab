/**
 * ingredientMeta. Shared metadata for ingredient types — icons, labels, colors.
 * Pure data — no React, no imports from Next.js layer.
 */

import { Brain, Target, Pen, LayoutTemplate, Lightbulb, TrendingUp, RefreshCw } from 'lucide-react';
import type { IngredientType } from '@/lib/types/mixer';
import type { LucideIcon } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IngredientMeta {
  label: string;
  lucideIcon: LucideIcon;
  /** Tailwind classes applied to the selected tile border + text (design-token-safe) */
  selectedClasses: string;
  /** Tailwind classes for health/badge coloring */
  accentClass: string;
}

// ─── Metadata map ─────────────────────────────────────────────────────────────

export const INGREDIENT_META: Record<IngredientType, IngredientMeta> = {
  knowledge: {
    label: 'Knowledge',
    lucideIcon: Brain,
    selectedClasses: 'border-violet-500 text-violet-500 bg-violet-500/5',
    accentClass: 'text-violet-500',
  },
  exploits: {
    label: 'Exploit',
    lucideIcon: Target,
    selectedClasses: 'border-orange-500 text-orange-500 bg-orange-500/5',
    accentClass: 'text-orange-500',
  },
  styles: {
    label: 'Style',
    lucideIcon: Pen,
    selectedClasses: 'border-blue-500 text-blue-500 bg-blue-500/5',
    accentClass: 'text-blue-500',
  },
  templates: {
    label: 'Template',
    lucideIcon: LayoutTemplate,
    selectedClasses: 'border-teal-500 text-teal-500 bg-teal-500/5',
    accentClass: 'text-teal-500',
  },
  creatives: {
    label: 'Creative',
    lucideIcon: Lightbulb,
    selectedClasses: 'border-yellow-500 text-yellow-500 bg-yellow-500/5',
    accentClass: 'text-yellow-500',
  },
  trends: {
    label: 'Trend',
    lucideIcon: TrendingUp,
    selectedClasses: 'border-pink-500 text-pink-500 bg-pink-500/5',
    accentClass: 'text-pink-500',
  },
  recycled: {
    label: 'Recycled',
    lucideIcon: RefreshCw,
    selectedClasses: 'border-emerald-500 text-emerald-500 bg-emerald-500/5',
    accentClass: 'text-emerald-500',
  },
};

export const INGREDIENT_TYPE_ORDER: IngredientType[] = [
  'exploits',
  'knowledge',
  'styles',
  'templates',
  'creatives',
  'trends',
  'recycled',
];
