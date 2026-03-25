/** Style Rules Repository. CRUD for cp_style_rules table. */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ─── Column Constants ──────────────────────────────────────────────────────

const STYLE_RULE_COLUMNS =
  'id, scope, team_id, pattern_name, rule_text, source_edit_ids, frequency, confidence, status, proposed_at, reviewed_at, reviewed_by, updated_at, created_at';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface StyleRuleRow {
  id: string;
  scope: 'global' | 'team';
  team_id: string | null;
  pattern_name: string;
  rule_text: string;
  source_edit_ids: string[];
  frequency: number;
  confidence: number;
  status: 'proposed' | 'approved' | 'rejected';
  proposed_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface StyleRuleInsertInput {
  scope?: 'global' | 'team';
  team_id?: string | null;
  pattern_name: string;
  rule_text: string;
  source_edit_ids?: string[];
  frequency?: number;
  confidence?: number;
}

// ─── Reads ─────────────────────────────────────────────────────────────────

export async function listRules(filters?: {
  status?: string;
  scope?: string;
}): Promise<StyleRuleRow[]> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('cp_style_rules')
    .select(STYLE_RULE_COLUMNS)
    .order('frequency', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters?.status && filters.status !== 'all') {
    query = query.eq('status', filters.status);
  }
  if (filters?.scope) {
    query = query.eq('scope', filters.scope);
  }

  const { data, error } = await query;
  if (error) throw new Error(`style-rules.listRules: ${error.message}`);
  return (data ?? []) as StyleRuleRow[];
}

export async function getRuleById(id: string): Promise<StyleRuleRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_style_rules')
    .select(STYLE_RULE_COLUMNS)
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data as StyleRuleRow;
}

export async function getExistingPatternNames(): Promise<string[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('cp_style_rules').select('pattern_name');
  if (error) throw new Error(`style-rules.getExistingPatternNames: ${error.message}`);
  return (data ?? []).map((r) => r.pattern_name);
}

export async function getApprovedGlobalRules(): Promise<StyleRuleRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_style_rules')
    .select(STYLE_RULE_COLUMNS)
    .eq('scope', 'global')
    .eq('status', 'approved')
    .order('frequency', { ascending: false });
  if (error) throw new Error(`style-rules.getApprovedGlobalRules: ${error.message}`);
  return (data ?? []) as StyleRuleRow[];
}

// ─── Writes ────────────────────────────────────────────────────────────────

export async function insertRule(input: StyleRuleInsertInput): Promise<StyleRuleRow> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('cp_style_rules')
    .insert({
      scope: input.scope ?? 'global',
      team_id: input.team_id ?? null,
      pattern_name: input.pattern_name,
      rule_text: input.rule_text,
      source_edit_ids: input.source_edit_ids ?? [],
      frequency: input.frequency ?? 1,
      confidence: input.confidence ?? 0,
    })
    .select(STYLE_RULE_COLUMNS)
    .single();
  if (error) throw new Error(`style-rules.insertRule: ${error.message}`);
  return data as StyleRuleRow;
}

export async function insertRulesBatch(inputs: StyleRuleInsertInput[]): Promise<number> {
  if (inputs.length === 0) return 0;
  const supabase = createSupabaseAdminClient();
  const rows = inputs.map((input) => ({
    scope: input.scope ?? 'global',
    team_id: input.team_id ?? null,
    pattern_name: input.pattern_name,
    rule_text: input.rule_text,
    source_edit_ids: input.source_edit_ids ?? [],
    frequency: input.frequency ?? 1,
    confidence: input.confidence ?? 0,
  }));
  const { error } = await supabase.from('cp_style_rules').insert(rows);
  if (error) throw new Error(`style-rules.insertRulesBatch: ${error.message}`);
  return rows.length;
}

const ALLOWED_UPDATE_FIELDS = ['status', 'rule_text', 'reviewed_at', 'reviewed_by'] as const;

export async function updateRule(
  id: string,
  updates: {
    status?: 'proposed' | 'approved' | 'rejected';
    rule_text?: string;
    reviewed_at?: string;
    reviewed_by?: string;
  }
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const safeUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const field of ALLOWED_UPDATE_FIELDS) {
    if (updates[field] !== undefined) safeUpdates[field] = updates[field];
  }
  const { error } = await supabase.from('cp_style_rules').update(safeUpdates).eq('id', id);
  if (error) throw new Error(`style-rules.updateRule: ${error.message}`);
}
