/** Accelerator types. Program state, module progress, deliverables, SOPs.
 *  Never import NextRequest/NextResponse/cookies here. */

// ─── Module IDs ──────────────────────────────────────────

export const MODULE_IDS = ['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export const MODULE_NAMES: Record<ModuleId, string> = {
  m0: 'Positioning & ICP',
  m1: 'Lead Magnets',
  m2: 'TAM Building',
  m3: 'LinkedIn Outreach',
  m4: 'Cold Email',
  m5: 'LinkedIn Ads',
  m6: 'Operating System',
  m7: 'Daily Content',
};

// Phase 1 modules only
export const PHASE1_MODULES: ModuleId[] = ['m0', 'm1', 'm7'];
export const PHASE2_MODULES: ModuleId[] = ['m2', 'm3', 'm4'];
export const PHASE3_MODULES: ModuleId[] = ['m5', 'm6'];

// ─── Metrics ────────────────────────────────────────────

export type MetricKey =
  | 'email_sent'
  | 'email_open_rate'
  | 'email_reply_rate'
  | 'email_bounce_rate'
  | 'dm_sent'
  | 'dm_acceptance_rate'
  | 'dm_reply_rate'
  | 'tam_size'
  | 'tam_email_coverage'
  | 'content_posts_published'
  | 'content_avg_impressions'
  | 'content_avg_engagement'
  | 'funnel_opt_in_rate'
  | 'funnel_page_views'
  | 'ads_spend'
  | 'ads_cpl'
  | 'ads_ctr'
  | 'ads_roas'
  | 'os_weekly_reviews'
  | 'os_daily_sessions';

export type MetricStatus = 'above' | 'at' | 'below';

export interface ProgramMetric {
  id: string;
  enrollment_id: string;
  module_id: string;
  metric_key: MetricKey;
  value: number;
  benchmark_low: number | null;
  benchmark_high: number | null;
  status: MetricStatus;
  source: string;
  collected_at: string;
}

export const METRIC_COLUMNS =
  'id, enrollment_id, module_id, metric_key, value, benchmark_low, benchmark_high, status, source, collected_at';

// ─── Schedules ──────────────────────────────────────────

export type ScheduleTaskType =
  | 'collect_metrics'
  | 'weekly_digest'
  | 'warmup_check'
  | 'tam_decay_check'
  | 'morning_briefing';

export interface ProgramSchedule {
  id: string;
  enrollment_id: string;
  task_type: ScheduleTaskType;
  cron_expression: string;
  config: Record<string, unknown>;
  is_system: boolean;
  is_active: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
}

export const SCHEDULE_COLUMNS =
  'id, enrollment_id, task_type, cron_expression, config, is_system, is_active, last_run_at, next_run_at';

// ─── Diagnostic Rules ───────────────────────────────────

export interface DiagnosticRule {
  id: string;
  symptom: string;
  module_id: string;
  metric_key: MetricKey | null;
  threshold_operator: '<' | '>' | '<=' | '>=' | '=' | null;
  threshold_value: number | null;
  diagnostic_questions: string[];
  common_causes: Array<{ cause: string; fix: string; severity: 'critical' | 'warning' | 'info' }>;
  priority: number;
}

export const DIAGNOSTIC_RULE_COLUMNS =
  'id, symptom, module_id, metric_key, threshold_operator, threshold_value, diagnostic_questions, common_causes, priority';

// ─── Enrollment ──────────────────────────────────────────

export type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'churned';
export type CoachingMode = 'do_it' | 'guide_me' | 'teach_me';

export interface ProgramEnrollment {
  id: string;
  user_id: string;
  enrolled_at: string;
  selected_modules: ModuleId[];
  coaching_mode: CoachingMode;
  onboarding_completed_at: string | null;
  intake_data: IntakeData | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  status: EnrollmentStatus;
  created_at: string;
  updated_at: string;
}

export interface IntakeData {
  business_description: string;
  target_audience: string;
  revenue_range: 'under_5k' | '5k_10k' | '10k_20k';
  linkedin_frequency: 'never' | 'occasionally' | 'weekly' | 'daily';
  channels_of_interest: string[];
  primary_goal: string;
}

// ─── Module Progress ─────────────────────────────────────

export type ModuleStatus = 'not_started' | 'active' | 'blocked' | 'completed' | 'skipped';

