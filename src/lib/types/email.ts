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
  status: EmailSequenceStatus;
  createdAt: string;
  updatedAt: string;
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
  status: string;
  created_at: string;
  updated_at: string;
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
    status: row.status as EmailSequenceStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
