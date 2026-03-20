/** DM Coach types. Matches DB schema from migration 20260321100000_dm_coach. */

// ─── Enum Types ─────────────────────────────────────────────────────────

export type ConversationGoal =
  | 'book_meeting'
  | 'build_relationship'
  | 'promote_content'
  | 'explore_partnership'
  | 'nurture_lead'
  | 'close_deal';

export type QualificationStage =
  | 'unknown'
  | 'situation'
  | 'pain'
  | 'impact'
  | 'vision'
  | 'capability'
  | 'commitment';

export type ContactStatus = 'active' | 'paused' | 'closed_won' | 'closed_lost';

export type MessageRole = 'them' | 'me';

// ─── Database Row Types ─────────────────────────────────────────────────

export interface DmcContact {
  id: string;
  user_id: string;
  team_id: string | null;
  name: string;
  linkedin_url: string | null;
  headline: string | null;
  company: string | null;
  location: string | null;
  conversation_goal: ConversationGoal;
  qualification_stage: QualificationStage;
  status: ContactStatus;
  notes: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DmcMessage {
  id: string;
  contact_id: string;
  user_id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  created_at: string;
}

export interface DmcSuggestion {
  id: string;
  contact_id: string;
  user_id: string;
  suggested_response: string;
  reasoning: CoachReasoning;
  conversation_goal: ConversationGoal;
  stage_before: string;
  stage_after: string;
  was_used: boolean;
  user_edited_response: string | null;
  created_at: string;
}

// ─── Input Types ────────────────────────────────────────────────────────

export interface CreateContactInput {
  name: string;
  linkedin_url?: string;
  headline?: string;
  company?: string;
  location?: string;
  conversation_goal?: ConversationGoal;
  notes?: string;
}

export interface UpdateContactInput {
  name?: string;
  linkedin_url?: string | null;
  headline?: string | null;
  company?: string | null;
  location?: string | null;
  conversation_goal?: ConversationGoal;
  qualification_stage?: QualificationStage;
  status?: ContactStatus;
  notes?: string | null;
}

export interface AddMessageInput {
  role: MessageRole;
  content: string;
  timestamp?: string;
}

export interface AddMessagesBatchInput {
  messages: AddMessageInput[];
}

// ─── AI Output Types ────────────────────────────────────────────────────

export interface CoachReasoning {
  stage: string;
  signals: string[];
  styleNotes: string;
  strategyApplied: string;
  goalAlignment: string;
  negativeSignals?: string[];
}

export interface CoachSuggestion {
  suggestedResponse: string;
  reasoning: CoachReasoning;
  qualificationStageBefore: QualificationStage;
  qualificationStageAfter: QualificationStage;
}

// ─── Column Constants ───────────────────────────────────────────────────

export const DMC_CONTACT_COLUMNS =
  'id, user_id, team_id, name, linkedin_url, headline, company, location, conversation_goal, qualification_stage, status, notes, last_message_at, created_at, updated_at' as const;

export const DMC_MESSAGE_COLUMNS =
  'id, contact_id, user_id, role, content, timestamp, created_at' as const;

export const DMC_SUGGESTION_COLUMNS =
  'id, contact_id, user_id, suggested_response, reasoning, conversation_goal, stage_before, stage_after, was_used, user_edited_response, created_at' as const;

// ─── Update Field Whitelist ─────────────────────────────────────────────

export const ALLOWED_CONTACT_UPDATE_FIELDS = [
  'name',
  'linkedin_url',
  'headline',
  'company',
  'location',
  'conversation_goal',
  'qualification_stage',
  'status',
  'notes',
] as const;

// ─── Goal Configuration ─────────────────────────────────────────────────

export const CONVERSATION_GOALS: Record<
  ConversationGoal,
  {
    label: string;
    description: string;
    ladderEmphasis: QualificationStage[];
    closingAction: string;
  }
> = {
  book_meeting: {
    label: 'Book a Meeting',
    description: 'Get them on a discovery call',
    ladderEmphasis: ['situation', 'pain', 'impact', 'capability'],
    closingAction: 'Suggest a 15-minute call to explore solutions',
  },
  build_relationship: {
    label: 'Build Relationship',
    description: 'Long-term connection building, no sales urgency',
    ladderEmphasis: ['situation', 'pain', 'vision'],
    closingAction: 'Deepen engagement with value exchange',
  },
  promote_content: {
    label: 'Promote Content',
    description: 'Share relevant content that solves their problem',
    ladderEmphasis: ['situation', 'pain'],
    closingAction: 'Share content as "you might find this useful"',
  },
  explore_partnership: {
    label: 'Explore Partnership',
    description: 'Mutual benefit exploration',
    ladderEmphasis: ['situation', 'pain', 'impact', 'vision'],
    closingAction: 'Propose a mutual collaboration call',
  },
  nurture_lead: {
    label: 'Nurture Lead',
    description: 'Slow, relationship-first approach — no rushing',
    ladderEmphasis: ['situation', 'pain', 'impact', 'vision', 'capability', 'commitment'],
    closingAction: 'Continue genuine value exchange over time',
  },
  close_deal: {
    label: 'Close Deal',
    description: 'Remove final objections, confirm fit, get commitment',
    ladderEmphasis: ['capability', 'commitment'],
    closingAction: 'Ask about timeline, decision process, and next step',
  },
};

// ─── Qualification Ladder ───────────────────────────────────────────────

export const QUALIFICATION_LADDER: Record<
  QualificationStage,
  {
    label: string;
    description: string;
    questionThemes: string[];
  }
> = {
  unknown: {
    label: 'New',
    description: 'Not yet qualified',
    questionThemes: [],
  },
  situation: {
    label: 'Situation',
    description: 'Understanding their current state',
    questionThemes: ['role', 'day-to-day', 'tools', 'team size'],
  },
  pain: {
    label: 'Pain',
    description: 'Finding friction and frustration',
    questionThemes: ['bottlenecks', 'frustration', 'time wasted', 'manual work'],
  },
  impact: {
    label: 'Impact',
    description: 'Understanding business effect',
    questionThemes: ['revenue impact', 'growth blocked', 'opportunity cost', 'team morale'],
  },
  vision: {
    label: 'Vision',
    description: 'Defining what success looks like',
    questionThemes: ['ideal state', 'goals', 'timeline', 'what solved looks like'],
  },
  capability: {
    label: 'Capability',
    description: 'Assessing fit and readiness',
    questionThemes: ['resources', 'authority', 'priority level', 'active projects'],
  },
  commitment: {
    label: 'Commitment',
    description: 'Getting the next step',
    questionThemes: ['timeline', 'decision process', 'budget', 'next steps'],
  },
};