export interface ProgramModule {
  id: string;
  enrollment_id: string;
  module_id: ModuleId;
  status: ModuleStatus;
  current_step: string | null;
  coaching_mode_override: CoachingMode | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Deliverables ────────────────────────────────────────

export type DeliverableStatus =
  | 'not_started'
  | 'in_progress'
  | 'pending_review'
  | 'approved'
  | 'rejected';

export type DeliverableType =
  | 'icp_definition'
  | 'lead_magnet'
  | 'funnel'
  | 'email_sequence'
  | 'tam_list'
  | 'outreach_campaign'
  | 'tam_segment'
  | 'dm_campaign'
  | 'email_campaign'
  | 'email_infrastructure'
  | 'content_plan'
  | 'post_drafts'
  | 'metrics_digest'
  | 'diagnostic_report'
  | 'ad_campaign'
  | 'ad_targeting'
  | 'weekly_ritual'
  | 'operating_playbook';

export interface ProgramDeliverable {
  id: string;
  enrollment_id: string;
  module_id: ModuleId;
  deliverable_type: DeliverableType;
  status: DeliverableStatus;
  entity_id: string | null;
  entity_type: string | null;
  validation_result: ValidationResult | null;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
  feedback: string;
}

export interface ValidationCheck {
  check: string;
  passed: boolean;
  severity: 'critical' | 'warning' | 'info';
  feedback?: string;
}

// ─── SOPs ────────────────────────────────────────────────

export interface QualityBar {
  check: string;
  severity: 'critical' | 'warning' | 'info';
}

export interface SopDeliverable {
  type: DeliverableType;
  description: string;
}

export interface ProgramSop {
  id: string;
  module_id: ModuleId;
  sop_number: string;
  title: string;
  content: string;
  quality_bars: QualityBar[];
  deliverables: SopDeliverable[];
  tools_used: string[];
  dependencies: string[];
  version: number;
  created_at: string;
  updated_at: string;
}

// ─── Usage ───────────────────────────────────────────────

export type UsageEventType =
  | 'session_start'
  | 'deliverable_created'
  | 'api_call'
  | 'scheduled_task_run';

export interface ProgramUsageEvent {
  id: string;
  enrollment_id: string;
  event_type: UsageEventType;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── Program State (composite, returned by get_program_state) ─────

export interface ProgramState {
  enrollment: ProgramEnrollment;
  modules: ProgramModule[];
  deliverables: ProgramDeliverable[];
  reviewQueue: ProgramDeliverable[];
  usageThisPeriod: { sessions: number; deliverables: number; api_calls: number };
}

// ─── Sub-Agent ───────────────────────────────────────────

export type SubAgentType =
  | 'icp'
  | 'lead_magnet'
  | 'content'
  | 'tam'
  | 'outreach'
  | 'troubleshooter'
  | 'linkedin_ads'
  | 'operating_system';

export interface SubAgentHandoff {
  deliverables_created: Array<{ type: DeliverableType; entity_id?: string; entity_type?: string }>;
  progress_updates: Array<{ module_id: ModuleId; step: string; status?: ModuleStatus }>;
  validation_results: ValidationResult[];
  needs_escalation: boolean;
  summary: string;
}

// ─── Inline Card Types (for displayHint routing) ─────────

export type AcceleratorDisplayHint =
  | 'task_board'
  | 'deliverable_card'
  | 'approval_card'
  | 'quality_check'
  | 'metrics_card'
  | 'onboarding_intake'
  | 'enrollment_card'
  | 'checkout_card';

// ─── DB Column Constants ─────────────────────────────────

export const ENROLLMENT_COLUMNS =
  'id, user_id, enrolled_at, selected_modules, coaching_mode, onboarding_completed_at, intake_data, stripe_subscription_id, stripe_customer_id, status, created_at, updated_at';

export const MODULE_COLUMNS =
  'id, enrollment_id, module_id, status, current_step, coaching_mode_override, started_at, completed_at, created_at, updated_at';

export const DELIVERABLE_COLUMNS =
  'id, enrollment_id, module_id, deliverable_type, status, entity_id, entity_type, validation_result, validated_at, created_at, updated_at';

export const SOP_COLUMNS =
  'id, module_id, sop_number, title, content, quality_bars, deliverables, tools_used, dependencies, version';

export const USAGE_EVENT_COLUMNS = 'id, enrollment_id, event_type, metadata, created_at';
