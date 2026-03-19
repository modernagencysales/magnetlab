/** Mixer types. Defines inputs/outputs for the ingredient mixer. Never imports from React or Next.js. */

// ─── Ingredient primitives ─────────────────────────────────────────────────────

export type IngredientType =
  | 'knowledge'
  | 'exploits'
  | 'styles'
  | 'templates'
  | 'creatives'
  | 'trends'
  | 'recycled';

export type HealthStatus = 'healthy' | 'active' | 'new' | null;

// ─── Mixer input / output ──────────────────────────────────────────────────────

export interface MixerInput {
  team_profile_id: string;
  exploit_id?: string;
  knowledge_topic?: string;
  knowledge_query?: string;
  style_id?: string;
  template_id?: string;
  creative_id?: string;
  trend_topic?: string;
  recycled_post_id?: string;
  idea_id?: string;
  hook?: string;
  instructions?: string;
  count?: number;
  output?: 'drafts' | 'ideas';
}

export interface MixerDraft {
  content: string;
  hook_used: string;
  ai_pick: boolean;
  recipe_id: string;
}

export interface MixerIdea {
  title: string;
  hook: string;
  angle: string;
  relevance_score: number;
  recipe_id: string;
}

export type MixerResult =
  | { type: 'drafts'; drafts: MixerDraft[]; recipe_id: string }
  | { type: 'ideas'; ideas: MixerIdea[]; recipe_id: string };

// ─── Ingredient inventory ──────────────────────────────────────────────────────

export interface IngredientCount {
  type: IngredientType;
  count: number;
  health: HealthStatus;
  health_detail: string | null;
  sub_label: string | null;
}

export interface IngredientInventory {
  team_profile_id: string;
  ingredients: IngredientCount[];
}

// ─── Recipe suggestions ────────────────────────────────────────────────────────

export interface RecipeSuggestion {
  ingredients: Array<{ type: IngredientType; id?: string; name: string }>;
  combo_name: string;
  multiplier: number;
  post_count: number;
  context: string;
}

// ─── Combo performance ─────────────────────────────────────────────────────────

export interface ComboPerformance {
  exploit_name: string | null;
  knowledge_topic: string | null;
  style_name: string | null;
  template_name: string | null;
  avg_engagement: number;
  multiplier: number;
  post_count: number;
  last_used: string;
}

// ─── DB row types ──────────────────────────────────────────────────────────────

export interface MixRecipe {
  id: string;
  team_profile_id: string;
  exploit_id: string | null;
  knowledge_topic: string | null;
  knowledge_query: string | null;
  style_id: string | null;
  template_id: string | null;
  creative_id: string | null;
  trend_topic: string | null;
  recycled_post_id: string | null;
  instructions: string | null;
  output_type: 'drafts' | 'ideas';
  post_ids: string[];
  created_at: string;
  updated_at: string;
}
