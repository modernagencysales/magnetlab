// Email Sequence Types for MagnetLab

// ============================================
// EMAIL TYPES
// ============================================

export interface Email {
  day: number; // 0, 1, 2, 3, 4 (day after opt-in)
  subject: string;
  body: string;
  replyTrigger: string; // Question or statement to encourage replies
}

export type EmailSequenceStatus = 'draft' | 'synced' | 'active';

export interface EmailSequence {
  id: string;
  leadMagnetId: string;
  userId: string;
  emails: Email[];
  loopsSyncedAt: string | null;
  loopsTransactionalIds: string[];
  status: EmailSequenceStatus;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// LOOPS LEAD SYNC
// ============================================

export interface LoopsLeadSync {
  id: string;
  leadId: string;
  userId: string;
  loopsContactId: string | null;
  loopsEventSent: boolean;
  syncedAt: string;
  syncError: string | null;
  createdAt: string;
}

// ============================================
// API PAYLOADS
// ============================================

export interface GenerateEmailSequencePayload {
  leadMagnetId: string;
}

export interface UpdateEmailSequencePayload {
  emails: Email[];
}

// Sync uses no additional payload - the sequence's emails are used
export type SyncEmailSequencePayload = Record<string, never>;

// ============================================
// GENERATION INPUT
// ============================================

export interface EmailGenerationContext {
  // Lead magnet info
  leadMagnetTitle: string;
  leadMagnetFormat: string;
  leadMagnetContents: string;

  // Brand kit info
  senderName: string;
  businessDescription: string;
  bestVideoUrl?: string;
  bestVideoTitle?: string;
  contentLinks?: Array<{ title: string; url: string }>;
  communityUrl?: string;

  // Audience info
  audienceStyle: string;
}

// ============================================
// DATABASE ROW TYPES (for Supabase)
// ============================================

export interface EmailSequenceRow {
  id: string;
  lead_magnet_id: string;
  user_id: string;
  emails: Email[];
  loops_synced_at: string | null;
  loops_transactional_ids: string[];
  status: string;
  created_at: string;
  updated_at: string;
}

export interface LoopsLeadSyncRow {
  id: string;
  lead_id: string;
  user_id: string;
  loops_contact_id: string | null;
  loops_event_sent: boolean;
  synced_at: string;
  sync_error: string | null;
  created_at: string;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function emailSequenceFromRow(row: EmailSequenceRow): EmailSequence {
  return {
    id: row.id,
    leadMagnetId: row.lead_magnet_id,
    userId: row.user_id,
    emails: row.emails || [],
    loopsSyncedAt: row.loops_synced_at,
    loopsTransactionalIds: row.loops_transactional_ids || [],
    status: row.status as EmailSequenceStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function loopsLeadSyncFromRow(row: LoopsLeadSyncRow): LoopsLeadSync {
  return {
    id: row.id,
    leadId: row.lead_id,
    userId: row.user_id,
    loopsContactId: row.loops_contact_id,
    loopsEventSent: row.loops_event_sent,
    syncedAt: row.synced_at,
    syncError: row.sync_error,
    createdAt: row.created_at,
  };
}

// ============================================
// LOOPS API TYPES
// ============================================

export interface LoopsContact {
  email: string;
  firstName?: string;
  lastName?: string;
  source?: string;
  userGroup?: string;
  userId?: string;
  mailingLists?: Record<string, boolean>;
  // Custom properties
  [key: string]: unknown;
}

export interface LoopsEvent {
  email?: string;
  userId?: string;
  eventName: string;
  eventProperties?: Record<string, unknown>;
  mailingLists?: Record<string, boolean>;
}

export interface LoopsTransactionalEmail {
  transactionalId: string;
  email: string;
  dataVariables?: Record<string, string>;
  addToAudience?: boolean;
  mailingLists?: Record<string, boolean>;
}

export interface LoopsApiResponse {
  success: boolean;
  id?: string;
  message?: string;
}
